"""OpenStreetMap 행정구역 경계 → 주변 동네(region_neighbors) 데이터 마이그레이션 SQL 을 만드는 변환 스크립트.

주변 동네 기준
  1. 육지 경계선을 함께 쓰는(맞닿은) 시 · 군 · 구끼리 이웃. 강 가운데 경계도 이어져 있으면 이웃 (예: 마포구 ↔ 영등포구)
     바다 위 경계선(OSM maritime=yes)은 빼요 — 제주시 ↔ 완도군처럼 바다 건너 먼 곳이 이웃이 되지 않게
  2. 이웃은 양쪽이 같아요 (A 가 B 의 이웃이면 B 도 A 의 이웃)
  3. 인천 옛 구(중구 · 동구 · 서구, 2026-07 개편 전 주소용)는 OSM 에 새 구만 있어서, 이어받은 새 구 + 그 새 구의 이웃을 이웃으로
  4. 맞닿은 곳이 없는 곳(울릉군 같은 섬 지역)은 중심이 가장 가까운 2곳을 이웃으로

만드는 파일
  db/migrations/20261122_04_region_neighbors_nationwide.sql   실행하면 주변 동네 표 전체를 지우고 다시 넣음

실행 (저장소 루트에서)
  python db/tools/region_neighbors_import.py --fetch            # OSM(Overpass API)에서 경계 목록을 받아 db/data/ 에 저장한 뒤 변환
  python db/tools/region_neighbors_import.py                    # 받아 둔 db/data/osm_sigungu_boundaries.json 으로 변환
  python db/tools/region_neighbors_import.py --report 목록.txt   # 동네마다 이웃 목록을 파일로 (눈으로 확인용)

DB 적용 순서: db/migrations/20261122_01_regions_nationwide.sql (전국 동네) 다음에 20261122_04
데이터: © OpenStreetMap contributors (ODbL). 경계선 좌표는 받지 않고, 경계(relation)를 이루는 선(way) 번호 · 중심 좌표만 씀.
이 스크립트는 DB에 접속하지 않고 파일만 만든다.
"""

import argparse
import collections
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# 같은 폴더의 쓰레기 배출표 변환 스크립트와 동네 목록 · SQL 글자 처리를 같이 씀 (python -I 로 실행해도 찾게 경로를 직접 넣음)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from trash_import import ROOT, read_regions_ts, sql_text  # noqa: E402

DEFAULT_OSM = ROOT / 'db' / 'data' / 'osm_sigungu_boundaries.json'  # db/data/ 는 저장소에 안 올림
OUT = ROOT / 'db' / 'migrations' / '20261122_04_region_neighbors_nationwide.sql'

# 대한민국 시 · 도(admin_level 4)마다 그 안의 시 · 군 · 구(6) · 일반구(7) 경계. 일반구는 제주시처럼 6 이 아닌 곳을 찾으려고 같이 받음
OVERPASS_QUERY = """[out:json][timeout:300];
area["ISO3166-1"="KR"][admin_level=2]->.kr;
rel(area.kr)["boundary"="administrative"]["admin_level"="4"]->.sidos;
foreach.sidos->.s(
  .s out body center;
  .s map_to_area->.a;
  rel(area.a)["boundary"="administrative"]["admin_level"~"^(6|7)$"];
  out body center;
);
rel(area.kr)["boundary"="administrative"]["admin_level"~"^(4|6|7)$"]->.all;
way(r.all)["maritime"="yes"];
out ids;"""
OVERPASS_URLS = (
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
)

# OSM 시 · 도 이름이 우리 이름과 다를 때 ISO 코드로 찾음
ISO_SIDO = {
    'KR-11': '서울특별시', 'KR-26': '부산광역시', 'KR-27': '대구광역시', 'KR-28': '인천광역시', 'KR-29': '전남광주통합특별시',
    'KR-30': '대전광역시', 'KR-31': '울산광역시', 'KR-50': '세종특별자치시', 'KR-41': '경기도', 'KR-42': '강원특별자치도',
    'KR-43': '충청북도', 'KR-44': '충청남도', 'KR-45': '전북특별자치도', 'KR-46': '전남광주통합특별시', 'KR-47': '경상북도',
    'KR-48': '경상남도', 'KR-49': '제주특별자치도',
}

# 인천 2026-07 개편: 옛 구 → 이어받은 새 구. OSM 에 한쪽만 있으면 다른 쪽 이웃을 여기서 만듦
INCHEON = '인천광역시'
SUCCESSION = {'중구': ['제물포구', '영종구'], '동구': ['제물포구'], '서구': ['서해구', '검단구']}
NEAREST_FALLBACK = 2  # 맞닿은 곳이 없을 때 가까운 곳 몇 개를 이웃으로


def fetch(path):
    """Overpass API 에서 경계 목록을 받아 저장. 서버가 붐비면 다른 서버 · 시간 간격을 늘려 다시 시도"""
    body = urllib.parse.urlencode({'data': OVERPASS_QUERY}).encode()
    wait = 15
    for attempt in range(1, 6):
        for url in OVERPASS_URLS:
            try:
                request = urllib.request.Request(url, data=body, headers={'User-Agent': 'zip-region-neighbors-import'})
                with urllib.request.urlopen(request, timeout=330) as response:
                    text = response.read().decode('utf-8')
                if text.lstrip().startswith('{'):
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(text, encoding='utf-8')
                    print(f'받음: {url} ({len(text):,}자) → {path.relative_to(ROOT)}')
                    return
                print(f'응답이 JSON 이 아님: {url} (시도 {attempt})')
            except Exception as error:  # 네트워크 · 서버 붐빔은 다음 서버로
                print(f'실패: {url} (시도 {attempt}) {error}')
        time.sleep(wait)
        wait *= 2
    sys.exit('OSM 경계 목록을 받지 못했어요. 잠시 뒤 다시 실행해 주세요.')


def load(path, regions):
    """OSM 응답 → {(시도, 시군구): {'ways': 육지 경계선 번호들, 'center': (위도, 경도)}}. 우리 동네 목록에 있는 것만"""
    data = json.loads(path.read_text(encoding='utf-8'))
    elements = data.get('elements', [])
    # 응답 끝에 바다 위 경계선(maritime=yes) 번호만 따로 옴 → 맞닿음 계산에서 뺌
    maritime = {e['id'] for e in elements if e.get('type') == 'way'}
    if not maritime:
        sys.exit('바다 경계선 목록이 없어요. --fetch 로 새로 받아 주세요 (예전 형식의 파일).')
    found = {}
    skipped = collections.Counter()
    sido = None
    for element in elements:
        if element.get('type') != 'relation':
            continue
        tags = element.get('tags', {})
        level = tags.get('admin_level')
        name = tags.get('name', '').strip()
        ways = {m['ref'] for m in element.get('members', []) if m.get('type') == 'way'} - maritime
        center = element.get('center') or {}
        point = (center.get('lat'), center.get('lon')) if 'lat' in center else None
        if level == '4':
            sido = name if name in regions else ISO_SIDO.get(tags.get('ISO3166-2', ''))
            if sido not in regions:
                sys.exit(f'OSM 시 · 도 이름을 알 수 없어요: {name} {tags.get("ISO3166-2")}')
            # 세종처럼 시 · 군 · 구가 없는 시 · 도는 시 · 도 경계 자체가 그 동네
            if sido in regions[sido]:
                found[(sido, sido)] = {'ways': ways, 'center': point}
            continue
        if sido is None or name not in regions[sido]:
            skipped[f'admin_level {level}'] += 1  # 다른 시 · 도 목록에 섞여 나온 경계 · 일반구(분당구 등)
            continue
        key = (sido, name)
        if key in found:
            if level == '7':
                continue  # 같은 이름의 시 · 군 · 구(6)가 이미 있으면 일반구(7)는 안 씀
            found[key]['ways'] |= ways
        else:
            found[key] = {'ways': ways, 'center': point}
    return found, skipped


def distance_km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def build(found, regions):
    edges = set()
    rule = {}  # 맞닿음 이외의 규칙으로 이웃을 만든 동네 → 이유

    def link(a, b):
        if a != b:
            edges.add(frozenset((a, b)))

    # 1. 경계선(way)을 함께 쓰는 동네끼리
    by_way = collections.defaultdict(set)
    for key, info in found.items():
        for way in info['ways']:
            by_way[way].add(key)
    for keys in by_way.values():
        for a in keys:
            for b in keys:
                link(a, b)

    def neighbors(key):
        return {other for edge in edges if key in edge for other in edge if other != key}

    # 2. 인천 옛 구 · 새 구 중 OSM 에 없는 쪽: 이어받은 / 물려준 구와 그 이웃
    for old, news in SUCCESSION.items():
        old_key = (INCHEON, old)
        if old not in regions.get(INCHEON, []):
            continue
        new_keys = [(INCHEON, n) for n in news if n in regions[INCHEON]]
        if old_key not in found and any(k in found for k in new_keys):
            for new_key in [k for k in new_keys if k in found]:
                for other in neighbors(new_key) | {new_key}:
                    link(old_key, other)
            rule[old_key] = '인천 개편 전 구 — 이어받은 새 구 기준'
    for new in {n for news in SUCCESSION.values() for n in news}:
        new_key = (INCHEON, new)
        if new not in regions.get(INCHEON, []) or new_key in found:
            continue
        olds = [(INCHEON, o) for o, news in SUCCESSION.items() if new in news and (INCHEON, o) in found]
        for old_key in olds:
            siblings = {(INCHEON, n) for n in SUCCESSION[old_key[1]]}
            for other in neighbors(old_key) | {old_key} | siblings:
                link(new_key, other)
            rule[new_key] = '인천 개편 후 구 — 예전 구 기준'

    # 3. 그래도 이웃이 없으면 중심이 가장 가까운 곳
    for key, info in found.items():
        if neighbors(key) or not info['center']:
            continue
        near = sorted((distance_km(info['center'], other['center']), other_key)
                      for other_key, other in found.items() if other_key != key and other['center'])
        for _, other_key in near[:NEAREST_FALLBACK]:
            link(key, other_key)
        rule[key] = f'맞닿은 곳 없음 — 가장 가까운 {NEAREST_FALLBACK}곳 ({", ".join(k[1] for _, k in near[:NEAREST_FALLBACK])})'
    return edges, rule


def ordered_pairs(edges, regions):
    order = {(sido, name): (i, j) for i, (sido, names) in enumerate(regions.items()) for j, name in enumerate(names)}
    pairs = [(a, b) for edge in edges for a, b in (tuple(edge), tuple(edge)[::-1])]
    return sorted(pairs, key=lambda p: (order.get(p[0], (99, 99)), order.get(p[1], (99, 99))))


def write(pairs, count):
    lines = [
        '-- 주변 동네(region_neighbors, 커뮤니티 "주변 동네" 범위): 육지 경계선을 함께 쓰는(맞닿은) 시 · 군 · 구끼리 이웃(강 가운데 경계 포함, 바다 위 경계 제외), 양쪽이 같음.',
        '-- db/tools/region_neighbors_import.py 가 OpenStreetMap 행정구역 경계(© OpenStreetMap contributors, ODbL)로 만든 파일 — 직접 고치지 말고 스크립트로 다시 만드세요.',
        f'-- {count}개 동네 · {len(pairs)}줄. 인천 옛 구(중구 · 동구 · 서구)는 이어받은 새 구 기준, 맞닿은 곳이 없는 섬 지역은 가장 가까운 2곳.',
        '-- 먼저 db/migrations/20261122_01_regions_nationwide.sql 을 적용하세요. 실행하면 주변 동네 표를 모두 지우고 이 파일 내용으로 다시 넣어요 (중간에 실패하면 되돌림).',
        'USE `zip`;',
        '',
        '-- 1) 임시 표에 이름으로 담음 (DB 마다 regions.id 가 달라도 시 · 도 + 시 · 군 · 구 이름으로 연결)',
        'DROP TEMPORARY TABLE IF EXISTS `neighbor_import`;',
        'CREATE TEMPORARY TABLE `neighbor_import` (`sido` VARCHAR(30) NOT NULL, `sigungu` VARCHAR(30) NOT NULL, '
        '`n_sido` VARCHAR(30) NOT NULL, `n_sigungu` VARCHAR(30) NOT NULL) DEFAULT CHARSET=utf8mb4;',
    ]
    batch = 500
    for i in range(0, len(pairs), batch):
        values = ',\n'.join(f'({sql_text(a[0])},{sql_text(a[1])},{sql_text(b[0])},{sql_text(b[1])})' for a, b in pairs[i:i + batch])
        lines.append('INSERT INTO `neighbor_import` (`sido`, `sigungu`, `n_sido`, `n_sigungu`) VALUES\n' + values + ';')
    lines += [
        '',
        '-- 2) 주변 동네 표를 통째로 바꿈 (한 트랜잭션)',
        'START TRANSACTION;',
        'DELETE FROM `region_neighbors` WHERE `region_id` > 0;',
        'INSERT IGNORE INTO `region_neighbors` (`region_id`, `neighbor_region_id`)',
        'SELECT g.`id`, ng.`id` FROM `neighbor_import` t',
        'JOIN `regions` s ON s.`parent_id` IS NULL AND s.`name` = t.`sido`',
        'JOIN `regions` g ON g.`parent_id` = s.`id` AND g.`name` = t.`sigungu`',
        'JOIN `regions` ns ON ns.`parent_id` IS NULL AND ns.`name` = t.`n_sido`',
        'JOIN `regions` ng ON ng.`parent_id` = ns.`id` AND ng.`name` = t.`n_sigungu`;',
        'COMMIT;',
        '',
        '-- 3) 확인: 넣은 줄 수와, regions 에 없어서 못 넣은 줄 수(0이어야 정상)',
        '--    (MySQL 은 한 문장에서 임시 표를 두 번 열 수 없어서 변수로 나눠 셈)',
        'SET @neighbor_file_rows = (SELECT COUNT(*) FROM `neighbor_import`);',
        'SET @neighbor_no_region = (SELECT COUNT(*) FROM `neighbor_import` t WHERE',
        '  NOT EXISTS (SELECT 1 FROM `regions` s JOIN `regions` g ON g.`parent_id` = s.`id` WHERE s.`parent_id` IS NULL AND s.`name` = t.`sido` AND g.`name` = t.`sigungu`)',
        '  OR NOT EXISTS (SELECT 1 FROM `regions` s JOIN `regions` g ON g.`parent_id` = s.`id` WHERE s.`parent_id` IS NULL AND s.`name` = t.`n_sido` AND g.`name` = t.`n_sigungu`));',
        "SELECT @neighbor_file_rows AS `파일 줄 수`, (SELECT COUNT(*) FROM `region_neighbors`) AS `넣은 줄 수`, @neighbor_no_region AS `지역 없음`;",
        'DROP TEMPORARY TABLE `neighbor_import`;',
        '',
    ]
    OUT.write_text('\n'.join(lines), encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description='OpenStreetMap 행정구역 경계 → 주변 동네 SQL')
    parser.add_argument('--osm', type=Path, default=DEFAULT_OSM)
    parser.add_argument('--fetch', action='store_true', help='Overpass API 에서 경계 목록을 새로 받음')
    parser.add_argument('--report', type=Path, help='동네마다 이웃 목록을 이 파일에 저장')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')  # Windows 콘솔(cp949)에서도 한글이 깨지지 않게

    if args.fetch:
        fetch(args.osm)
    regions = read_regions_ts()
    found, skipped = load(args.osm, regions)
    edges, rule = build(found, regions)
    pairs = ordered_pairs(edges, regions)
    keys = {key for edge in edges for key in edge}
    write(pairs, len(keys))

    total = sum(len(v) for v in regions.values())
    missing = [f'{s} {g}' for s, names in regions.items() for g in names if (s, g) not in keys]
    counts = collections.Counter(a for a, _ in pairs)
    print(f'동네 목록: {total}개 · OSM 에서 찾음: {len(found)}개 · 이웃이 있는 동네: {len(keys)}개')
    print(f'주변 동네: {len(edges)}쌍 → 양쪽 {len(pairs)}줄 → {OUT.relative_to(ROOT)}')
    print(f'  동네당 이웃 수: 최소 {min(counts.values())} · 평균 {len(pairs) / len(keys):.1f} · 최대 {max(counts.values())} ({counts.most_common(1)[0][0][1]})')
    print(f'  목록에 있는데 이웃이 없는 동네 {len(missing)}개: {", ".join(missing) or "없음"}')
    print('맞닿음 말고 다른 규칙으로 만든 곳:')
    for key, why in sorted(rule.items()):
        print(f'  {key[0]} {key[1]}: {why}')
    print(f'건너뛴 OSM 경계: {dict(skipped)}')
    if args.report:
        by = collections.defaultdict(list)
        for a, b in pairs:
            by[a].append(b[1] if a[0] == b[0] else f'{b[0]} {b[1]}')
        args.report.write_text('\n'.join(f'{a[0]} {a[1]}\t{len(v)}\t{", ".join(v)}' for a, v in by.items()) + '\n', encoding='utf-8')
        print(f'동네별 이웃 목록 → {args.report}')


if __name__ == '__main__':
    main()

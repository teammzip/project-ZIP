"""전국생활쓰레기배출정보표준데이터(공공데이터포털 CSV) → DB 시드 SQL 2개를 만드는 변환 스크립트.

만드는 파일
  db/migrations/20261121_07_regions_nationwide.sql         전국 시도(level 1) · 시군구(level 2). 이미 있는 지역은 건너뜀 (서울 id 그대로)
  db/migrations/20261121_08_trash_schedules_nationwide.sql 쓰레기 배출표. 실행하면 배출표 전체를 지우고 CSV 기준으로 다시 넣음

실행 (저장소 루트에서)
  python db/tools/trash_import.py                       # 기본 경로 사용
  python db/tools/trash_import.py --csv 다른파일.csv --report 변환목록.txt

DB 적용 순서: db/migrations/ 의 20261121_06 (표 구조) → 07 (지역) → 08 (배출표)
07 · 08 은 데이터만 넣는 마이그레이션이라 CSV 가 바뀌면 이 스크립트로 다시 만들고 다시 실행해도 됨
배출표 한 줄 = 동네 · 배출장소, 생활쓰레기 · 음식물 · 재활용마다 배출 요일("월,수,금") · 시작 시각 (원본 CSV 한 줄과 같은 모양)
이 스크립트는 DB에 접속하지 않고 파일만 만든다.
"""

import argparse
import collections
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / 'db' / 'data' / '생활쓰레기배출정보.csv'
REGIONS_TS = ROOT / 'frontend' / 'src' / 'features' / 'auth' / 'data' / 'regions.ts'
# 데이터 마이그레이션 두 개 (구조 변경 06 바로 뒤에 실행하도록 같은 폴더 · 번호로 둠)
OUT_REGIONS = ROOT / 'db' / 'migrations' / '20261121_07_regions_nationwide.sql'
OUT_TRASH = ROOT / 'db' / 'migrations' / '20261121_08_trash_schedules_nationwide.sql'

# regions.ts 의 짧은 시도 이름 → DB(regions.name) 에 저장하는 정식 이름
SIDO_FULL = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
    '전남광주': '전남광주통합특별시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시',
    '경기': '경기도', '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
    '전북': '전북특별자치도', '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도',
}

# CSV 시군구 이름 보정: "시"가 빠진 입력 오류, 세종은 시군구가 없어서 시도 이름을 시군구 자리에도 씀
SIGUNGU_FIX = {('경기도', '남양주'): '남양주시', ('경기도', '동두천'): '동두천시', ('세종특별자치시', '없음'): '세종특별자치시'}

# CSV 열 번호 (표준데이터 열 순서)
COL_SIDO, COL_SIGUNGU, COL_PLACE = 2, 3, 7
WASTE_COLUMNS = (  # (DB waste_type, 배출요일 열, 배출시작시각 열)
    ('GENERAL', 13, 16),  # 생활쓰레기
    ('FOOD', 14, 18),     # 음식물쓰레기
    ('RECYCLE', 15, 20),  # 재활용품
)
WEEKDAY = {'일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6}  # DB 규칙: 0=일 ~ 6=토
PLACE_MAX = 100  # trash_schedules.place VARCHAR(100)

# ---- 마을 장소 규칙 ----
# 마을 단위로만 정해진 장소("○○마을 생활폐기물 배출장", "마을별 수거지 별도 지정", "○○마을 입구" 등)는 한 문구로 합친다.
# 마을회관 · 경로당, 주소(숫자), 가게 · 시설 이름, 여러 장소를 나열한 문장은 원문 그대로 둔다.
VILLAGE_LABEL = '마을 내 생활 폐기물 배출장'
VILLAGE_KEEP = re.compile(r'회관|경로당|\d|,|/|또는|및')
VILLAGE_SUFFIX = (r'(?:생활\s*폐기물\s*배출장|입구|앞|안쪽|일대|중앙|대로\s*옆|집\s*앞|각\s*세대'
                  r'|앞\s*쓰레기\s*집하장|쓰레기\s*집하장|지정된\s*장소|지정\s*장소)')
# (읍·면 이름) (마을 이름)마을 (일반적인 위치 표현) — 마을 뒤에 가게 · 시설 이름이 오면 맞지 않아 원문 유지
VILLAGE_PLACE = re.compile(r'^(?:[가-힣]+\s+)?(?:[가-힣]+\s?)?마을\s*' + VILLAGE_SUFFIX + r'?$')
VILLAGE_GENERIC = re.compile(r'^(?:각\s*)?마을\s*(?:별|내)')  # 마을별 ~ / 마을 내 ~


def read_csv(path):
    """공공데이터포털 CSV 는 보통 cp949(엑셀 호환). UTF-8 로 다시 받은 파일도 읽을 수 있게 둘 다 시도."""
    for encoding in ('utf-8-sig', 'cp949'):
        try:
            with open(path, encoding=encoding, newline='') as f:
                rows = list(csv.reader(f))
            return rows[0], rows[1:], encoding
        except UnicodeDecodeError:
            continue
    sys.exit(f'CSV 인코딩을 읽지 못했어요: {path}')


def read_regions_ts():
    """프론트 동네 목록(regions.ts)의 시도 → 시군구. DB regions 와 같은 목록을 쓰려고 여기서 읽음."""
    text = REGIONS_TS.read_text(encoding='utf-8')
    found = {}
    for m in re.finditer(r"^\s+(\S+): \[(.*?)\],?$", text, re.M):
        if m.group(1) not in SIDO_FULL:
            sys.exit(f'regions.ts 시도 이름을 SIDO_FULL 에 추가해 주세요: {m.group(1)}')
        found[SIDO_FULL[m.group(1)]] = [name.strip().strip("'") for name in m.group(2).split(',')]
    return found


def normalize_place(raw):
    place = re.sub(r'\s+', ' ', raw).strip()
    if '마을' not in place or VILLAGE_KEEP.search(place):
        return place, False
    if VILLAGE_PLACE.match(place) or VILLAGE_GENERIC.match(place):
        return VILLAGE_LABEL, True
    return place, False


def normalize_time(raw):
    """'18:00' 형식만 받음. '2400' · '24:00' 은 자정(00:00)으로. 그 밖의 값은 None (그 종류는 건너뜀)."""
    value = raw.strip()
    if value in ('2400', '24:00'):
        return '00:00'
    return value if re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', value) else None


def sql_text(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def build(csv_path):
    header, rows, encoding = read_csv(csv_path)
    regions = read_regions_ts()
    stats = collections.Counter()
    skipped = collections.Counter()
    converted = collections.Counter()
    schedules = set()
    for row in rows:
        stats['CSV 행'] += 1
        sido = row[COL_SIDO].strip()
        sigungu = SIGUNGU_FIX.get((sido, row[COL_SIGUNGU].strip()), row[COL_SIGUNGU].strip())
        if sigungu not in regions.get(sido, []):
            skipped[f'동네 목록에 없는 지역: {sido} {sigungu}'] += 1
            continue
        place, village = normalize_place(row[COL_PLACE])
        if not place:
            skipped['배출장소 비어 있음'] += 1
            continue
        if len(place) > PLACE_MAX:
            sys.exit(f'배출장소가 {PLACE_MAX}자를 넘어요: {place}')
        if village:
            converted[row[COL_PLACE].strip()] += 1
        # 종류마다 (요일 'SET' 글자 "월,수,금", 시작 시각). 요일이 없으면 ('', None)
        kinds = []
        for waste_type, day_col, time_col in WASTE_COLUMNS:
            days = set()
            for token in re.split(r'[+,\s]+', row[day_col].strip()):
                if token in WEEKDAY:
                    days.add(token)
                elif token:
                    skipped[f'요일로 바꿀 수 없음({waste_type}): {token}'] += 1
            start = normalize_time(row[time_col]) if days else None
            if days and start is None:
                skipped[f'시작 시각 형식 오류({waste_type}): {row[time_col]!r} → 이 종류 빼고 넣음'] += 1
                days = set()
            kinds.append((','.join(sorted(days, key=WEEKDAY.get)), start))
        if not any(days for days, _ in kinds):
            skipped['세 종류 모두 배출 요일 없음 (줄 제외)'] += 1
            continue
        schedules.add((sido, sigungu, place, *[value for kind in kinds for value in kind]))
    return encoding, regions, sorted(schedules, key=lambda s: tuple('' if v is None else v for v in s)), stats, skipped, converted


def write_regions(regions):
    lines = [
        '-- 동네 기본 데이터: 전국 시도(regions level 1) · 시군구(level 2). db/tools/trash_import.py 가 만든 파일 — 직접 고치지 말고 스크립트로 다시 만드세요.',
        '-- 목록 기준: frontend/src/features/auth/data/regions.ts (2026-07-01 전남광주통합특별시 · 인천 개편 반영, 인천 중구 · 동구 · 서구도 포함).',
        '-- 이미 있는 시도 · 시군구는 건너뛰어요(서울 25개 구 id 그대로). 다시 실행해도 같은 동네가 두 번 들어가지 않아요.',
        'USE `zip`;',
        '',
    ]
    for sido, names in regions.items():
        lines.append(f'-- {sido} ({len(names)})')
        lines.append(f"INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, {sql_text(sido)}, 1 "
                     f"WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = {sql_text(sido)});")
        values = ' UNION ALL '.join(f'SELECT {sql_text(name)} AS name' for name in names)
        lines.append('INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 '
                     f"FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = {sql_text(sido)} ORDER BY `id` LIMIT 1) s "
                     f'CROSS JOIN ({values}) g;')
        lines.append('')
    OUT_REGIONS.write_text('\n'.join(lines), encoding='utf-8', newline='\n')


def sql_value(value):
    return 'NULL' if value is None else sql_text(value)


def write_trash(schedules, csv_name):
    columns = '`place`, `general_days`, `general_time`, `food_days`, `food_time`, `recycle_days`, `recycle_time`'
    lines = [
        '-- 쓰레기 배출표: 전국생활쓰레기배출정보표준데이터(공공데이터포털) → db/tools/trash_import.py 가 만든 파일 — 직접 고치지 말고 스크립트로 다시 만드세요.',
        f'-- 원본: db/data/{csv_name} · {len(schedules)}줄 (동네 · 배출장소, 생활쓰레기 · 음식물 · 재활용 배출 요일 · 시작 시각)',
        '-- 먼저 db/migrations/20261121_06_trash_schedule_columns.sql 과 20261121_07_regions_nationwide.sql 을 적용하세요.',
        '-- 실행하면 배출표(trash_schedules)를 모두 지우고 이 파일 내용으로 다시 넣어요 (다른 표가 참조하지 않는 공공 데이터). 중간에 실패하면 지운 것도 되돌려요.',
        'USE `zip`;',
        '',
        '-- 1) 임시 표에 시도 · 시군구 이름으로 담음 (DB 마다 regions.id 가 달라도 이름으로 연결)',
        'DROP TEMPORARY TABLE IF EXISTS `trash_import`;',
        'CREATE TEMPORARY TABLE `trash_import` (`sido` VARCHAR(30) NOT NULL, `sigungu` VARCHAR(30) NOT NULL, `place` VARCHAR(100) NOT NULL, '
        "`general_days` SET('일','월','화','수','목','금','토') NOT NULL, `general_time` TIME NULL, "
        "`food_days` SET('일','월','화','수','목','금','토') NOT NULL, `food_time` TIME NULL, "
        "`recycle_days` SET('일','월','화','수','목','금','토') NOT NULL, `recycle_time` TIME NULL) DEFAULT CHARSET=utf8mb4;",
    ]
    batch = 500  # 한 INSERT 에 넣는 줄 수 (MySQL 패킷 크기 안쪽)
    for i in range(0, len(schedules), batch):
        values = ',\n'.join('(' + ','.join(sql_value(v) for v in schedule) + ')' for schedule in schedules[i:i + batch])
        lines.append(f'INSERT INTO `trash_import` (`sido`, `sigungu`, {columns}) VALUES\n' + values + ';')
    lines += [
        '',
        '-- 2) 배출표를 통째로 바꿈 (한 트랜잭션)',
        'START TRANSACTION;',
        'DELETE FROM `trash_schedules` WHERE `id` > 0;',
        f'INSERT INTO `trash_schedules` (`region_id`, {columns})',
        'SELECT g.`id`, t.`place`, t.`general_days`, t.`general_time`, t.`food_days`, t.`food_time`, t.`recycle_days`, t.`recycle_time` FROM `trash_import` t',
        'JOIN `regions` s ON s.`parent_id` IS NULL AND s.`name` = t.`sido`',
        'JOIN `regions` g ON g.`parent_id` = s.`id` AND g.`name` = t.`sigungu`;',
        'COMMIT;',
        '',
        '-- 3) 확인: 넣은 줄 수와, regions 에 없어서 못 넣은 줄 수(0이어야 정상)',
        '--    (MySQL 은 한 문장에서 임시 표를 두 번 열 수 없어서 변수로 나눠 셈)',
        'SET @trash_file_rows = (SELECT COUNT(*) FROM `trash_import`);',
        'SET @trash_no_region = (SELECT COUNT(*) FROM `trash_import` t WHERE NOT EXISTS (SELECT 1 FROM `regions` s JOIN `regions` g ON g.`parent_id` = s.`id`',
        '  WHERE s.`parent_id` IS NULL AND s.`name` = t.`sido` AND g.`name` = t.`sigungu`));',
        "SELECT @trash_file_rows AS `파일 줄 수`, (SELECT COUNT(*) FROM `trash_schedules`) AS `넣은 줄 수`, @trash_no_region AS `지역 없음`;",
        'DROP TEMPORARY TABLE `trash_import`;',
        '',
    ]
    OUT_TRASH.write_text('\n'.join(lines), encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description='생활쓰레기 배출정보 CSV → DB 시드 SQL')
    parser.add_argument('--csv', type=Path, default=DEFAULT_CSV)
    parser.add_argument('--report', type=Path, help='마을 규칙으로 바꾼 장소 원문 목록을 이 파일에 저장')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')  # Windows 콘솔(cp949)에서도 한글 통계가 깨지지 않게

    encoding, regions, schedules, stats, skipped, converted = build(args.csv)
    write_regions(regions)
    write_trash(schedules, args.csv.name)

    per_region = collections.Counter((a, b) for a, b, *_ in schedules)
    print(f'CSV: {args.csv.name} ({encoding}) · {stats["CSV 행"]}행')
    print(f'지역: 시도 {len(regions)}개 · 시군구 {sum(len(v) for v in regions.values())}개 → {OUT_REGIONS.relative_to(ROOT)}')
    print(f'배출표: {len(schedules)}줄 → {OUT_TRASH.relative_to(ROOT)}')
    print(f'  배출정보 있는 시군구 {len(per_region)}개 (1줄 {sum(v == 1 for v in per_region.values())}개 · '
          f'100줄 이상 {sum(v >= 100 for v in per_region.values())}개 · 가장 많은 곳 {per_region.most_common(1)})')
    missing = [f'{s} {g}' for s, names in regions.items() for g in names if not any(a == s and b == g for a, b, *_ in schedules)]
    print(f'  배출정보 없는 시군구 {len(missing)}개: {", ".join(missing)}')
    print(f'마을 규칙: {sum(converted.values())}행 · 원문 {len(converted)}종류 → "{VILLAGE_LABEL}"')
    print('건너뜀:')
    for reason, count in skipped.most_common():
        print(f'  {reason}: {count}')
    if args.report:
        args.report.write_text('\n'.join(f'{count}\t{place}' for place, count in converted.most_common()) + '\n', encoding='utf-8')
        print(f'마을 규칙 변환 목록 → {args.report}')


if __name__ == '__main__':
    main()

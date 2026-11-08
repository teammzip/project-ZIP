package com.zip.backend.map;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;
import java.util.regex.Pattern;

/* AI 장소 찾기 (시연용 규칙). 프론트 frontend/src/features/map/aiFind.ts 와 같은 규칙으로 말을 읽어 장소를 골라요.
 * 실제 AI · 지도 검색 API 가 정해지면 이 클래스만 바꾸면 돼요. */
final class PlaceFinder {
    private PlaceFinder() {}

    record Found(MapRepository.PlaceRow place, double score, List<String> reasons) {}

    private record Modifier(Pattern asks, Pattern has, String label, int weight) {}

    /** 말 → 찾을 장소 종류 */
    private static final List<Map.Entry<Pattern, List<String>>> SYNONYMS = List.of(
        Map.entry(Pattern.compile("빨래|세탁|이불|건조"), List.of("세탁방", "세탁소")),
        Map.entry(Pattern.compile("편의점|야식|간식|담배|새벽"), List.of("편의점")),
        Map.entry(Pattern.compile("약|감기|두통|소화|밴드"), List.of("약국")),
        Map.entry(Pattern.compile("아파|아프|병원|진료|치과|내과|열|소아"), List.of("병원", "약국")),
        Map.entry(Pattern.compile("장보|식재료|마트|채소|과일"), List.of("마트", "반찬가게")),
        Map.entry(Pattern.compile("커피|카페|공부|스터디|작업|노트북"), List.of("카페")),
        Map.entry(Pattern.compile("운동|헬스|요가|조깅|PT", Pattern.CASE_INSENSITIVE), List.of("헬스장", "공원")),
        Map.entry(Pattern.compile("돈|출금|입금|은행|atm", Pattern.CASE_INSENSITIVE), List.of("은행")),
        Map.entry(Pattern.compile("머리|커트|미용|파마"), List.of("미용실")),
        Map.entry(Pattern.compile("생활용품|다이소|수납|청소용품|잡화"), List.of("다이소", "마트")),
        Map.entry(Pattern.compile("밥|식당|혼밥|먹|배고|점심|저녁|국밥|분식"), List.of("식당", "반찬가게")),
        Map.entry(Pattern.compile("반찬"), List.of("반찬가게")),
        Map.entry(Pattern.compile("전입|주민|서류|등본|민원"), List.of("주민센터")),
        Map.entry(Pattern.compile("공원|산책|걷|벤치"), List.of("공원")),
        Map.entry(Pattern.compile("수선|드라이|옷"), List.of("세탁소")));

    /** 말 → 원하는 조건 (조건 글자가 장소 설명에 있으면 점수를 더함) */
    private static final List<Modifier> MODIFIERS = List.of(
        new Modifier(Pattern.compile("24|밤|심야|새벽|야간|늦게"), Pattern.compile("24시간|심야|야간"), "24시간·심야 운영", 3),
        new Modifier(Pattern.compile("싼|저렴|가성비|값"), Pattern.compile("저렴|월 3만원"), "저렴함", 2),
        new Modifier(Pattern.compile("조용|한적|스터디|콘센트"), Pattern.compile("조용|스터디|콘센트"), "조용함", 2),
        new Modifier(Pattern.compile("혼밥|혼자"), Pattern.compile("혼밥"), "혼밥하기 좋음", 2),
        new Modifier(Pattern.compile("주말|토요일"), Pattern.compile("토요일|주말"), "주말 이용", 2));

    private static final Pattern ENDINGS = Pattern.compile("(이나|에서|근처|주변|가까운|제일|있는|찾아줘|알려줘|어디|있어|싶어|해줘|좀)$");

    /** 말에 맞는 장소를 점수 순으로 최대 5곳 (가까울수록 조금 더 위) */
    static List<Found> find(String q, List<MapRepository.PlaceRow> places, List<String> kinds,
        ToIntFunction<MapRepository.PlaceRow> walkMin) {
        var text = q.replaceAll("\\s", "");
        var wanted = new LinkedHashSet<String>();
        for (var entry : SYNONYMS) if (entry.getKey().matcher(text).find()) wanted.addAll(entry.getValue());
        for (var kind : kinds) if (text.contains(kind)) wanted.add(kind); // 종류 이름을 그대로 쓴 경우
        var modifiers = MODIFIERS.stream().filter(m -> m.asks().matcher(text).find()).toList();
        var tokens = new ArrayList<String>();
        for (var token : q.split("[\\s,]+")) {
            var trimmed = ENDINGS.matcher(token).replaceAll("");
            if (trimmed.length() >= 2) tokens.add(trimmed);
        }

        var found = new ArrayList<Found>();
        for (var place : places) {
            var description = place.description() == null ? "" : place.description();
            int score = 0;
            var reasons = new ArrayList<String>();
            if (wanted.contains(place.category())) {
                score += 5;
                reasons.add(place.category());
            }
            for (var token : tokens) {
                if ((place.name() + description).contains(token)) {
                    score += 3;
                    var reason = "\"" + token + "\" 포함";
                    if (!reasons.contains(reason)) reasons.add(reason);
                }
            }
            for (var modifier : modifiers) {
                if (modifier.has().matcher(description).find()) {
                    score += modifier.weight();
                    reasons.add(modifier.label());
                }
            }
            if (score >= 3) found.add(new Found(place, score + (20 - Math.min(walkMin.applyAsInt(place), 20)) / 20.0, reasons));
        }
        return found.stream().sorted(Comparator.comparingDouble(Found::score).reversed()).limit(5).toList();
    }
}

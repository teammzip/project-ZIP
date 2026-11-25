package com.zip.backend.community;

import java.util.Set;
import java.util.regex.Pattern;

final class CommunitySearchSuggestion {
    private static final Pattern KOREAN_WORD = Pattern.compile("(?<!\\S)[가-힣]{2,}(?!\\S)", Pattern.UNICODE_CHARACTER_CLASS);
    private static final int HANGUL_START = '가';
    private static final int MEDIALS = 21;
    private static final int FINALS = 28;

    // 생활 검색에서 자주 쓰는 단어. 정상 단어도 포함해 불필요한 교정을 막는다.
    private static final Set<String> TERMS = Set.of(
        "가스밸브", "계량기", "고지서", "공동현관", "공용현관", "곰팡이", "관리비", "관리실", "교재", "교체", "교환",
        "냉장고", "누수", "대형폐기물", "동물병원", "방충망", "배수", "배수구", "배출", "보일러", "분리배출", "분리수거",
        "세탁기", "세탁망", "세탁방", "수도계량기", "수리", "쓰레기", "약국", "에어컨", "우산", "월세", "이사", "입주",
        "재활용", "재활용품", "전기장판", "전기차", "전입신고", "종량제", "주차장", "주차차단기", "층간소음", "택배", "폐건전지", "현관등"
    );

    private CommunitySearchSuggestion() {}

    static String candidate(String query) {
        if (query == null || query.length() < 3) return null;
        String result = null;
        var words = KOREAN_WORD.matcher(query);
        while (words.find()) {
            String word = words.group();
            if (TERMS.contains(word)) continue;
            for (String term : TERMS) {
                if (!oneJamoDifference(word, term)) continue;
                if (result != null) return null;
                result = query.substring(0, words.start()) + term + query.substring(words.end());
            }
        }
        return result;
    }

    private static boolean oneJamoDifference(String word, String term) {
        if (word.length() != term.length()) return false;
        int differences = 0;
        for (int index = 0; index < word.length(); index++) {
            int left = word.charAt(index) - HANGUL_START;
            int right = term.charAt(index) - HANGUL_START;
            if (left == right) continue;
            if (left / (MEDIALS * FINALS) != right / (MEDIALS * FINALS)) differences++;
            if (left / FINALS % MEDIALS != right / FINALS % MEDIALS) differences++;
            if (left % FINALS != right % FINALS) differences++;
            if (differences > 1) return false;
        }
        return differences == 1;
    }
}

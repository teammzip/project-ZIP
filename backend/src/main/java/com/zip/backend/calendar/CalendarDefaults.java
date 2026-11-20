package com.zip.backend.calendar;

import java.util.List;

/**
 * 회원마다 처음 만들어 주는 일정 카테고리 5개 + 미분류와 기본 항목 30개.
 * db/seeds/event_defaults.sql · frontend features/life/data/presets.ts 와 같은 내용이에요 (바꾸면 셋 다 같이).
 */
final class CalendarDefaults {
    private CalendarDefaults() {}

    record Category(String name, String ico, List<String> items) {}

    static final String UNCATEGORIZED = "미분류";
    static final String UNCATEGORIZED_ICO = "📌";
    static final String CUSTOM_ICO = "🏷️";

    static final List<Category> CATEGORIES = List.of(
        new Category("집 관리", "🏠", List.of("에어컨 필터 청소", "배수구 청소", "전구 교체", "소모품 재고 확인", "생필품 주문", "곰팡이 점검")),
        new Category("청소·빨래", "🧺", List.of("이불 빨래", "화장실 청소", "냉장고 정리", "세탁기 통세척", "침구 교체", "쓰레기통 비우기")),
        new Category("돈·계약", "💸", List.of("월세 이체", "공과금 납부", "관리비 확인", "보험료 납부", "계약 만료 확인", "통신비 확인")),
        new Category("건강·생활", "💊", List.of("병원 예약", "약 챙기기", "운동하기", "장보기", "정수기 필터 확인", "비타민 구매")),
        new Category("연락·행정", "📞", List.of("집주인 통화", "주민센터 방문", "택배 반품", "전입신고", "이사 업체 연락", "수리 기사 방문")));
}

package com.zip.backend.map;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 지도 장소 한 곳 (GET /api/places · AI 검색 결과의 place).
 * DB 장소는 id 가 번호 문자열, 카카오 장소는 "kakao:카카오장소id".
 * 주소 · 전화 · 영업시간이 없거나 리뷰가 없어 별점이 없으면 키를 생략하지 않고 null 로 보낸다.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PlaceResponse(
    String id,
    String category,
    String name,
    String description,
    double lat,
    double lon,
    int walkMin,
    String address,
    String phone,
    String openHours,
    Double rating,
    int reviewCount
) {
    /** 장소 종류 (GET /api/places/categories) */
    public record Category(String id, String name, String icon) {}

    /** AI 장소 검색 결과 한 줄: 장소 · 고른 이유 · 도보 분 */
    public record AiMatch(PlaceResponse place, List<String> reasons, int walkMin) {}

    /** 저장한 카카오 장소 (GET /api/me/place-favorites/kakao). 좌표 · 주소는 저장하지 않아 없음 */
    public record KakaoFavorite(String id, String name, String category) {}

    /** 저장 리스트 (GET · POST /api/me/place-lists). placeIds 는 장소 키 목록 */
    public record PlaceList(String id, String name, String color, List<String> placeIds) {}

    /** 지도 칩 설정 (GET · PUT /api/me/map-settings) */
    public record MapSettings(List<String> categories, List<String> keywords) {}
}

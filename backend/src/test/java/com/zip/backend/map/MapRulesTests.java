package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** 도보 시간 · AI 장소 찾기 규칙 (DB 없이). 장소는 프론트 data/places.ts 예시와 같음 */
class MapRulesTests {
    private static final MapRepository.Point HOME = new MapRepository.Point(37.5572, 126.9244);

    private static MapRepository.PlaceRow place(long id, String category, String name, String description, double lat, double lon) {
        return new MapRepository.PlaceRow(id, category, name, description, lat, lon, null, null, null, null, 0);
    }

    private static final List<MapRepository.PlaceRow> PLACES = List.of(
        place(1, "세탁방", "세탁방 A (예시)", "도보 약 3분 · 대형 세탁기", 37.5589, 126.9262),
        place(2, "세탁방", "세탁방 B (예시)", "도보 약 6분 · 24시간", 37.5561, 126.9231),
        place(3, "약국", "약국 A (예시)", "도보 약 5분 · 평일 9~21시", 37.5574, 126.9268),
        place(4, "약국", "약국 B (예시)", "도보 약 8분 · 심야 운영", 37.5553, 126.925),
        place(5, "카페", "카페 A (예시)", "도보 약 2분 · 조용한 · 콘센트 많음", 37.5571, 126.9249));

    @Test
    void walkMinUsesHomeDistanceThenDescription() {
        assertEquals(4, MapService.walkMin(PLACES.get(0), Optional.of(HOME)));
        assertEquals(1, MapService.walkMin(place(9, "편의점", "집 앞", "", HOME.lat(), HOME.lon()), Optional.of(HOME)));
        assertEquals(3, MapService.walkMin(PLACES.get(0), Optional.empty()));
        assertEquals(99, MapService.walkMin(place(9, "공원", "설명 없음", null, 37.55, 126.92), Optional.empty()));
    }

    @Test
    void aiFindPrefersCategoryAndConditions() {
        var found = PlaceFinder.find("밤에 갈 수 있는 약국", PLACES, List.of("세탁방", "약국", "카페"),
            p -> MapService.walkMin(p, Optional.of(HOME)));
        assertEquals("약국 B (예시)", found.get(0).place().name());
        assertTrue(found.get(0).reasons().contains("24시간·심야 운영"));
        assertTrue(found.size() <= 5);
    }

    @Test
    void aiFindReturnsNothingForUnrelatedWords() {
        assertTrue(PlaceFinder.find("ㅁㄴㅇ", PLACES, List.of("세탁방", "약국", "카페"), p -> 5).isEmpty());
    }
}

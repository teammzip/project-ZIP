package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.zip.backend.common.ApiException;
import java.time.Clock;
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
    void nearbyReturnsAllPlacesInsideOneKilometerWithCoordinatesInDistanceOrder() {
        var service = new MapService(null, new KakaoLocalClient("test") {
            @Override
            public List<Document> category(String code, double lat, double lon, int radius) {
                assertEquals("PM9", code);
                assertEquals(35.16, lat);
                assertEquals(129.06, lon);
                assertEquals(1_000, radius);
                return List.of(
                    pharmacy("1", 35.18), pharmacy("2", 35.165), pharmacy("3", 35.162),
                    pharmacy("4", 35.161), pharmacy("5", 35.164), pharmacy("6", Double.NaN), pharmacy("4", 35.163));
            }
        }, new KakaoQuota(Clock.systemUTC(), 30, 30_000));

        var results = service.nearby(1, new MapRequests.NearbySearch("약국", 35.16, 129.06));
        assertEquals(List.of("4", "3", "5", "2"), results.stream().map(MapService.NearbyPlace::id).toList());
        assertEquals(List.of(112L, 223L, 445L, 556L), results.stream().map(MapService.NearbyPlace::distanceMeters).toList());
        assertEquals("가까운 도로명", results.get(0).address());
        assertEquals(35.161, results.get(0).lat());
        assertEquals(129.06, results.get(0).lon());
        assertEquals("약국", results.get(0).category());
    }

    @Test
    void nearbyKeywordSearchStaysWithinOneKilometerAndReportsLimits() {
        var service = new MapService(null, new KakaoLocalClient("test") {
            @Override
            public List<Document> keyword(String q, double lat, double lon, int radius) {
                assertEquals("카페 브라운", q);
                assertEquals(1_000, radius);
                return List.of(pharmacy("1", 35.18));
            }
        }, new KakaoQuota(Clock.systemUTC(), 1, 30_000));

        assertTrue(service.nearby(1, new MapRequests.NearbySearch("카페 브라운", 35.16, 129.06)).isEmpty());
        var limit = assertThrows(ApiException.class, () -> service.nearby(1, new MapRequests.NearbySearch("다른 장소", 35.16, 129.06)));
        assertEquals(429, limit.status());
    }

    @Test
    void nearbyRejectsInvalidCoordinatesAndUnavailableKakaoBeforeSearching() {
        var service = new MapService(null, new KakaoLocalClient(""), null);
        assertEquals(400, assertThrows(ApiException.class,
            () -> service.nearby(1, new MapRequests.NearbySearch("약국", Double.NaN, 129.06))).status());
        assertEquals(503, assertThrows(ApiException.class,
            () -> service.nearby(1, new MapRequests.NearbySearch("약국", 35.16, 129.06))).status());
    }

    private static KakaoLocalClient.Document pharmacy(String id, double lat) {
        return new KakaoLocalClient.Document(id, "약국 " + id, "건강 > 약국", "PM9", null,
            "가까운 지번", "가까운 도로명", "129.06", Double.toString(lat));
    }
    @Test
    void aiFindPrefersCategoryAndConditions() {
        var found = PlaceFinder.find("밤에 갈 수 있는 약국", PLACES, List.of("세탁방", "약국", "카페"),
            p -> MapService.walkMin(p, Optional.of(HOME)));
        assertEquals("약국 B (예시)", found.get(0).place().name());
        assertTrue(found.get(0).reasons().contains("24시간·심야 운영"));
        assertEquals(List.of(4L, 3L), found.stream().map(result -> result.place().id()).toList());
    }

    @Test
    void explicitCategoryTakesPriorityOverInferredCategory() {
        var candidates = List.of(
            place(6, "식당", "카페 거리 식당", "심야 운영 · 간식", 37.55, 126.92),
            PLACES.get(4));
        var found = PlaceFinder.find("간식 먹을 카페", candidates, List.of("카페", "식당"), p -> 5);
        assertEquals(List.of(5L), found.stream().map(result -> result.place().id()).toList());
    }

    @Test
    void repeatedWordsDoNotIncreaseScore() {
        var single = PlaceFinder.find("콘센트", PLACES, List.of("카페"), p -> 5);
        var repeated = PlaceFinder.find("콘센트 콘센트", PLACES, List.of("카페"), p -> 5);
        assertEquals(single, repeated);
    }

    @Test
    void aiFindReturnsNothingForUnrelatedWords() {
        assertTrue(PlaceFinder.find("ㅁㄴㅇ", PLACES, List.of("세탁방", "약국", "카페"), p -> 5).isEmpty());
    }
}

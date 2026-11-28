package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** 지도 API: 장소 검색 경로와 DB · 카카오 장소 즐겨찾기 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/map-favorites-fixture.sql"})
class MapFavoriteIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired MapRepository repository;

    @BeforeEach void seed() {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'tester01', ?, '회원하나'), (2, 'tester02', ?, '회원둘')", hash, hash);
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.accessToken");
    }

    private ResultActions save(String token, String placeId, String body) throws Exception {
        var request = put("/api/me/place-favorites/{id}", placeId).header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    @Test void nearbySearchRouteValidatesCoordinatesForSignedInUsers() throws Exception {
        mvc.perform(post("/api/places/nearby").header("Authorization", "Bearer " + login("tester01"))
            .contentType("application/json").content("""
                {"q":"약국","lat":91,"lon":126.91}
                """))
            .andExpect(status().isBadRequest());
    }

    @Test void kakaoPlaceSavesOnlyIdNameAndCategoryAndListsWithDbPlaces() throws Exception {
        String token = login("tester01");
        save(token, "10", null).andExpect(status().isNoContent());
        save(token, "kakao:12345", "{\"name\":\"  다이소 강남역2호점 \",\"category\":\"다이소\"}").andExpect(status().isNoContent());
        // 두 번 저장해도 한 줄, 이름은 최신으로
        save(token, "kakao:12345", "{\"name\":\"다이소 강남역2호점(새 이름)\",\"category\":\"다이소\"}").andExpect(status().isNoContent());

        mvc.perform(get("/api/me/place-favorites").header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0]").value("10")).andExpect(jsonPath("$[1]").value("kakao:12345"));
        mvc.perform(get("/api/me/place-favorites/kakao").header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value("kakao:12345"))
            .andExpect(jsonPath("$[0].name").value("다이소 강남역2호점(새 이름)")).andExpect(jsonPath("$[0].category").value("다이소"));

        // 다른 회원에게는 안 보임
        mvc.perform(get("/api/me/place-favorites").header("Authorization", "Bearer " + login("tester02")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        mvc.perform(delete("/api/me/place-favorites/{id}", "kakao:12345").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM kakao_place_favorites", Integer.class));
    }

    @Test void invalidKakaoFavoritesAreRejected() throws Exception {
        String token = login("tester01");
        save(token, "kakao:12345", null).andExpect(status().isBadRequest());
        save(token, "kakao:12345", "{\"name\":\"   \",\"category\":\"다이소\"}").andExpect(status().isBadRequest());
        save(token, "kakao:12345", "{\"name\":\"" + "가".repeat(61) + "\",\"category\":\"다이소\"}").andExpect(status().isBadRequest());
        save(token, "kakao:12345", "{\"name\":\"다이소\",\"category\":\"없는종류\"}").andExpect(status().isBadRequest());
        save(token, "kakao:abc", "{\"name\":\"다이소\",\"category\":\"다이소\"}").andExpect(status().isNotFound());
        save(token, "999", null).andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM kakao_place_favorites", Integer.class));
    }

    private ResultActions review(String token, String placeId, String body) throws Exception {
        return mvc.perform(post("/api/places/{id}/reviews", placeId).header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body));
    }

    @Test void kakaoSearchFavoriteAndReviewShareTheSamePlaceKey() throws Exception {
        var kakao = new KakaoLocalClient("test") {
            @Override public List<Document> category(String code, double lat, double lon, int radius) {
                return List.of(
                    new Document("10", "동네 편의점", "편의점", "CS2", null, null, null, "126.92", "37.55"),
                    new Document("010", "동네 편의점", "편의점", "CS2", null, null, null, "126.92", "37.55"),
                    new Document("invalid", "동네 편의점", "편의점", "CS2", null, null, null, "126.92", "37.55"));
            }
        };
        var map = new MapService(repository, kakao, new KakaoQuota(Clock.systemUTC(), 30, 30_000));
        var places = map.places(1, "2", "편의점", null, null, 37.55, 126.92, false).items();
        assertEquals(List.of("kakao:10", "kakao:010"), places.stream().map(PlaceResponse::id).toList());
        var key = places.get(0).id();
        var token = login("tester01");
        save(token, key, "{\"name\":\"동네 편의점\",\"category\":\"편의점\"}").andExpect(status().isNoContent());
        review(token, key, "{\"rating\":5,\"name\":\"동네 편의점\"}").andExpect(status().isNoContent());
        review(token, "10", "{\"rating\":2}").andExpect(status().isNoContent());

        mvc.perform(get("/api/me/place-favorites/kakao").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(key));
        mvc.perform(get("/api/places/{id}/reviews", key).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].rating").value(5));
        mvc.perform(get("/api/places/review-summary").param("ids", "10,kakao:10,kakao:010").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[?(@.id == 'kakao:10')].rating").value(org.hamcrest.Matchers.contains(5.0)))
            .andExpect(jsonPath("$[?(@.id == '10')].rating").value(org.hamcrest.Matchers.contains(2.0)));
    }

    @Test void kakaoPlaceReviewsAreSavedWithIdAndNameOnly() throws Exception {
        String one = login("tester01");
        String two = login("tester02");
        mvc.perform(get("/api/places/{id}/reviews", "kakao:12345").header("Authorization", "Bearer " + one))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        review(one, "kakao:12345", "{\"rating\":5,\"body\":\"여기 존맛\",\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        review(two, "kakao:12345", "{\"rating\":4,\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        // 한 사람당 한 곳에 하나
        review(one, "kakao:12345", "{\"rating\":1,\"name\":\"동네 국밥\"}").andExpect(status().isConflict());
        mvc.perform(get("/api/places/{id}/reviews", "kakao:12345").header("Authorization", "Bearer " + two))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[?(@.author.nickname == '회원하나')].body").value("여기 존맛"))
            .andExpect(jsonPath("$[?(@.author.nickname == '회원둘')].body").value(""));
        // 다른 카카오 장소에는 안 보임
        mvc.perform(get("/api/places/{id}/reviews", "kakao:99").header("Authorization", "Bearer " + one))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM kakao_place_reviews WHERE kakao_place_id = '12345' AND name = '동네 국밥'", Integer.class));
    }

    @Test void invalidKakaoPlaceReviewsAreRejected() throws Exception {
        String token = login("tester01");
        review(token, "kakao:12345", "{\"rating\":5}").andExpect(status().isBadRequest());
        review(token, "kakao:12345", "{\"rating\":5,\"name\":\"   \"}").andExpect(status().isBadRequest());
        review(token, "kakao:12345", "{\"rating\":5,\"name\":\"" + "가".repeat(61) + "\"}").andExpect(status().isBadRequest());
        review(token, "kakao:12345", "{\"rating\":6,\"name\":\"국밥\"}").andExpect(status().isBadRequest());
        review(token, "kakao:12345", "{\"rating\":5,\"name\":\"국밥\",\"body\":\"" + "가".repeat(301) + "\"}").andExpect(status().isBadRequest());
        review(token, "kakao:abc", "{\"rating\":5,\"name\":\"국밥\"}").andExpect(status().isNotFound());
        mvc.perform(get("/api/places/{id}/reviews", "kakao:abc").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM kakao_place_reviews", Integer.class));
    }

    @Test void kakaoFavoritesAreLimitedPerUser() throws Exception {
        for (int i = 0; i < MapService.KAKAO_FAVORITE_MAX; i++) {
            jdbc.update("INSERT INTO kakao_place_favorites (user_id, kakao_place_id, name, category) VALUES (1, ?, '장소', '편의점')", Integer.toString(i));
        }
        String token = login("tester01");
        save(token, "kakao:99999", "{\"name\":\"새 장소\",\"category\":\"편의점\"}").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").isString());
        // 이미 저장한 곳은 이름만 바꿀 수 있음
        save(token, "kakao:0", "{\"name\":\"이름 바꿈\",\"category\":\"편의점\"}").andExpect(status().isNoContent());
        assertEquals("이름 바꿈", jdbc.queryForObject("SELECT name FROM kakao_place_favorites WHERE kakao_place_id = '0'", String.class));
    }
}

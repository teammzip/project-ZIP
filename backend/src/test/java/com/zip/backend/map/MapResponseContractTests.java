package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.TreeMap;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 지도 · 장소 리뷰 응답의 JSON 모양(칸 이름과 값 종류: 글자 s · 정수 i · 소수 f · 참거짓 b · null)을 고정하는 테스트.
 * 응답을 Map 에서 DTO(record)로 바꿔도 화면이 받는 모양이 그대로인지 확인한다. 모양은 Map 이던 때의 응답에서 뽑았다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/map-favorites-fixture.sql"})
class MapResponseContractTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;

    private String one, two, admin;

    @BeforeEach
    void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname, role) VALUES (1, 'tester01', ?, '회원하나', 'USER'), (2, 'tester02', ?, '회원둘', 'USER'), (9, 'admin001', ?, '운영자', 'ADMIN')",
            hash, hash, hash);
        one = login("tester01");
        two = login("tester02");
        admin = login("admin001");
    }

    @Test
    void placeCategoriesAndPlaces() throws Exception {
        assertEquals("[{icon:s,id:s,name:s}]", shape(call(get("/api/places/categories"), one, null, 200)));
        // 리뷰가 없는 장소: 주소 · 전화 · 영업시간 · 별점이 null 로 와야 함
        assertEquals("[{address:null,category:s,description:s,id:s,lat:f,lon:f,name:s,openHours:null,phone:null,rating:null,reviewCount:i,walkMin:i}]",
            shape(call(get("/api/places").param("regionId", "2"), one, null, 200)));
        call(post("/api/places/10/reviews"), two, "{\"rating\":4}", 204);
        // 리뷰가 생기면 별점은 소수
        assertEquals("[{address:null,category:s,description:s,id:s,lat:f,lon:f,name:s,openHours:null,phone:null,rating:f,reviewCount:i,walkMin:i}]",
            shape(call(get("/api/places").param("regionId", "2"), one, null, 200)));
    }

    @Test
    void aiSearch() throws Exception {
        assertEquals("[{place:{address:null,category:s,description:s,id:s,lat:f,lon:f,name:s,openHours:null,phone:null,rating:null,reviewCount:i,walkMin:i},reasons:[s],walkMin:i}]",
            shape(call(post("/api/places/ai-search"), one, "{\"q\":\"편의점\",\"regionId\":\"2\"}", 200)));
    }

    @Test
    void placeListsAndKakaoFavorites() throws Exception {
        assertEquals("{color:s,id:s,name:s,placeIds:[]}",
            shape(call(post("/api/me/place-lists"), one, "{\"name\":\"맛집\",\"color\":\"#ff0000\"}", 201)));
        call(put("/api/me/place-favorites/kakao:777"), one, "{\"name\":\"카페\",\"category\":\"편의점\"}", 204);
        assertEquals("[{color:s,id:s,name:s,placeIds:[s]}]", shape(call(get("/api/me/place-lists"), one, null, 200)));
        assertEquals("[{category:s,id:s,name:s}]", shape(call(get("/api/me/place-favorites/kakao"), one, null, 200)));
    }

    @Test
    void reviewsSummaryAndAdminReports() throws Exception {
        long photo = file(1, "aaaaaaaa-0000-0000-0000-000000000123");
        call(post("/api/places/10/reviews"), one, "{\"rating\":5,\"body\":\"깨끗해요\",\"photoIds\":[\"" + photo + "\"]}", 204);
        call(post("/api/places/kakao:777/reviews"), one, "{\"rating\":3,\"name\":\"카페\"}", 204);
        assertEquals("[{author:{avatarColor:null,avatarEmoji:null,avatarUrl:null,id:s,nickname:s,ratingAvg:f,reviewCount:i},body:s,createdAt:s,id:s,photos:[{id:s,url:s}],rating:i,reportedByMe:b}]",
            shape(call(get("/api/places/10/reviews"), two, null, 200)));
        assertEquals("[{count:i,id:s,rating:f}]",
            shape(call(get("/api/places/review-summary").param("ids", "10,kakao:777"), one, null, 200)));

        String reviewId = jdbc.queryForObject("SELECT id FROM place_reviews WHERE user_id = 1", Long.class).toString();
        call(post("/api/places/10/reviews/" + reviewId + "/reports"), two, "{\"reason\":\"ABUSE\"}", 204);
        String reports = call(get("/api/admin/place-review-reports"), admin, null, 200);
        assertEquals("[{createdAt:s,detail:s,id:s,placeId:s,placeName:s,reason:s,reporter:{id:s,nickname:s},review:{author:s,deleted:b,rating:i,text:s},reviewId:s,reviewKind:s,status:s}]",
            shape(reports));
        // 리뷰를 지운 뒤에도 신고 당시 내용(별점 포함)은 남고 deleted 만 true
        String reportId = json.readTree(reports).get(0).get("id").asString();
        call(patch("/api/admin/place-review-reports/" + reportId), admin, "{\"status\":\"HIDDEN\"}", 204);
        String afterHide = call(get("/api/admin/place-review-reports"), admin, null, 200);
        assertEquals(shape(reports), shape(afterHide));
        assertEquals(true, json.readTree(afterHide).get(0).get("review").get("deleted").asBoolean());
        assertEquals("HIDDEN", json.readTree(afterHide).get(0).get("status").asString());
    }

    // ---------- 도우미 ----------

    /** JSON → 모양 한 줄. 객체는 칸 이름 순, 목록은 원소 모양을 모아서 */
    private String shape(String body) throws Exception { return shape(json.readTree(body)); }

    private static String shape(JsonNode node) {
        if (node.isObject()) {
            var fields = new TreeMap<String, String>();
            node.properties().forEach(e -> fields.put(e.getKey(), shape(e.getValue())));
            var parts = new ArrayList<String>();
            fields.forEach((k, v) -> parts.add(k + ":" + v));
            return "{" + String.join(",", parts) + "}";
        }
        if (node.isArray()) {
            var kinds = new LinkedHashSet<String>();
            for (JsonNode item : node) kinds.add(shape(item));
            return "[" + String.join("|", kinds) + "]";
        }
        if (node.isNull()) return "null";
        if (node.isBoolean()) return "b";
        if (node.isIntegralNumber()) return "i";
        if (node.isNumber()) return "f";
        return "s";
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.accessToken");
    }

    private String call(MockHttpServletRequestBuilder request, String token, String body, int expected) throws Exception {
        request.header("Authorization", "Bearer " + token);
        if (body != null) request.contentType("application/json").content(body);
        var response = mvc.perform(request).andReturn().getResponse();
        assertEquals(expected, response.getStatus(), response.getContentAsString());
        return response.getContentAsString();
    }

    private long file(long userId, String key) {
        jdbc.update("INSERT INTO uploaded_files (user_id, original_name, storage_url, mime_type, size_bytes) VALUES (?, 'a.jpg', ?, 'image/jpeg', 100)",
            userId, "/api/files/content/" + key + ".jpg");
        return jdbc.queryForObject("SELECT MAX(id) FROM uploaded_files", Long.class);
    }
}

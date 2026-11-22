package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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

/** 장소 리뷰: 쓰기 · 고치기 · 지우기, 목록 별점 요약, 신고 → 관리자 삭제 · 기각 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/map-favorites-fixture.sql"})
class PlaceReviewIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired com.zip.backend.files.ProfileFileService files;

    @BeforeEach void seed() {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname, role) VALUES (1, 'tester01', ?, '회원하나', 'USER'), (2, 'tester02', ?, '회원둘', 'USER'), (9, 'admin001', ?, '운영자', 'ADMIN')",
            hash, hash, hash);
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.accessToken");
    }

    private ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token, String body) throws Exception {
        request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private Integer count(String sql) { return jdbc.queryForObject(sql, Integer.class); }

    @Test void myReviewsCombinesPlaceKindsAndExcludesOtherUsers() throws Exception {
        String one = login("tester01"), two = login("tester02");
        call(post("/api/places/10/reviews"), one, "{\"rating\":3,\"body\":\"내 장소 후기\"}").andExpect(status().isNoContent());
        call(post("/api/places/kakao:777/reviews"), one, "{\"rating\":5,\"name\":\"카페\"}").andExpect(status().isNoContent());
        call(post("/api/places/kakao:888/reviews"), two, "{\"rating\":1,\"name\":\"다른 장소\"}").andExpect(status().isNoContent());
        call(get("/api/places/reviews/mine"), one, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[?(@.placeId == 'kakao:777')].placeName").value(org.hamcrest.Matchers.contains("카페")))
            .andExpect(jsonPath("$[?(@.placeId == '10')].body").value(org.hamcrest.Matchers.contains("내 장소 후기")));
        call(delete("/api/places/10/reviews/mine"), one, null).andExpect(status().isNoContent());
        call(get("/api/places/reviews/mine"), one, null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/places/reviews/mine")).andExpect(status().isUnauthorized());
    }

    @Test void writeEditDeleteMyReviewOnDbPlaceKeepsRatingInSync() throws Exception {
        String one = login("tester01"), two = login("tester02");
        call(post("/api/places/{id}/reviews", "10"), one, "{\"rating\":5,\"body\":\"깨끗해요\"}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews", "10"), two, "{\"rating\":2}").andExpect(status().isNoContent());
        assertEquals(35, count("SELECT CAST(rating_avg * 10 AS INT) FROM places WHERE id = 10"));
        // 고치기: 내 리뷰만 바뀌고 평균 · 수가 다시 계산됨
        call(put("/api/places/{id}/reviews/mine", "10"), one, "{\"rating\":3,\"body\":\"  보통이에요  \"}").andExpect(status().isNoContent());
        assertEquals("보통이에요", jdbc.queryForObject("SELECT body FROM place_reviews WHERE user_id = 1", String.class));
        assertEquals(25, count("SELECT CAST(rating_avg * 10 AS INT) FROM places WHERE id = 10"));
        // 지우기
        call(delete("/api/places/{id}/reviews/mine", "10"), one, null).andExpect(status().isNoContent());
        assertEquals(1, count("SELECT review_count FROM places WHERE id = 10"));
        call(delete("/api/places/{id}/reviews/mine", "10"), one, null).andExpect(status().isNotFound());
        call(put("/api/places/{id}/reviews/mine", "10"), one, "{\"rating\":4}").andExpect(status().isNotFound());
        // 지운 뒤에는 다시 쓸 수 있음
        call(post("/api/places/{id}/reviews", "10"), one, "{\"rating\":4}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews", "999"), one, "{\"rating\":4}").andExpect(status().isNotFound());
    }

    private long file(long userId, String key) {
        jdbc.update("INSERT INTO uploaded_files (user_id, original_name, storage_url, mime_type, size_bytes) VALUES (?, 'a.jpg', ?, 'image/jpeg', 100)",
            userId, "/api/files/content/" + key + ".jpg");
        return jdbc.queryForObject("SELECT MAX(id) FROM uploaded_files", Long.class);
    }

    @Test void failedReviewCanReusePhotoAndDiscardProtectsRegisteredPhotos() throws Exception {
        String one = login("tester01"), two = login("tester02");
        long id = file(1, "aaaaaaaa-0000-0000-0000-000000000099");
        String input = "{\"rating\":5,\"photoIds\":[\"" + id + "\"]}";
        call(post("/api/places/999/reviews"), one, input).andExpect(status().isNotFound());
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + id + " AND deleted_at IS NULL"));
        call(delete("/api/files/{id}/unused", id), two, null).andExpect(status().isNoContent());
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + id + " AND deleted_at IS NULL"));
        call(post("/api/places/10/reviews"), one, input).andExpect(status().isNoContent());
        call(delete("/api/files/{id}/unused", id), one, null).andExpect(status().isNoContent());
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + id + " AND deleted_at IS NULL"));
        long unused = file(1, "aaaaaaaa-0000-0000-0000-000000000098");
        call(delete("/api/files/{id}/unused", unused), one, null).andExpect(status().isNoContent());
        call(delete("/api/files/{id}/unused", unused), one, null).andExpect(status().isNoContent());
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + unused + " AND deleted_at IS NOT NULL"));
        long abandoned = file(1, "aaaaaaaa-0000-0000-0000-000000000097");
        jdbc.update("UPDATE uploaded_files SET created_at = ? WHERE id IN (?, ?)",
            java.sql.Timestamp.valueOf("2000-01-01 00:00:00"), abandoned, id);
        files.cleanupUnusedUploads();
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + abandoned + " AND deleted_at IS NOT NULL"));
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + id + " AND deleted_at IS NULL"));
    }

    @Test void photosAuthorInfoAndCleanup() throws Exception {
        String one = login("tester01"), two = login("tester02");
        long a = file(1, "aaaaaaaa-0000-0000-0000-000000000001"), b = file(1, "aaaaaaaa-0000-0000-0000-000000000002"), other = file(2, "bbbbbbbb-0000-0000-0000-000000000001");
        // 남의 사진 · 6장 · 같은 사진 두 번은 안 됨
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"name\":\"국밥\",\"photoIds\":[\"" + other + "\"]}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"name\":\"국밥\",\"photoIds\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\"]}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"name\":\"국밥\",\"photoIds\":[\"" + a + "\",\"" + a + "\"]}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"body\":\"존맛\",\"name\":\"국밥\",\"photoIds\":[\"" + b + "\",\"" + a + "\"]}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews", "10"), one, "{\"rating\":3}").andExpect(status().isNoContent());
        call(get("/api/places/{id}/reviews", "kakao:777"), two, null).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].photos.length()").value(2))
            .andExpect(jsonPath("$[0].photos[0].id").value(Long.toString(b)))
            .andExpect(jsonPath("$[0].photos[1].url").value("/api/files/content/aaaaaaaa-0000-0000-0000-000000000001.jpg"))
            .andExpect(jsonPath("$[0].author.reviewCount").value(2))
            .andExpect(jsonPath("$[0].author.ratingAvg").value(4.0));
        // 이미 리뷰에 쓴 사진은 다른 리뷰에 못 붙임
        call(post("/api/places/{id}/reviews", "kakao:888"), one, "{\"rating\":4,\"name\":\"카페\",\"photoIds\":[\"" + a + "\"]}").andExpect(status().isBadRequest());
        // 고치기에서 빠진 사진은 지운 것으로 표시
        call(put("/api/places/{id}/reviews/mine", "kakao:777"), one, "{\"rating\":4,\"photoIds\":[\"" + a + "\"]}").andExpect(status().isNoContent());
        assertEquals(1, count("SELECT COUNT(*) FROM place_review_photos"));
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + b + " AND deleted_at IS NOT NULL"));
        // 리뷰를 지우면 사진도
        call(delete("/api/places/{id}/reviews/mine", "kakao:777"), one, null).andExpect(status().isNoContent());
        assertEquals(0, count("SELECT COUNT(*) FROM place_review_photos"));
        assertEquals(1, count("SELECT COUNT(*) FROM uploaded_files WHERE id = " + a + " AND deleted_at IS NOT NULL"));
    }

    @Test void editAndDeleteKakaoReview() throws Exception {
        String one = login("tester01");
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"body\":\"존맛\",\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        call(put("/api/places/{id}/reviews/mine", "kakao:777"), one, "{\"rating\":4,\"body\":\"맛있어요\"}").andExpect(status().isNoContent());
        call(get("/api/places/{id}/reviews", "kakao:777"), one, null).andExpect(jsonPath("$[0].rating").value(4)).andExpect(jsonPath("$[0].body").value("맛있어요"));
        call(put("/api/places/{id}/reviews/mine", "kakao:777"), one, "{\"rating\":0}").andExpect(status().isBadRequest());
        call(delete("/api/places/{id}/reviews/mine", "kakao:777"), one, null).andExpect(status().isNoContent());
        assertEquals(0, count("SELECT COUNT(*) FROM kakao_place_reviews"));
    }

    @Test void summaryOfDbAndKakaoPlaces() throws Exception {
        String one = login("tester01"), two = login("tester02");
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":5,\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews", "kakao:777"), two, "{\"rating\":4,\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews", "10"), one, "{\"rating\":3,\"body\":\"보통\"}").andExpect(status().isNoContent());
        call(get("/api/places/review-summary").param("ids", "10,kakao:777,kakao:1,abc,kakao:x"), one, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[?(@.id == 'kakao:777')].rating").value(4.5))
            .andExpect(jsonPath("$[?(@.id == 'kakao:777')].count").value(2))
            .andExpect(jsonPath("$[?(@.id == '10')].count").value(1));
        call(get("/api/places/review-summary").param("ids", String.join(",", java.util.Collections.nCopies(101, "kakao:1"))), one, null).andExpect(status().isBadRequest());
    }

    @Test void reportThenAdminDeletesReview() throws Exception {
        String one = login("tester01"), two = login("tester02"), admin = login("admin001");
        call(post("/api/places/{id}/reviews", "kakao:777"), one, "{\"rating\":1,\"body\":\"나쁜 말\",\"name\":\"동네 국밥\"}").andExpect(status().isNoContent());
        long reviewId = jdbc.queryForObject("SELECT id FROM kakao_place_reviews", Long.class);
        // 내 리뷰는 신고 못 함, 사유 필수, 기타는 내용 필수, 다른 장소 번호로는 못 찾음
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:777", reviewId), one, "{\"reason\":\"ABUSE\"}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:777", reviewId), two, "{}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:777", reviewId), two, "{\"reason\":\"OTHER\"}").andExpect(status().isBadRequest());
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:1", reviewId), two, "{\"reason\":\"ABUSE\"}").andExpect(status().isNotFound());
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:777", reviewId), two, "{\"reason\":\"ABUSE\",\"detail\":\"욕설\"}").andExpect(status().isNoContent());
        call(post("/api/places/{id}/reviews/{r}/reports", "kakao:777", reviewId), two, "{\"reason\":\"ABUSE\"}").andExpect(status().isConflict());
        call(get("/api/places/{id}/reviews", "kakao:777"), two, null).andExpect(jsonPath("$[0].reportedByMe").value(true));
        call(get("/api/places/{id}/reviews", "kakao:777"), one, null).andExpect(jsonPath("$[0].reportedByMe").value(false));
        // 일반 회원은 관리자 신고 목록을 못 봄
        call(get("/api/admin/place-review-reports"), two, null).andExpect(status().isForbidden());
        String list = call(get("/api/admin/place-review-reports").param("status", "RECEIVED"), admin, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].placeName").value("동네 국밥"))
            .andExpect(jsonPath("$[0].review.text").value("나쁜 말"))
            .andExpect(jsonPath("$[0].review.author").value("회원하나"))
            .andExpect(jsonPath("$[0].review.deleted").value(false))
            .andReturn().getResponse().getContentAsString();
        String reportId = com.jayway.jsonpath.JsonPath.read(list, "$[0].id");
        call(patch("/api/admin/place-review-reports/{id}", reportId), admin, "{\"status\":\"WRONG\"}").andExpect(status().isBadRequest());
        call(patch("/api/admin/place-review-reports/{id}", reportId), admin, "{\"status\":\"HIDDEN\"}").andExpect(status().isNoContent());
        assertEquals(0, count("SELECT COUNT(*) FROM kakao_place_reviews"));
        assertEquals(1, count("SELECT COUNT(*) FROM notifications WHERE user_id = 1 AND noti_type = 'SYSTEM'"));
        call(get("/api/admin/place-review-reports"), admin, null).andExpect(jsonPath("$[0].status").value("HIDDEN"))
            .andExpect(jsonPath("$[0].review.deleted").value(true)).andExpect(jsonPath("$[0].review.text").value("나쁜 말"));
    }

    @Test void adminDismissKeepsReviewAndRecountsDbPlace() throws Exception {
        String one = login("tester01"), two = login("tester02"), admin = login("admin001");
        call(post("/api/places/{id}/reviews", "10"), one, "{\"rating\":2,\"body\":\"그냥 그래요\"}").andExpect(status().isNoContent());
        long reviewId = jdbc.queryForObject("SELECT id FROM place_reviews", Long.class);
        call(post("/api/places/{id}/reviews/{r}/reports", "10", reviewId), two, "{\"reason\":\"FALSE_INFO\"}").andExpect(status().isNoContent());
        long reportId = jdbc.queryForObject("SELECT id FROM place_review_reports", Long.class);
        call(patch("/api/admin/place-review-reports/{id}", reportId), admin, "{\"status\":\"DISMISSED\"}").andExpect(status().isNoContent());
        assertEquals(1, count("SELECT COUNT(*) FROM place_reviews"));
        assertEquals("DISMISSED", jdbc.queryForObject("SELECT status FROM place_review_reports", String.class));
        // 새 신고 → 삭제하면 DB 장소 평균 · 수도 0 으로
        jdbc.update("UPDATE place_review_reports SET status = 'RECEIVED'");
        call(patch("/api/admin/place-review-reports/{id}", reportId), admin, "{\"status\":\"HIDDEN\"}").andExpect(status().isNoContent());
        assertEquals(0, count("SELECT review_count FROM places WHERE id = 10"));
    }
}

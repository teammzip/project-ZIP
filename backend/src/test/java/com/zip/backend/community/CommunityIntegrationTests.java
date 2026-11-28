package com.zip.backend.community;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 커뮤니티 API (frontend/API.md 7장): 글 · 범위 · 댓글 · 공감 · 신고 · 첨부 · 홈 꿀팁 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/community-fixture.sql"})
class CommunityIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;

    /** 1 = 마포구(2), 2 = 용산구(3, 마포구 이웃), 3 = 동네 없음 */
    @BeforeEach void seed() {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, region_id, region_verified_at) VALUES
            (1, 'mapo01', ?, '마포주민', 2, CURRENT_TIMESTAMP), (2, 'yongsan1', ?, '용산주민', 3, CURRENT_TIMESTAMP), (3, 'nowhere1', ?, '동네없음', NULL, NULL)
            """, hash, hash, hash);
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private ResultActions call(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
        request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private String write(String token, String category, String title, String body) throws Exception {
        String response = call(token, post("/api/posts"), "{\"category\":\"" + category + "\",\"title\":\"" + title + "\",\"body\":\"" + body + "\"}")
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    @Test void myPostCountUsesTheSignedInAccountAcrossLogins() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1");
        String visible = write(mapo, "FREE", "첫 번째 글", "내용");
        String hidden = write(mapo, "TIP", "숨김 글", "내용");
        String deleted = write(mapo, "FREE", "삭제한 글", "내용");
        write(mapo, "TOWN", "두 번째 글", "내용");
        write(yongsan, "TIP", "다른 회원 글", "내용");
        jdbc.update("UPDATE posts SET status = 'HIDDEN' WHERE id = ?", Long.parseLong(hidden));
        call(mapo, delete("/api/posts/{id}", deleted), null).andExpect(status().isNoContent());
        call(yongsan, post("/api/posts/{id}/comments", visible), "{\"body\":\"댓글이에요\"}").andExpect(status().isCreated());

        String path = "/api/posts/my-count";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        call(mapo, get(path).param("userId", "2"), null).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        call(yongsan, get(path), null).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        String secondMapoLogin = login("mapo01");
        call(secondMapoLogin, get(path), null).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        call(login("nowhere1"), get(path), null).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));

        call(secondMapoLogin, delete("/api/posts/{id}", visible), null).andExpect(status().isNoContent());
        call(secondMapoLogin, get(path), null).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
    }

    @Test void neighborsShowMyRegionAndNeighborNames() throws Exception {
        // 마포구(2) 이웃: 용산구(3, community-fixture) + 다른 시 · 도의 고양시 → 같은 시 · 도 먼저
        jdbc.update("INSERT INTO regions (id, parent_id, name, level) VALUES (20, NULL, '경기도', 1), (21, 20, '고양시', 2)");
        jdbc.update("INSERT INTO region_neighbors VALUES (2, 21), (21, 2)");
        call(login("mapo01"), get("/api/posts/neighbors"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.region.id").value("2")).andExpect(jsonPath("$.region.name").value("마포구"))
            .andExpect(jsonPath("$.region.sido").value("서울특별시"))
            .andExpect(jsonPath("$.neighbors.length()").value(2))
            .andExpect(jsonPath("$.neighbors[0].name").value("용산구")).andExpect(jsonPath("$.neighbors[0].sido").value("서울특별시"))
            .andExpect(jsonPath("$.neighbors[1].name").value("고양시")).andExpect(jsonPath("$.neighbors[1].sido").value("경기도"));
        // 동네가 없으면 region 은 null, 이웃도 없음
        call(login("nowhere1"), get("/api/posts/neighbors"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.region").isEmpty()).andExpect(jsonPath("$.neighbors.length()").value(0));
        mvc.perform(get("/api/posts/neighbors")).andExpect(status().isUnauthorized());
    }

    @Test void writeReadAndScopes() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1"), nowhere = login("nowhere1");
        String id = write(mapo, "TIP", "  곰팡이 제거 꿀팁 ", "락스 희석해서 닦아요");
        write(yongsan, "FREE", "용산 이야기", "안녕하세요");

        call(mapo, get("/api/posts/{id}", id), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("곰팡이 제거 꿀팁")).andExpect(jsonPath("$.category").value("TIP"))
            .andExpect(jsonPath("$.region.name").value("서울특별시 마포구")).andExpect(jsonPath("$.author.nickname").value("마포주민"))
            .andExpect(jsonPath("$.mine").value(true)).andExpect(jsonPath("$.comments.length()").value(0))
            .andExpect(jsonPath("$.attachments.length()").value(0));
        call(yongsan, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.mine").value(false));

        call(mapo, get("/api/posts").param("scope", "here"), null).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].title").value("곰팡이 제거 꿀팁")).andExpect(jsonPath("$.hasNext").value(false));
        call(mapo, get("/api/posts").param("scope", "near"), null).andExpect(jsonPath("$.items.length()").value(2));
        call(mapo, get("/api/posts").param("scope", "all").param("category", "FREE"), null).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].title").value("용산 이야기"));
        call(mapo, get("/api/posts").param("q", "락스"), null).andExpect(jsonPath("$.items.length()").value(1));
        // 동네가 없으면 우리 동네 글은 비어 있고, 글쓰기는 막힘
        call(nowhere, get("/api/posts").param("scope", "here"), null).andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.hasNext").value(false));
        call(nowhere, get("/api/posts").param("scope", "all"), null).andExpect(jsonPath("$.items.length()").value(2));
        call(nowhere, post("/api/posts"), "{\"category\":\"FREE\",\"title\":\"제목\",\"body\":\"내용\"}")
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REGION_REQUIRED"));
    }

    @Test void searchPagePreservesSortedRowsAndOmitsDetailFields() throws Exception {
        String mapo = login("mapo01");
        for (int id = 1; id <= 21; id++) {
            jdbc.update("""
                INSERT INTO posts (id,user_id,region_id,category,title,body,view_count)
                VALUES (?,1,2,'TIP','곰팡이 제거','청소 방법',?)
                """, id, 22 - id);
        }

        call(mapo, get("/api/posts").param("scope", "here").param("category", "TIP")
            .param("q", "곰팡이 청소").param("sort", "views"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.hasNext").value(true))
            .andExpect(jsonPath("$.items.length()").value(20))
            .andExpect(jsonPath("$.items[0].id").value("1")).andExpect(jsonPath("$.items[0].views").value(21))
            .andExpect(jsonPath("$.items[0].comments").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.items[0].attachments").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.items[19].id").value("20"));
        call(mapo, get("/api/posts").param("scope", "here").param("category", "TIP")
            .param("q", "곰팡이 청소").param("sort", "views").param("page", "1"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.hasNext").value(false))
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value("21"));
    }

    @Test void invalidInputIsRejected() throws Exception {
        String mapo = login("mapo01");
        for (String body : new String[] {"{}", "{\"category\":\"NEWS\",\"title\":\"t\",\"body\":\"b\"}",
            "{\"category\":\"FREE\",\"title\":\"   \",\"body\":\"b\"}", "{\"category\":\"FREE\",\"title\":\"" + "가".repeat(101) + "\",\"body\":\"b\"}",
            "{\"category\":\"FREE\",\"title\":\"t\",\"body\":\"" + "가".repeat(2001) + "\"}", "{\"category\":\"FREE\",\"title\":\"a\\nb\",\"body\":\"b\"}"}) {
            call(mapo, post("/api/posts"), body).andExpect(status().isBadRequest());
        }
        call(mapo, get("/api/posts").param("scope", "city"), null).andExpect(status().isBadRequest());
        call(mapo, get("/api/posts/{id}", "abc"), null).andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM posts", Integer.class));
    }

    @Test void onlyAuthorCanEditOrDeleteAndDeletedPostsDisappear() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1");
        String id = write(mapo, "FREE", "원래 제목", "내용");
        call(yongsan, patch("/api/posts/{id}", id), "{\"category\":\"FREE\",\"title\":\"바꿈\",\"body\":\"x\"}").andExpect(status().isForbidden());
        call(yongsan, delete("/api/posts/{id}", id), null).andExpect(status().isForbidden());
        call(mapo, patch("/api/posts/{id}", id), "{\"category\":\"QUESTION\",\"title\":\"고친 제목\",\"body\":\"고친 내용\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("고친 제목")).andExpect(jsonPath("$.category").value("QUESTION"));
        call(mapo, delete("/api/posts/{id}", id), null).andExpect(status().isNoContent());
        // 본인 삭제: 지운 사람 = 본인, 사유 없음
        assertEquals(1L, jdbc.queryForObject("SELECT deleted_by FROM posts", Long.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM posts WHERE delete_reason IS NOT NULL", Integer.class));
        call(mapo, get("/api/posts/{id}", id), null).andExpect(status().isNotFound());
        call(mapo, get("/api/posts"), null).andExpect(jsonPath("$.items.length()").value(0));
        assertEquals("DELETED", jdbc.queryForObject("SELECT status FROM posts", String.class));
    }

    @Test void likesAndCommentsKeepCounts() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1");
        String id = write(mapo, "FREE", "공감 테스트", "내용");
        call(yongsan, put("/api/posts/{id}/like", id), null).andExpect(jsonPath("$.liked").value(true)).andExpect(jsonPath("$.likes").value(1));
        call(yongsan, put("/api/posts/{id}/like", id), null).andExpect(jsonPath("$.likes").value(1)); // 두 번 눌러도 한 번
        call(mapo, put("/api/posts/{id}/like", id), null).andExpect(jsonPath("$.likes").value(2));
        call(yongsan, delete("/api/posts/{id}/like", id), null).andExpect(jsonPath("$.liked").value(false)).andExpect(jsonPath("$.likes").value(1));
        call(yongsan, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.liked").value(false));

        String response = call(yongsan, post("/api/posts/{id}/comments", id), "{\"body\":\" 감사해요! \"}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.body").value("감사해요!")).andExpect(jsonPath("$.mine").value(true))
            .andExpect(jsonPath("$.parentId").value(org.hamcrest.Matchers.nullValue()))
            .andReturn().getResponse().getContentAsString();
        String commentId = JsonPath.read(response, "$.id");
        call(mapo, post("/api/posts/{id}/comments", id), "{\"body\":\"고마워요\"}").andExpect(status().isCreated());
        call(mapo, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.commentCount").value(2))
            .andExpect(jsonPath("$.comments[0].body").value("감사해요!")).andExpect(jsonPath("$.comments[0].mine").value(false));
        call(mapo, patch("/api/comments/{id}", commentId), "{\"body\":\"남의 댓글\"}").andExpect(status().isForbidden());
        call(yongsan, patch("/api/comments/{id}", commentId), "{\"body\":\"고친 댓글\"}").andExpect(jsonPath("$.body").value("고친 댓글"));
        call(yongsan, post("/api/posts/{id}/comments", id), "{\"body\":\"" + "가".repeat(201) + "\"}").andExpect(status().isBadRequest());
        call(yongsan, delete("/api/comments/{id}", commentId), null).andExpect(status().isNoContent());
        call(mapo, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.commentCount").value(1)).andExpect(jsonPath("$.comments.length()").value(1));
    }

    @Test void reportsCopyTargetAndBlockDuplicatesAndOwnTargets() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1");
        String id = write(mapo, "FREE", "광고 글", "사세요");
        call(yongsan, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + id + "\",\"reason\":\"AD_ILLEGAL\",\"detail\":\"\"}")
            .andExpect(status().isNoContent());
        assertEquals("광고 글", jdbc.queryForObject("SELECT target_text_snapshot FROM reports", String.class));
        assertEquals("마포주민", jdbc.queryForObject("SELECT target_author_snapshot FROM reports", String.class));
        call(yongsan, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.reported").value(true));
        call(yongsan, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + id + "\",\"reason\":\"ABUSE\"}").andExpect(status().isConflict());
        call(mapo, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + id + "\",\"reason\":\"ABUSE\"}").andExpect(status().isBadRequest());
        call(yongsan, post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":\"999\",\"reason\":\"ABUSE\"}").andExpect(status().isNotFound());
        String commentId = JsonPath.read(call(mapo, post("/api/posts/{id}/comments", id), "{\"body\":\"욕설\"}").andReturn().getResponse().getContentAsString(), "$.id");
        call(yongsan, post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":\"" + commentId + "\",\"reason\":\"OTHER\"}").andExpect(status().isBadRequest());
        call(yongsan, post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":\"" + commentId + "\",\"reason\":\"OTHER\",\"detail\":\"불쾌해요\"}")
            .andExpect(status().isNoContent());
        call(yongsan, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.comments[0].reported").value(true));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM reports", Integer.class));
    }

    @Test void attachmentsMustBeMyImagesAndRemovedOnesAreDeleted() throws Exception {
        String mapo = login("mapo01");
        jdbc.update("""
            INSERT INTO uploaded_files (id, user_id, original_name, storage_url, mime_type, size_bytes) VALUES
            (40, 1, 'a.png', '/api/files/content/a', 'image/png', 1000), (41, 1, 'b.jpg', '/api/files/content/b', 'image/jpeg', 2000),
            (42, 2, 'other.png', '/api/files/content/c', 'image/png', 1000), (43, 1, 'big.png', '/api/files/content/d', 'image/png', 3000000)
            """);
        String id = JsonPath.read(call(mapo, post("/api/posts"), "{\"category\":\"TIP\",\"title\":\"사진\",\"body\":\"전후\",\"attachmentIds\":[\"41\",\"40\"]}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.attachments[0].id").value("41")).andExpect(jsonPath("$.attachments[1].name").value("a.png"))
            .andReturn().getResponse().getContentAsString(), "$.id");
        call(mapo, post("/api/posts"), "{\"category\":\"TIP\",\"title\":\"남의 파일\",\"body\":\"x\",\"attachmentIds\":[\"42\"]}").andExpect(status().isBadRequest());
        call(mapo, post("/api/posts"), "{\"category\":\"TIP\",\"title\":\"재사용\",\"body\":\"x\",\"attachmentIds\":[\"40\"]}").andExpect(status().isBadRequest());
        call(mapo, post("/api/posts"), "{\"category\":\"TIP\",\"title\":\"큰 파일\",\"body\":\"x\",\"attachmentIds\":[\"43\"]}").andExpect(status().isBadRequest());
        // 수정에서 뺀 첨부는 연결이 끊기고 지운 것으로 표시
        call(mapo, patch("/api/posts/{id}", id), "{\"category\":\"TIP\",\"title\":\"사진\",\"body\":\"전후\",\"attachmentIds\":[\"40\"]}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachments.length()").value(1));
        assertNotNull(jdbc.queryForObject("SELECT deleted_at FROM uploaded_files WHERE id = 41", java.sql.Timestamp.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM post_attachments", Integer.class));
    }

    @Test void ranksVisiblePostsFromTheViewersRegionByViews() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1"), nowhere = login("nowhere1");
        String first = write(mapo, "FREE", "가장 많이 본 글", "내용");
        String older = write(mapo, "TIP", "이전 글", "내용");
        String newer = write(mapo, "QUESTION", "새 글", "내용");
        write(mapo, "TOWN", "조회 없는 글", "내용");
        String hidden = write(mapo, "TIP", "숨긴 글", "내용");
        String other = write(yongsan, "TIP", "다른 동네 글", "내용");
        jdbc.update("UPDATE posts SET view_count = 50 WHERE id IN (?, ?)", Long.parseLong(hidden), Long.parseLong(other));
        jdbc.update("UPDATE posts SET created_at = '2026-01-01 00:00:00' WHERE id = ?", Long.parseLong(older));
        call(mapo, delete("/api/posts/{id}", hidden), null).andExpect(status().isNoContent());

        mvc.perform(post("/api/posts/{id}/views", first)).andExpect(status().isUnauthorized());
        call(mapo, post("/api/posts/{id}/views", hidden), null).andExpect(status().isNotFound());
        call(mapo, get("/api/posts/{id}", first), null).andExpect(jsonPath("$.views").value(0));
        for (String id : new String[] {first, first, newer, older}) {
            call(mapo, post("/api/posts/{id}/views", id), null).andExpect(status().isNoContent());
        }
        call(mapo, get("/api/posts/popular"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].id").value(first)).andExpect(jsonPath("$[0].views").value(2))
            .andExpect(jsonPath("$[1].id").value(newer)).andExpect(jsonPath("$[2].id").value(older));
        call(nowhere, get("/api/posts/popular"), null).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void repliesAreOneLevelDeepAndStayWithTheirPost() throws Exception {
        String mapo = login("mapo01"), yongsan = login("yongsan1");
        String id = write(mapo, "QUESTION", "세탁방 추천", "어디가 좋아요?");
        String other = write(mapo, "FREE", "다른 글", "내용");
        String top = JsonPath.read(call(yongsan, post("/api/posts/{id}/comments", id), "{\"body\":\"합정역 근처요\"}")
            .andReturn().getResponse().getContentAsString(), "$.id");
        String reply = JsonPath.read(call(mapo, post("/api/posts/{id}/comments", id), "{\"body\":\"감사해요!\",\"parentId\":\"" + top + "\"}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.parentId").value(top)).andReturn().getResponse().getContentAsString(), "$.id");
        // 답글에 단 답글은 같은 묶음(맨 위 댓글)으로
        call(yongsan, post("/api/posts/{id}/comments", id), "{\"body\":\"천만에요\",\"parentId\":\"" + reply + "\"}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.parentId").value(top));
        call(mapo, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.commentCount").value(3))
            .andExpect(jsonPath("$.comments[0].parentId").isEmpty()).andExpect(jsonPath("$.comments[2].parentId").value(top));
        // 다른 글의 댓글 · 없는 댓글에는 답글 불가
        call(mapo, post("/api/posts/{id}/comments", other), "{\"body\":\"x\",\"parentId\":\"" + top + "\"}").andExpect(status().isBadRequest());
        call(mapo, post("/api/posts/{id}/comments", id), "{\"body\":\"x\",\"parentId\":\"99999\"}").andExpect(status().isNotFound());
        // 맨 위 댓글을 지워도 답글은 남음 (화면은 "삭제된 댓글"로 묶어 보여 줌)
        call(yongsan, delete("/api/comments/{id}", top), null).andExpect(status().isNoContent());
        call(mapo, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.comments.length()").value(2))
            .andExpect(jsonPath("$.comments[0].parentId").value(top));
    }
}

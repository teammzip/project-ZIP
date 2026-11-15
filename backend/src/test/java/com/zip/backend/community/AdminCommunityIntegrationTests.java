package com.zip.backend.community;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

/** 관리자 커뮤니티 관리: 게시글 목록 · 삭제 · 운영자 댓글 · 홈 꿀팁 · 신고 처리 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/community-fixture.sql"})
class AdminCommunityIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String member, reporter, admin;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, region_id, role, region_verified_at) VALUES
            (1, 'mapo01', ?, '마포주민', 2, 'USER', CURRENT_TIMESTAMP), (2, 'yongsan1', ?, '용산주민', 3, 'USER', CURRENT_TIMESTAMP), (9, 'admin01', ?, '운영자', NULL, 'ADMIN', NULL)
            """, hash, hash, hash);
        member = login("mapo01");
        reporter = login("yongsan1");
        admin = login("admin01");
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

    private String json(ResultActions result, String path) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), path);
    }

    private String writePost(String title) throws Exception {
        return json(call(member, post("/api/posts"), "{\"category\":\"FREE\",\"title\":\"" + title + "\",\"body\":\"내용\"}").andExpect(status().isCreated()), "$.id");
    }

    @Test void onlyAdminsCanUseAdminApi() throws Exception {
        call(member, get("/api/admin/posts"), null).andExpect(status().isForbidden());
        call(member, get("/api/admin/reports"), null).andExpect(status().isForbidden());
        call(admin, get("/api/admin/posts"), null).andExpect(status().isOk());
    }

    @Test void adminSeesPostsWithCommentsAndStaffCommentIsMarked() throws Exception {
        String id = writePost("질문 있어요");
        call(reporter, post("/api/posts/{id}/comments", id), "{\"body\":\"저도 궁금해요\"}").andExpect(status().isCreated());
        call(admin, post("/api/admin/posts/{id}/comments", id), "{\"body\":\"운영자 안내입니다\"}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.staff").value(true));
        call(admin, get("/api/admin/posts"), null).andExpect(jsonPath("$.items[0].title").value("질문 있어요"))
            .andExpect(jsonPath("$.items[0].comments.length()").value(2)).andExpect(jsonPath("$.items[0].comments[1].staff").value(true));
        // 회원 화면에서도 운영자 표시
        call(member, get("/api/posts/{id}", id), null).andExpect(jsonPath("$.comments[1].staff").value(true))
            .andExpect(jsonPath("$.comments[0].staff").value(false)).andExpect(jsonPath("$.commentCount").value(2));
    }

    @Test void deletingPostOrCommentMarksTheirReportsHidden() throws Exception {
        String id = writePost("광고");
        String commentId = json(call(member, post("/api/posts/{id}/comments", id), "{\"body\":\"욕설\"}"), "$.id");
        String other = writePost("정상 글");
        String otherComment = json(call(member, post("/api/posts/{id}/comments", other), "{\"body\":\"나쁜 댓글\"}"), "$.id");
        call(reporter, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + id + "\",\"reason\":\"AD_ILLEGAL\"}").andExpect(status().isNoContent());
        call(reporter, post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":\"" + commentId + "\",\"reason\":\"ABUSE\"}").andExpect(status().isNoContent());
        call(reporter, post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":\"" + otherComment + "\",\"reason\":\"ABUSE\"}").andExpect(status().isNoContent());

        call(admin, get("/api/admin/reports").param("status", "RECEIVED"), null).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].targetType").value("COMMENT")).andExpect(jsonPath("$[0].postId").value(other))
            .andExpect(jsonPath("$[0].target.text").value("나쁜 댓글")).andExpect(jsonPath("$[0].reporter.nickname").value("용산주민"))
            .andExpect(jsonPath("$[0].target.deleted").value(false));

        call(admin, delete("/api/admin/posts/{id}", id).param("reason", "광고"), null).andExpect(status().isNoContent());
        // 지운 운영자 · 사유가 남음
        assertEquals("9|광고", jdbc.queryForObject("SELECT CONCAT(deleted_by, '|', delete_reason) FROM posts WHERE id = ?", String.class, Long.parseLong(id)));
        call(admin, delete("/api/admin/comments/{id}", commentId).param("reason", "가".repeat(201)), null).andExpect(status().isBadRequest());
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM reports WHERE status = 'HIDDEN' AND handled_by = 9", Integer.class));
        call(member, get("/api/posts/{id}", id), null).andExpect(status().isNotFound());

        call(admin, delete("/api/admin/comments/{id}", otherComment), null).andExpect(status().isNoContent());
        call(member, get("/api/posts/{id}", other), null).andExpect(jsonPath("$.commentCount").value(0));
        call(admin, get("/api/admin/reports").param("status", "RECEIVED"), null).andExpect(jsonPath("$.length()").value(0));
        call(admin, get("/api/admin/reports"), null).andExpect(jsonPath("$.length()").value(3)).andExpect(jsonPath("$[2].target.deleted").value(true));
    }

    @Test void resolvingReportsDismissesOrHidesTheTarget() throws Exception {
        String keep = writePost("문제없는 글");
        String hide = writePost("숨길 글");
        call(reporter, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + keep + "\",\"reason\":\"FALSE_INFO\"}");
        call(reporter, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + hide + "\",\"reason\":\"ABUSE\"}");
        call(admin, patch("/api/admin/reports").param("targetType", "POST").param("targetId", keep), "{\"status\":\"DISMISSED\"}").andExpect(status().isNoContent());
        call(member, get("/api/posts/{id}", keep), null).andExpect(status().isOk());
        String reportId = jdbc.queryForObject("SELECT CAST(id AS VARCHAR) FROM reports WHERE target_id = ?", String.class, Long.parseLong(hide));
        call(admin, patch("/api/admin/reports/{id}", reportId), "{\"status\":\"HIDDEN\"}").andExpect(status().isNoContent());
        call(member, get("/api/posts/{id}", hide), null).andExpect(status().isNotFound());
        assertEquals("HIDDEN", jdbc.queryForObject("SELECT status FROM posts WHERE id = ?", String.class, Long.parseLong(hide)));
        call(admin, patch("/api/admin/reports/{id}", reportId), "{\"status\":\"RECEIVED\"}").andExpect(status().isBadRequest());
    }

    @Test void homeTipsAreChosenByAdmin() throws Exception {
        String id = writePost("홈에 올릴 글");
        call(member, get("/api/posts/home-tips"), null).andExpect(jsonPath("$.length()").value(0));
        call(admin, put("/api/admin/posts/{id}/home-tip", id), null).andExpect(status().isNoContent());
        call(member, get("/api/posts/home-tips"), null).andExpect(jsonPath("$[0].title").value("홈에 올릴 글"));
        call(admin, get("/api/admin/posts"), null).andExpect(jsonPath("$.items[0].homeTip").value(true));
        call(admin, delete("/api/admin/posts/{id}/home-tip", id), null).andExpect(status().isNoContent());
        call(member, get("/api/posts/home-tips"), null).andExpect(jsonPath("$.length()").value(0));
    }
}

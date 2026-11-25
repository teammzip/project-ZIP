package com.zip.backend.community;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
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
        return writePost(member, "FREE", title, "내용");
    }

    private String writePost(String token, String category, String title, String body) throws Exception {
        return json(call(token, post("/api/posts"), "{\"category\":\"" + category + "\",\"title\":\"" + title + "\",\"body\":\"" + body + "\"}")
            .andExpect(status().isCreated()), "$.id");
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

    @Test void postSearchUsesNewestFirstAndExcludesHiddenDeletedAndOutOfScopePosts() throws Exception {
        jdbc.update("INSERT INTO regions (id, parent_id, name, level) VALUES (20, 1, '강남구', 2)");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, region_id, region_verified_at)
            VALUES (20, 'gangnam20', ?, '강남주민', 20, CURRENT_TIMESTAMP)
            """, passwords.encode("abcd123!"));

        String guide = writePost("곰팡이 제거 방법");
        String incidental = writePost(member, "FREE", "이사 후기", "곰팡이 제거 업체를 불렀어요");
        jdbc.update("UPDATE posts SET created_at = '2026-01-01 00:00:00' WHERE id = ?", Long.parseLong(guide));
        String neighbor = writePost(reporter, "FREE", "곰팡이 제거 후기", "용산구 글입니다");
        String distant = writePost(login("gangnam20"), "FREE", "곰팡이 제거 질문", "강남구 글입니다");
        String hidden = writePost("곰팡이 제거 숨김 대상");
        String deleted = writePost("곰팡이 제거 삭제 대상");
        writePost(member, "TIP", "곰팡이 제거 팁", "다른 카테고리입니다");

        String query = "곰팡이 제거";
        call(member, get("/api/posts").param("scope", "here").param("category", "FREE").param("q", query), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", containsInAnyOrder(guide, incidental, hidden, deleted)));

        call(reporter, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + hidden + "\",\"reason\":\"ABUSE\"}")
            .andExpect(status().isNoContent());
        call(admin, patch("/api/admin/reports").param("targetType", "POST").param("targetId", hidden), "{\"status\":\"HIDDEN\"}")
            .andExpect(status().isNoContent());
        call(member, delete("/api/posts/{id}", deleted), null).andExpect(status().isNoContent());

        call(member, get("/api/posts").param("scope", "here").param("category", "FREE").param("q", query).param("sort", "latest"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].id").value(incidental)).andExpect(jsonPath("$.items[1].id").value(guide));
        for (String sort : new String[] {"latest", "views", "popular", "relevance"}) {
            call(member, get("/api/posts").param("scope", "here").param("category", "FREE").param("q", query).param("sort", sort), null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", containsInAnyOrder(guide, incidental)));
            call(member, get("/api/posts").param("scope", "near").param("category", "FREE").param("q", query).param("sort", sort), null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", containsInAnyOrder(guide, incidental, neighbor)));
            call(member, get("/api/posts").param("scope", "all").param("category", "FREE").param("q", query).param("sort", sort), null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", containsInAnyOrder(guide, incidental, neighbor, distant)));
        }
    }

    @Test void searchOrdersTheSameMatchesByLatestViewsPopularityOrRelevance() throws Exception {
        String guide = writePost(member, "FREE", "곰팡이 제거 방법", "곰팡이를 제거할 때는 먼저 환기하세요.");
        String viewed = writePost(member, "FREE", "이사 기록", "곰팡이 제거 업체에 갔어요.");
        String discussed = writePost(member, "FREE", "곰팡이 업체 이야기", "다음 달에 벽지를 제거할 예정이에요.");
        String latest = writePost(member, "FREE", "청소 기록", "곰팡이 제거 얘기를 들었어요.");
        jdbc.update("UPDATE posts SET created_at = '2026-01-01 00:00:00' WHERE id = ?", Long.parseLong(guide));
        jdbc.update("UPDATE posts SET view_count = 100 WHERE id = ?", Long.parseLong(viewed));
        jdbc.update("UPDATE posts SET like_count = 1, comment_count = 4 WHERE id = ?", Long.parseLong(discussed));
        jdbc.update("UPDATE posts SET like_count = 6 WHERE id = ?", Long.parseLong(viewed));

        String query = "곰팡이 제거";
        var match = get("/api/posts").param("scope", "here").param("q", query);
        call(member, match, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(guide, latest, viewed, discussed)));
        call(member, get("/api/posts").param("scope", "here").param("q", query).param("sort", "latest"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(latest, discussed, viewed, guide)));
        call(member, get("/api/posts").param("scope", "here").param("q", query).param("sort", "views"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(viewed, latest, discussed, guide)));
        call(member, get("/api/posts").param("scope", "here").param("q", query).param("sort", "popular"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(discussed, viewed, latest, guide)));
        call(member, get("/api/posts").param("scope", "here").param("sort", "relevance"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(latest, discussed, viewed, guide)));
        call(member, get("/api/posts").param("sort", "invalid"), null).andExpect(status().isBadRequest());

        String compact = writePost(member, "TIP", "분리수거 요령 50%_!", "요일마다 품목을 확인하세요.");
        writePost(member, "TIP", "분리수거 대조 글 50AX!", "와일드카드 대조 사례입니다.");
        call(member, get("/api/posts").param("scope", "here").param("q", "분리 수거 50%_!"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(compact)));
    }

    @Test void compactKoreanSearchFindsSpacedTitlesAndBodiesWithinTheSelectedScope() throws Exception {
        String guide = writePost(member, "TIP", "층간 소음 상담 안내", "관리실에 먼저 중재를 요청하세요.");
        String incidental = writePost(member, "TIP", "소설 설정", "층간소음 때문에 이사하는 인물입니다.");
        String neighbor = writePost(reporter, "TIP", "층간 소음 대응", "이웃 동네 상담 후기입니다.");
        String deleted = writePost(member, "TIP", "층간 소음 지난 공지", "삭제할 글입니다.");
        writePost(member, "FREE", "층간 소음 이야기", "다른 카테고리입니다.");
        call(member, delete("/api/posts/{id}", deleted), null).andExpect(status().isNoContent());

        var search = get("/api/posts").param("scope", "here").param("category", "TIP").param("q", "층간소음");
        call(member, search, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", contains(guide, incidental)));
        call(member, get("/api/posts").param("scope", "near").param("category", "TIP").param("q", "층간소음").param("sort", "latest"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(neighbor, incidental, guide)));

        String bodyMatch = writePost(member, "TIP", "투명 페트병 배출", "플라스틱은 재활용 품목에 해당합니다.");
        call(member, get("/api/posts").param("scope", "here").param("q", "재활용품"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(bodyMatch)));
        call(admin, get("/api/admin/posts").param("q", "층간소음"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(incidental)));
    }

    @Test void emptySearchSuggestsOnlyCorrectionsThatMatchVisiblePostsInTheSameScope() throws Exception {
        writePost(member, "FREE", "방충망 교체 후기", "우리 동네 자유 글입니다.");
        String guide = writePost(reporter, "TIP", "방충망 교체 안내", "이웃 동네 꿀팁입니다.");

        call(member, get("/api/posts").param("scope", "here").param("category", "TIP").param("q", "방충망 교채"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.suggestedQuery").doesNotExist());
        call(member, get("/api/posts").param("scope", "near").param("category", "TIP").param("q", "방충망 교채"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.suggestedQuery").value("방충망 교체"));
        call(member, get("/api/posts").param("scope", "near").param("category", "TIP").param("q", "방충망 교체"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", contains(guide)))
            .andExpect(jsonPath("$.suggestedQuery").doesNotExist());
        call(member, get("/api/posts").param("scope", "near").param("category", "TIP").param("q", "방충망 교채").param("page", "1"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.suggestedQuery").doesNotExist());
        call(admin, get("/api/admin/posts").param("q", "방충망 교채"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.suggestedQuery").doesNotExist());

        call(member, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + guide + "\",\"reason\":\"ABUSE\"}")
            .andExpect(status().isNoContent());
        call(admin, patch("/api/admin/reports").param("targetType", "POST").param("targetId", guide), "{\"status\":\"HIDDEN\"}")
            .andExpect(status().isNoContent());
        call(member, get("/api/posts").param("scope", "near").param("category", "TIP").param("q", "방충망 교채"), null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.suggestedQuery").doesNotExist());
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

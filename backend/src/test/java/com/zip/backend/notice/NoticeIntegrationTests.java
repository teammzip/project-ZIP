package com.zip.backend.notice;

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

/** 공지사항: 관리자만 쓰고 · 고치고 · 지우고, 회원은 목록 · 내용을 보고, 알림 보내기 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class NoticeIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String member, quiet, admin;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, role) VALUES
            (1, 'mapo01', ?, '마포주민', 'USER'), (2, 'quiet01', ?, '조용한주민', 'USER'), (9, 'admin01', ?, '운영자', 'ADMIN')
            """, hash, hash, hash);
        jdbc.update("INSERT INTO user_settings (user_id, noti_on) VALUES (2, FALSE)");
        member = login("mapo01");
        quiet = login("quiet01");
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

    private String create(String title, boolean pinned, boolean notify) throws Exception {
        var body = "{\"title\":\"" + title + "\",\"body\":\"첫 줄\\n둘째 줄\",\"pinned\":" + pinned + ",\"notify\":" + notify + "}";
        return JsonPath.read(call(admin, post("/api/admin/notices"), body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
    }

    @Test void adminWritesMembersRead() throws Exception {
        String first = create("점검 안내", false, false);
        String pinned = create("이용 규칙", true, false);
        call(member, get("/api/notices"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].id").value(pinned)) // 고정 먼저
            .andExpect(jsonPath("$[0].pinned").value(true))
            .andExpect(jsonPath("$[1].body").doesNotExist()); // 목록엔 내용 없음
        call(member, get("/api/notices/{id}", first), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.body").value("첫 줄\n둘째 줄"))
            .andExpect(jsonPath("$.author").value("운영자"));

        call(admin, patch("/api/admin/notices/{id}", first), "{\"title\":\"점검 안내 (변경)\",\"body\":\"새 내용\",\"pinned\":true}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("점검 안내 (변경)")).andExpect(jsonPath("$.pinned").value(true));
        call(admin, delete("/api/admin/notices/{id}", pinned), null).andExpect(status().isNoContent());
        call(member, get("/api/notices/{id}", pinned), null).andExpect(status().isNotFound());
        call(admin, delete("/api/admin/notices/{id}", pinned), null).andExpect(status().isNotFound());
        call(member, get("/api/notices/abc"), null).andExpect(status().isNotFound());
    }

    @Test void popupNoticesComeWithBodyNewestFirst() throws Exception {
        call(admin, post("/api/admin/notices"), "{\"title\":\"팝업 하나\",\"body\":\"첫 팝업\",\"popup\":true}").andExpect(status().isCreated());
        create("일반 공지", false, false);
        String second = JsonPath.read(call(admin, post("/api/admin/notices"), "{\"title\":\"팝업 둘\",\"body\":\"둘째 팝업\",\"popup\":true}")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.popup").value(true)).andReturn().getResponse().getContentAsString(), "$.id");
        jdbc.update("UPDATE notices SET created_at = created_at + INTERVAL '1' MINUTE WHERE id = ?", Long.parseLong(second));
        call(member, get("/api/notices/popups"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].title").value("팝업 둘"))
            .andExpect(jsonPath("$[0].body").value("둘째 팝업"));
        // 팝업을 끄면 더는 안 뜸
        call(admin, patch("/api/admin/notices/{id}", second), "{\"title\":\"팝업 둘\",\"body\":\"둘째 팝업\",\"popup\":false}").andExpect(jsonPath("$.popup").value(false));
        call(member, get("/api/notices/popups"), null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("팝업 하나"));
    }

    @Test void onlyAdminsCanWrite() throws Exception {
        call(member, post("/api/admin/notices"), "{\"title\":\"x\",\"body\":\"y\"}").andExpect(status().isForbidden());
        String id = create("공지", false, false);
        call(member, patch("/api/admin/notices/{id}", id), "{\"title\":\"x\",\"body\":\"y\"}").andExpect(status().isForbidden());
        call(member, delete("/api/admin/notices/{id}", id), null).andExpect(status().isForbidden());
        mvc.perform(get("/api/notices")).andExpect(status().isUnauthorized());
    }

    @Test void validatesTitleAndBody() throws Exception {
        call(admin, post("/api/admin/notices"), "{\"title\":\"  \",\"body\":\"y\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/notices"), "{\"title\":\"x\",\"body\":\"\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/notices"), "{\"title\":\"" + "가".repeat(101) + "\",\"body\":\"y\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/notices"), "{\"title\":\"x\",\"body\":\"" + "가".repeat(5001) + "\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/notices"), null).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notices", Integer.class));
    }

    @Test void notifyReachesMembersWithNotificationsOn() throws Exception {
        String id = create("새 기능 안내", false, true);
        call(member, get("/api/notifications"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].title").value("새 공지: 새 기능 안내"))
            .andExpect(jsonPath("$.items[0].link").value("notice"))
            .andExpect(jsonPath("$.items[0].refId").value(id));
        // 알림을 끈 회원 · 관리자에게는 없음
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id IN (2, 9)", Integer.class));
        create("조용한 공지", false, false);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notifications", Integer.class));
    }
}

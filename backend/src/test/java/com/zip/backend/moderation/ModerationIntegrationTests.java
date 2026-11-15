package com.zip.backend.moderation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.Instant;
import org.hamcrest.Matchers;
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

/** 회원 관리 · 경고 · 정지 · 해제 · 통계, 내 경고 확인, 정지 만료 시 자동 복구 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class ModerationIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String admin;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, role) VALUES
            (1, 'member01', ?, '청소고수', 'USER'), (2, 'member02', ?, '요리왕', 'USER'), (9, 'admin01', ?, '운영자', 'ADMIN')
            """, hash, hash, hash);
        admin = login("admin01").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        admin = JsonPath.read(admin, "$.accessToken");
    }

    private ResultActions login(String id) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}"));
    }

    private String token(String id) throws Exception {
        return JsonPath.read(login(id).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.accessToken");
    }

    private ResultActions call(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
        request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    @Test void onlyAdmins() throws Exception {
        String member = token("member01");
        call(member, get("/api/admin/stats"), null).andExpect(status().isForbidden());
        call(member, get("/api/admin/members"), null).andExpect(status().isForbidden());
        call(member, post("/api/admin/members/2/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"x\"}").andExpect(status().isForbidden());
    }

    @Test void warningIsShownOnceThenMarkedSeen() throws Exception {
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"욕설\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.warns").value(1)).andExpect(jsonPath("$.status").value("ACTIVE"));
        String member = token("member01");
        String me = call(member, get("/api/auth/me"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.warnCount").value(1)).andExpect(jsonPath("$.banCount").value(0))
            .andExpect(jsonPath("$.unseenWarnings[0].reason").value("욕설")).andExpect(jsonPath("$.suspension").isEmpty())
            .andReturn().getResponse().getContentAsString();
        String warningId = JsonPath.read(me, "$.unseenWarnings[0].id");
        call(member, post("/api/me/warnings/seen"), "{\"ids\":[\"" + warningId + "\"]}").andExpect(status().isNoContent());
        call(member, get("/api/auth/me"), null).andExpect(jsonPath("$.unseenWarnings.length()").value(0)).andExpect(jsonPath("$.warnCount").value(1));
        call(member, get("/api/me/sanctions"), null).andExpect(jsonPath("$[0].type").value("WARNING"))
            .andExpect(jsonPath("$[0].reason").value("욕설")).andExpect(jsonPath("$[0].by").doesNotExist());
    }

    @Test void suspendBlocksImmediatelyAndUnbanKeepsHistory() throws Exception {
        String member = token("member01");
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"SUSPEND\",\"days\":3,\"reason\":\"도배\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED")).andExpect(jsonPath("$.until").isString()).andExpect(jsonPath("$.permanent").value(false));
        // 이미 로그인한 토큰도 바로 막힘, 다시 로그인하면 언제 풀리는지 · 사유
        call(member, get("/api/auth/me"), null).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUSPENDED"));
        login("member01").andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value(Matchers.allOf(Matchers.containsString("해제)"), Matchers.containsString("사유: 도배"))));
        call(admin, get("/api/admin/members").param("status", "SUSPENDED"), null).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].nickname").value("청소고수"));

        call(admin, delete("/api/admin/members/1/sanctions/active"), "{\"reason\":\"오해였어요\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.bans").value(1));
        login("member01").andExpect(status().isOk());
        call(admin, get("/api/admin/members/1/sanctions"), null).andExpect(jsonPath("$[0].type").value("SUSPEND"))
            .andExpect(jsonPath("$[0].days").value(3)).andExpect(jsonPath("$[0].revokeReason").value("오해였어요")).andExpect(jsonPath("$[0].by").value("운영자"));
        call(admin, delete("/api/admin/members/1/sanctions/active"), null).andExpect(status().isBadRequest()); // 이미 풀림
    }

    @Test void permanentBan() throws Exception {
        call(admin, post("/api/admin/members/2/sanctions"), "{\"type\":\"BAN\",\"reason\":\"불법 광고\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.permanent").value(true)).andExpect(jsonPath("$.until").isEmpty());
        login("member02").andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value(Matchers.containsString("영구 정지")));
    }

    @Test void invalidSanctionsAreRejected() throws Exception {
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"SUSPEND\",\"days\":2,\"reason\":\"x\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"  \"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"KICK\",\"reason\":\"x\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/members/9/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"x\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/members/777/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"x\"}").andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_sanctions", Integer.class));
    }

    @Test void bulkIsAllOrNothing() throws Exception {
        call(admin, post("/api/admin/sanctions/bulk"), "{\"memberIds\":[\"1\",\"777\"],\"type\":\"WARNING\",\"reason\":\"단체 경고\"}").andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_sanctions", Integer.class));
        call(admin, post("/api/admin/sanctions/bulk"), "{\"memberIds\":[\"1\",\"2\"],\"type\":\"WARNING\",\"reason\":\"단체 경고\"}").andExpect(status().isNoContent());
        call(admin, get("/api/admin/stats"), null).andExpect(jsonPath("$.members").value(2)).andExpect(jsonPath("$.totalWarns").value(2))
            .andExpect(jsonPath("$.suspended").value(0));
        call(admin, get("/api/admin/members").param("q", "요리").param("minWarns", "1"), null).andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test void expiredSuspensionRestoresButManualSuspensionStays() throws Exception {
        Timestamp past = Timestamp.from(Instant.now().minusSeconds(7200)), ended = Timestamp.from(Instant.now().minusSeconds(60));
        jdbc.update("INSERT INTO user_sanctions (user_id, sanction_type, reason, starts_at, ends_at) VALUES (1, 'SUSPEND', '지난 정지', ?, ?)", past, ended);
        jdbc.update("UPDATE users SET status = 'SUSPENDED' WHERE id IN (1, 2)");
        login("member01").andExpect(status().isOk());
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT status FROM users WHERE id = 1", String.class));
        // 조치 기록 없이 직접 SUSPENDED 로 둔 계정은 그대로 막힘
        login("member02").andExpect(status().isForbidden());
    }
}

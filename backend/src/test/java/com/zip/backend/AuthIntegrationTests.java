package com.zip.backend;

import com.zip.backend.auth.TokenService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class AuthIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired TokenService tokens;
    @Autowired JwtDecoder decoder;

    @BeforeEach
    void seedAccount() {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname, address) VALUES (1, ?, ?, ?, ?, ?)",
            "tester01", passwords.encode("abcd123!"), "t@zip.com", "테스터", "서울 마포구");
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) SELECT 1, id, CURRENT_TIMESTAMP FROM terms_documents WHERE version = '2026-10-18'");
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\",\"remember\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value("1"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
    }

    @Test void loginMeLogoutInvalidatesToken() throws Exception {
        String token = login();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("tester01"))
            .andExpect(jsonPath("$.agreedAt").isString());
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void firstLoginAndEmailLogin() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"T@ZIP.COM\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.firstLogin").value(true));
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.firstLogin").value(false));
    }

    @Test void wrongPasswordDoesNotCreateSession() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"wrong\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM auth_sessions", Integer.class));
    }

    @Test void passwordChangeRevokesAllSessions() throws Exception {
        String first = login();
        String second = login();
        mvc.perform(patch("/api/auth/me/password").header("Authorization", "Bearer " + first)
            .contentType("application/json").content("{\"currentPassword\":\"abcd123!\",\"newPassword\":\"newpass1!\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + second)).andExpect(status().isUnauthorized());
        assertTrue(passwords.matches("newpass1!", jdbc.queryForObject("SELECT password_hash FROM users WHERE id = 1", String.class)));
    }

    @Test void invalidPasswordChangeKeepsSessionAndHash() throws Exception {
        String token = login();
        mvc.perform(patch("/api/auth/me/password").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpass1!\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/auth/me/password").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"currentPassword\":\"abcd123!\",\"newPassword\":\"short\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertTrue(passwords.matches("abcd123!", jdbc.queryForObject("SELECT password_hash FROM users WHERE id = 1", String.class)));
    }

    @Test void suspensionBlocksExistingTokenAndLogin() throws Exception {
        String token = login();
        jdbc.update("INSERT INTO user_sanctions (user_id, sanction_type, starts_at) VALUES (1, 'BAN', ?)", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUSPENDED"));
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUSPENDED"));
    }

    @Test void expiredTamperedAndWrongSessionTokensAreRejected() throws Exception {
        String valid = login();
        var jwt = decoder.decode(valid);
        var now = Instant.now();
        String expired = tokens.issue(1, Long.parseLong(jwt.getClaimAsString("sid")), now.minusSeconds(100), now.minusSeconds(10));
        String wrongUser = tokens.issue(2, Long.parseLong(jwt.getClaimAsString("sid")), now, now.plusSeconds(60));
        String tampered = valid.substring(0, valid.lastIndexOf('.') + 1) + "bad-signature";
        for (String token : java.util.List.of(expired, wrongUser, tampered)) {
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        }
        jdbc.update("UPDATE auth_sessions SET expires_at = ?", java.sql.Timestamp.from(now.minusSeconds(1)));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + valid)).andExpect(status().isUnauthorized());
    }

    @Test void unauthenticatedAndAdminRequestsAreDenied() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").isString());
        mvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + login())).andExpect(status().isForbidden());
    }

    @Test void termsArePublicAndExcludeFutureVersions() throws Exception {
        mvc.perform(get("/api/terms")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].version").value("2026-10-18"))
            .andExpect(jsonPath("$[1].consentKind").value("CONFIRM"));
        jdbc.update("INSERT INTO terms_documents (doc_type, version, title, content, consent_kind, is_required, effective_at) VALUES ('SERVICE', 'new', '새 약관', '본문', 'AGREE', TRUE, ?)", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        mvc.perform(get("/api/terms")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].version").value("new"));
    }
}

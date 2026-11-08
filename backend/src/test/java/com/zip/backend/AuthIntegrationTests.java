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

    @Test void nicknameChangeIsTrimmedPersistedAndLimitedToCurrentUser() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, nickname) VALUES (2, 'other01', '다른회원')");
        String token = login();
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"nickname\":\"  새닉네임  \"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value("1"))
            .andExpect(jsonPath("$.nickname").value("새닉네임"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("새닉네임"));
        assertEquals("새닉네임", jdbc.queryForObject("SELECT nickname FROM users WHERE id = 1", String.class));
        assertEquals("다른회원", jdbc.queryForObject("SELECT nickname FROM users WHERE id = 2", String.class));
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        String newToken = login();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("새닉네임"));
    }

    @Test void invalidNicknameDoesNotChangeDatabase() throws Exception {
        String token = login();
        for (String body : java.util.List.of("{}", "{\"nickname\":null}", "{\"nickname\":\"   \"}",
            "{\"nickname\":\"가\"}", "{\"nickname\":\"abcdefghijklmn\"}")) {
            mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        assertEquals("테스터", jdbc.queryForObject("SELECT nickname FROM users WHERE id = 1", String.class));
        mvc.perform(patch("/api/auth/me").contentType("application/json").content("{\"nickname\":\"새닉네임\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"nickname\":\"새닉네임\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test void termsArePublicAndExcludeFutureVersions() throws Exception {
        mvc.perform(get("/api/terms")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].version").value("2026-10-18"))
            .andExpect(jsonPath("$[1].consentKind").value("CONFIRM"));
        jdbc.update("INSERT INTO terms_documents (doc_type, version, title, content, consent_kind, is_required, effective_at) VALUES ('SERVICE', 'new', '새 약관', '본문', 'AGREE', TRUE, ?)", java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
        mvc.perform(get("/api/terms")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].version").value("new"));
    }

    @Test void profileFieldsPersistAndExplicitNullClearsOptionalFields() throws Exception {
        String token = login();
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"bio\":\"  요리 연습 중  \",\"avatarEmoji\":\"🐻\",\"avatarColor\":\"#ffd6a5\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("테스터"))
            .andExpect(jsonPath("$.bio").value("요리 연습 중")).andExpect(jsonPath("$.avatarEmoji").value("🐻"));
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"nickname\":\"새닉네임\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bio").value("요리 연습 중"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.avatarColor").value("#ffd6a5"));
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"bio\":null,\"avatarEmoji\":null,\"avatarColor\":null,\"avatarFileId\":null}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bio").value(""))
            .andExpect(jsonPath("$.avatarEmoji").isEmpty()).andExpect(jsonPath("$.avatarUrl").isEmpty());
    }

    @Test void invalidProfileOrForeignFileLeavesWholeUpdateUnchanged() throws Exception {
        String token = login();
        jdbc.update("INSERT INTO users (id, login_id, nickname) VALUES (2, 'other01', '다른회원')");
        jdbc.update("INSERT INTO uploaded_files (id, user_id, original_name, storage_url, mime_type, size_bytes) VALUES (50, 2, 'other.png', '/other', 'image/png', 10)");
        jdbc.update("INSERT INTO uploaded_files (id, user_id, original_name, storage_url, mime_type, size_bytes, deleted_at) VALUES (51, 1, 'deleted.png', '/deleted', 'image/png', 10, CURRENT_TIMESTAMP)");
        jdbc.update("INSERT INTO uploaded_files (id, user_id, original_name, storage_url, mime_type, size_bytes) VALUES (52, 1, 'document.pdf', '/document', 'application/pdf', 10)");
        for (String id : java.util.List.of("50", "51", "52", "999")) {
            mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{\"nickname\":\"변경금지\",\"avatarFileId\":\"" + id + "\"}"))
                .andExpect(status().isNotFound());
        }
        for (String body : java.util.List.of("{\"bio\":\"" + "가".repeat(31) + "\"}",
            "{\"avatarColor\":\"url(bad)\"}", "{\"avatarEmoji\":\"" + "a".repeat(21) + "\"}",
            "{\"bio\":123}", "{\"avatarFileId\":123}", "{\"role\":\"ADMIN\"}", "{\"avatarFileId\":\"-1\"}")) {
            mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        assertEquals("테스터", jdbc.queryForObject("SELECT nickname FROM users WHERE id = 1", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_profiles", Integer.class));
    }

    private byte[] png() throws Exception {
        var image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    @Test void uploadAttachReadAndRemoveProfilePhoto() throws Exception {
        String token = login();
        var file = new org.springframework.mock.web.MockMultipartFile("file", "profile.png", "image/png", png());
        String body = mvc.perform(multipart("/api/files").file(file).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("image/png"))
            .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        String url = com.jayway.jsonpath.JsonPath.read(body, "$.url");
        // Unlinked files are not publicly readable.
        mvc.perform(get(url)).andExpect(status().isNotFound());
        mvc.perform(get(url).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"avatarFileId\":\"" + id + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value(url));
        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.avatarFileId").value(id));
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"avatarFileId\":null}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").isEmpty());
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    @Test void uploadRejectsWrongContentOversizeAndMissingAuthentication() throws Exception {
        String token = login();
        var image = new org.springframework.mock.web.MockMultipartFile("file", "p.png", "image/png", png());
        mvc.perform(multipart("/api/files").file(image)).andExpect(status().isUnauthorized());
        var fake = new org.springframework.mock.web.MockMultipartFile("file", "p.png", "image/png", "not an image".getBytes());
        mvc.perform(multipart("/api/files").file(fake).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        var mismatch = new org.springframework.mock.web.MockMultipartFile("file", "p.jpg", "image/jpeg", png());
        mvc.perform(multipart("/api/files").file(mismatch).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        var big = new org.springframework.mock.web.MockMultipartFile("file", "p.png", "image/png", new byte[2 * 1024 * 1024 + 1]);
        mvc.perform(multipart("/api/files").file(big).header("Authorization", "Bearer " + token)).andExpect(status().is(413));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM uploaded_files", Integer.class));
    }
}

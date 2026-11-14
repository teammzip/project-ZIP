package com.zip.backend;

import com.zip.backend.auth.AuthService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** DELETE /api/auth/me: account, its data, its picture files and its tokens are gone; only a withdrawal log stays. */
@SpringBootTest(properties = "zip.oauth.frontend-url=http://localhost:3000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class WithdrawalTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired AuthService auth;
    @Value("${zip.files.directory}") String uploadDirectory;

    private void seedEmailAccount(String role) {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname, address, role) VALUES (1, 'tester01', ?, 't@zip.com', '테스터', '서울 마포구', ?)",
            passwords.encode("abcd123!"), role);
        jdbc.update("INSERT INTO user_settings (user_id) VALUES (1)");
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) SELECT 1, id, CURRENT_TIMESTAMP FROM terms_documents WHERE version = '2026-10-18'");
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\",\"remember\":false}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
    }

    private static byte[] png() throws Exception {
        var output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", output);
        return output.toByteArray();
    }

    private static int count(JdbcTemplate jdbc, String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test void withdrawalRemovesAccountDataAndKeepsOnlyALog() throws Exception {
        seedEmailAccount("USER");
        String token = login();
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());

        assertEquals(0, count(jdbc, "users"));
        assertEquals(0, count(jdbc, "user_settings"));
        assertEquals(0, count(jdbc, "user_term_agreements"));
        assertEquals(0, count(jdbc, "auth_sessions"));
        assertEquals(1, count(jdbc, "withdrawal_logs"));
        assertEquals(1L, jdbc.queryForObject("SELECT former_user_id FROM withdrawal_logs", Long.class));
        // Nothing personal is kept in the log (it only has an id and a time).
        assertEquals(3, jdbc.queryForList("SELECT * FROM withdrawal_logs").get(0).size());
    }

    @Test void oldTokenAndPasswordNoLongerWork() throws Exception {
        seedEmailAccount("USER");
        String token = login();
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\",\"remember\":false}")).andExpect(status().isBadRequest());
        assertEquals(1, count(jdbc, "withdrawal_logs"));
    }

    @Test void withdrawalRequiresLogin() throws Exception {
        seedEmailAccount("USER");
        mvc.perform(delete("/api/auth/me")).andExpect(status().isUnauthorized());
        assertEquals(1, count(jdbc, "users"));
        assertEquals(0, count(jdbc, "withdrawal_logs"));
    }

    @Test void adminCannotWithdraw() throws Exception {
        seedEmailAccount("ADMIN");
        String token = login();
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertEquals(1, count(jdbc, "users"));
        assertEquals(0, count(jdbc, "withdrawal_logs"));
    }

    @Test void uploadedPictureFilesAreDeletedFromDisk() throws Exception {
        seedEmailAccount("USER");
        String token = login();
        var file = new MockMultipartFile("file", "profile.png", "image/png", png());
        String body = mvc.perform(multipart("/api/files").file(file).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String url = com.jayway.jsonpath.JsonPath.read(body, "$.url");
        Path stored = Path.of(uploadDirectory).toAbsolutePath().normalize().resolve(url.substring(url.lastIndexOf('/') + 1));
        assertTrue(Files.isRegularFile(stored));

        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertFalse(Files.exists(stored));
        assertEquals(0, count(jdbc, "uploaded_files"));
    }

    @Test void socialAccountWithdrawsAndCanSignUpAgainAsNewUser() throws Exception {
        String token = auth.socialLogin("NAVER", "naver-1", "a@naver.com", "지기");
        long oldId = jdbc.queryForObject("SELECT id FROM users", Long.class);
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertEquals(0, count(jdbc, "users"));
        assertEquals(0, count(jdbc, "social_accounts"));

        // The same Naver account (and the same email) is free again and becomes a fresh account that needs consent.
        String again = auth.socialLogin("NAVER", "naver-1", "a@naver.com", "지기");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + again))
            .andExpect(status().isOk()).andExpect(jsonPath("$.agreedAt").doesNotExist());
        assertEquals(1, count(jdbc, "users"));
        assertNotEquals(oldId, jdbc.queryForObject("SELECT id FROM users", Long.class));
    }

    @Test void otherUsersAreUntouched() throws Exception {
        seedEmailAccount("USER");
        jdbc.update("INSERT INTO users (id, login_id, email, nickname) VALUES (2, 'other01', 'o@zip.com', '다른사람')");
        jdbc.update("INSERT INTO user_settings (user_id) VALUES (2)");
        String token = login();
        mvc.perform(delete("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertEquals(1, count(jdbc, "users"));
        assertEquals(1, count(jdbc, "user_settings"));
        assertEquals("other01", jdbc.queryForObject("SELECT login_id FROM users", String.class));
    }
}

package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.zip.backend.auth.emailcheck.MailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 남용 방지 제한: 인증 메일(IP 별 · 서버 전체)과 회원별 사진 업로드(하루 개수 · 안 붙인 사진 개수).
 * 다른 테스트는 제한을 크게 두고(application-test.properties), 여기서만 작은 숫자로 확인한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
@TestPropertySource(properties = {
    "zip.mail.ip-per-window=2", "zip.mail.ip-per-day=3", "zip.mail.global-per-hour=4", "zip.mail.global-per-day=5",
    "zip.files.daily-limit=3", "zip.files.pending-limit=2",
})
class RateLimitTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean MailService mail;

    @BeforeEach
    void seedAccount() {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname, address) VALUES (1, ?, ?, ?, ?, ?)",
            "tester01", passwords.encode("abcd123!"), "t@zip.com", "테스터", "서울 마포구");
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) SELECT 1, id, CURRENT_TIMESTAMP FROM terms_documents WHERE version = '2026-10-18'");
    }

    private ResultActions sendFrom(String ip, String email) throws Exception {
        return mvc.perform(post("/api/auth/email/send").contentType("application/json")
            .content("{\"email\":\"" + email + "\",\"purpose\":\"SIGNUP\"}")
            .with(request -> { request.setRemoteAddr(ip); return request; }));
    }

    private long verificationRows() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM email_verifications", Long.class);
    }

    @Test void sameIpIsLimitedEvenWithDifferentAddressesButOtherIpsAreNot() throws Exception {
        sendFrom("10.0.0.1", "a1@zip.com").andExpect(status().isNoContent());
        sendFrom("10.0.0.1", "a2@zip.com").andExpect(status().isNoContent());
        // 주소를 바꿔도 같은 IP 는 짧은 시간 2통까지
        sendFrom("10.0.0.1", "a3@zip.com").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("EMAIL_IP_LIMIT"));
        sendFrom("10.0.0.2", "b1@zip.com").andExpect(status().isNoContent());
        // 막힌 요청은 인증 기록도, 메일도 남기지 않음
        assertEquals(3, verificationRows());
        verify(mail, times(3)).send(anyString(), anyString(), anyString());
    }

    @Test void serverWideCapStopsSendingBeforeTheMailAccountLimit() throws Exception {
        sendFrom("10.0.1.1", "c1@zip.com").andExpect(status().isNoContent());
        sendFrom("10.0.1.2", "c2@zip.com").andExpect(status().isNoContent());
        sendFrom("10.0.1.3", "c3@zip.com").andExpect(status().isNoContent());
        sendFrom("10.0.1.4", "c4@zip.com").andExpect(status().isNoContent());
        // 시간당 4통이 차면 IP 가 달라도 잠시 멈춤
        sendFrom("10.0.1.5", "c5@zip.com").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("EMAIL_BUSY"));
        // 한 시간이 지나면 다시 보냄 (하루 상한 5통 안)
        jdbc.update("UPDATE email_verifications SET requested_at = DATEADD('MINUTE', -61, requested_at)");
        sendFrom("10.0.1.5", "c5@zip.com").andExpect(status().isNoContent());
        // 하루 상한 5통이 차면 한 시간이 지나도 멈춤
        jdbc.update("UPDATE email_verifications SET requested_at = DATEADD('MINUTE', -61, requested_at)");
        sendFrom("10.0.1.6", "c6@zip.com").andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("EMAIL_BUSY"));
        assertEquals(5, verificationRows());
    }

    private String login() throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\",\"remember\":false}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.accessToken");
    }

    private ResultActions upload(String token) throws Exception {
        var image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", output);
        return mvc.perform(multipart("/api/files").file(new MockMultipartFile("file", "p.png", "image/png", output.toByteArray()))
            .header("Authorization", "Bearer " + token));
    }

    @Test void unattachedPhotosAreLimitedUntilTheyAreUsed() throws Exception {
        String token = login();
        String first = JsonPath.read(upload(token).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.id");
        upload(token).andExpect(status().isOk());
        // 안 붙인 사진 2장이면 더 못 올림
        upload(token).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("UPLOAD_PENDING_LIMIT"));
        // 한 장을 프로필에 붙이면 다시 올릴 수 있음
        mvc.perform(patch("/api/auth/me").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"avatarFileId\":\"" + first + "\"}")).andExpect(status().isOk());
        upload(token).andExpect(status().isOk());
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM uploaded_files WHERE user_id = 1", Long.class));
    }

    @Test void dailyUploadCountIncludesDeletedPhotosAndResetsAfterADay() throws Exception {
        String token = login();
        // 올렸다 지운 사진도 하루 개수에 들어감 (올리고 지우기를 반복해 제한을 피하지 못하게)
        for (int i = 0; i < 3; i++) {
            jdbc.update("INSERT INTO uploaded_files (user_id, original_name, storage_url, mime_type, size_bytes, deleted_at) VALUES (1, 'old.png', ?, 'image/png', 10, CURRENT_TIMESTAMP)",
                "/api/files/content/00000000-0000-0000-0000-00000000000" + i + ".png");
        }
        upload(token).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("UPLOAD_DAILY_LIMIT"));
        jdbc.update("UPDATE uploaded_files SET created_at = DATEADD('HOUR', -25, created_at)");
        upload(token).andExpect(status().isOk());
    }
}

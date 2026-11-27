package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.zip.backend.auth.emailcheck.MailService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;

/**
 * 프록시 뒤 배포: 실제 Tomcat 으로 띄워서 X-Forwarded-* 헤더를 읽는지 확인한다 (server.forward-headers-strategy).
 * MockMvc 는 Tomcat 을 거치지 않아서 이 설정을 확인할 수 없으므로 실제 포트로 요청한다.
 * 테스트 요청은 127.0.0.1(내부 주소)에서 오므로, nginx 같은 프록시가 붙인 헤더처럼 믿어야 한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
@TestPropertySource(properties = {"zip.mail.ip-per-window=1", "zip.mail.ip-per-day=5"})
class ForwardedHeadersTests {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean MailService mail;

    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void seedAccount() {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname, address) VALUES (1, ?, ?, ?, ?, ?)",
            "tester01", passwords.encode("abcd123!"), "t@zip.com", "테스터", "서울 마포구");
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) SELECT 1, id, CURRENT_TIMESTAMP FROM terms_documents WHERE version = '2026-10-18'");
    }

    private HttpResponse<String> post(String path, String json, Map<String, String> headers) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json));
        headers.forEach(request::header);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> sendMailFrom(String clientIp, String email) throws Exception {
        return post("/api/auth/email/send", "{\"email\":\"" + email + "\",\"purpose\":\"SIGNUP\"}", Map.of("X-Forwarded-For", clientIp));
    }

    @Test
    void emailLimitCountsTheRealClientIpBehindAProxy() throws Exception {
        assertEquals(204, sendMailFrom("203.0.113.10", "a1@zip.com").statusCode());
        // 같은 사람(같은 실제 IP)은 짧은 시간 1통까지
        var limited = sendMailFrom("203.0.113.10", "a2@zip.com");
        assertEquals(429, limited.statusCode());
        assertTrue(limited.body().contains("EMAIL_IP_LIMIT"));
        // 프록시는 같아도(127.0.0.1) 실제 IP 가 다른 사람은 막히지 않음. 헤더를 안 읽으면 여기서 429 가 남
        assertEquals(204, sendMailFrom("203.0.113.20", "b1@zip.com").statusCode());
    }

    @Test
    void refreshCookieIsSecureWhenTheProxyReceivedHttps() throws Exception {
        String login = "{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}";
        var overHttps = post("/api/auth/login", login, Map.of("X-Forwarded-Proto", "https"));
        assertEquals(200, overHttps.statusCode());
        assertTrue(refreshCookie(overHttps).contains("Secure"), "https 로 들어온 요청의 refresh 쿠키는 Secure");

        var overHttp = post("/api/auth/login", login, Map.of());
        assertEquals(200, overHttp.statusCode());
        assertFalse(refreshCookie(overHttp).contains("Secure"), "http 요청은 설정(zip.auth.cookie-secure=false)대로");
    }

    private static String refreshCookie(HttpResponse<String> response) {
        return response.headers().allValues("set-cookie").stream().filter(c -> c.contains("HttpOnly")).findFirst()
            .orElseThrow(() -> new AssertionError("refresh 쿠키가 없음: " + response.headers().map()));
    }
}

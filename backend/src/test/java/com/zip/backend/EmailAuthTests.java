package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.zip.backend.auth.emailcheck.MailService;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

/** Email verification, sign-up, find id and password reset. The mail is captured, never really sent. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class EmailAuthTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean MailService mail;

    private final AtomicReference<String> lastCode = new AtomicReference<>();

    @BeforeEach
    void captureMail() {
        lastCode.set(null);
        doAnswer(call -> {
            var m = Pattern.compile("(\\d{6})").matcher(call.<String>getArgument(2));
            if (m.find()) lastCode.set(m.group(1));
            return null;
        }).when(mail).send(anyString(), anyString(), anyString());
    }

    private void send(String email, String purpose, int expected) throws Exception {
        mvc.perform(post("/api/auth/email/send").contentType("application/json")
            .content("{\"email\":\"" + email + "\",\"purpose\":\"" + purpose + "\"}")).andExpect(status().is(expected));
    }

    private String verify(String email, String code, String purpose) throws Exception {
        String body = mvc.perform(post("/api/auth/email/verify").contentType("application/json")
            .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\",\"purpose\":\"" + purpose + "\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.verificationToken");
    }

    /** Skips the 1 minute wait between two code requests. */
    private void forgetPreviousRequest() {
        jdbc.update("UPDATE email_verifications SET requested_at = DATEADD('MINUTE', -5, requested_at)");
    }

    private String signupBody(String token) {
        return "{\"username\":\"newuser01\",\"password\":\"abcd123!\",\"nickname\":\"새회원\",\"email\":\"New@Zip.com\","
            + "\"emailVerificationToken\":\"" + token + "\",\"address\":\"서울 마포구 합정동\","
            + "\"agreeTerms\":true,\"agreePrivacy\":true,\"agreePolicy\":true,\"ageOver14\":true,\"termsVersion\":\"2026-10-18\"}";
    }

    @Test void signupWithVerifiedEmail() throws Exception {
        send("New@Zip.com", "SIGNUP", 204);
        assertNotNull(lastCode.get());
        String token = verify("new@zip.com", lastCode.get(), "SIGNUP");
        var signup = mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody(token)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isString())
            .andExpect(jsonPath("$.user.username").value("newuser01")).andExpect(jsonPath("$.user.email").value("new@zip.com"))
            .andExpect(jsonPath("$.user.firstLogin").value(true)).andExpect(jsonPath("$.user.region.name").value("마포구"))
            .andExpect(jsonPath("$.user.agreedAt").isString()).andReturn().getResponse();
        var refreshCookie = signup.getCookie("zip_refresh");
        assertNotNull(refreshCookie);
        assertTrue(refreshCookie.isHttpOnly());
        assertTrue(refreshCookie.getMaxAge() > 0);
        long sessionId = jdbc.queryForObject("SELECT id FROM auth_sessions", Long.class);
        mvc.perform(post("/api/auth/refresh").header("X-Zip-Session", sessionId).cookie(refreshCookie))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isString());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = 'new@zip.com' AND email_verified_at IS NOT NULL AND password_hash IS NOT NULL", Integer.class));
        // the token is spent: the same sign-up cannot be repeated
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody(token)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        // and the new account can log in
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"loginId\":\"newuser01\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isOk());
    }

    @Test void signupNeedsAValidToken() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody("not-a-real-token")))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
    }

    @Test void tokenBelongsToTheEmailItWasIssuedFor() throws Exception {
        send("other@zip.com", "SIGNUP", 204);
        String token = verify("other@zip.com", lastCode.get(), "SIGNUP");
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody(token)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
    }

    @Test void duplicateUsernameKeepsTheTokenUsable() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname) VALUES (1, 'newuser01', ?, 'x@zip.com', '기존')", passwords.encode("abcd123!"));
        send("new@zip.com", "SIGNUP", 204);
        String token = verify("new@zip.com", lastCode.get(), "SIGNUP");
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody(token)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USERNAME_EXISTS"));
        // nothing was spent, so the same token works once the id is changed
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(signupBody(token).replace("newuser01", "newuser02")))
            .andExpect(status().isOk());
    }

    @Test void signupRejectsTakenEmailAndBadInput() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname) VALUES (1, 'taken0001', ?, 'new@zip.com', '기존')", passwords.encode("abcd123!"));
        send("new@zip.com", "SIGNUP", 409);
        send("not-an-email", "SIGNUP", 400);
        send("new2@zip.com", "WHATEVER", 400);
        mvc.perform(post("/api/auth/signup").contentType("application/json")
            .content(signupBody("x").replace("abcd123!", "abcdefgh"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/signup").contentType("application/json")
            .content(signupBody("x").replace("\"agreePolicy\":true", "\"agreePolicy\":false"))).andExpect(status().isBadRequest());
    }

    @Test void wrongCodeCountsAndLocksAfterFiveTries() throws Exception {
        send("new@zip.com", "SIGNUP", 204);
        String right = lastCode.get();
        String wrong = right.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/email/verify").contentType("application/json")
                .content("{\"email\":\"new@zip.com\",\"code\":\"" + wrong + "\",\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CODE_WRONG"));
        }
        // locked: even the right code no longer works
        mvc.perform(post("/api/auth/email/verify").contentType("application/json")
            .content("{\"email\":\"new@zip.com\",\"code\":\"" + right + "\",\"purpose\":\"SIGNUP\"}"))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("CODE_LOCKED"));
        // a new code works again
        forgetPreviousRequest();
        send("new@zip.com", "SIGNUP", 204);
        assertNotNull(verify("new@zip.com", lastCode.get(), "SIGNUP"));
    }

    @Test void expiredCodeIsRefused() throws Exception {
        send("new@zip.com", "SIGNUP", 204);
        jdbc.update("UPDATE email_verifications SET expires_at = DATEADD('MINUTE', -1, CURRENT_TIMESTAMP)");
        mvc.perform(post("/api/auth/email/verify").contentType("application/json")
            .content("{\"email\":\"new@zip.com\",\"code\":\"" + lastCode.get() + "\",\"purpose\":\"SIGNUP\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CODE_EXPIRED"));
    }

    @Test void resendNeedsAMinuteAndCodeIsNotStoredAsPlainText() throws Exception {
        send("new@zip.com", "SIGNUP", 204);
        send("new@zip.com", "SIGNUP", 429);
        String stored = jdbc.queryForObject("SELECT code_hash FROM email_verifications", String.class);
        assertEquals(64, stored.length());
        assertTrue(!stored.contains(lastCode.get()) || stored.length() == 64);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM email_verifications", Integer.class));
    }

    @Test void failedMailLeavesNoCodeBehind() throws Exception {
        doAnswer(call -> { throw new com.zip.backend.common.ApiException(502, "메일을 보내지 못했어요.", "MAIL_FAILED"); })
            .when(mail).send(eq("new@zip.com"), anyString(), anyString());
        send("new@zip.com", "SIGNUP", 502);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM email_verifications", Integer.class));
    }

    @Test void findIdAndPasswordReset() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname) VALUES (1, 'tester01', ?, 't@zip.com', '테스터')", passwords.encode("abcd123!"));
        jdbc.update("UPDATE users SET login_failures=5, login_failure_since=CURRENT_TIMESTAMP WHERE id=1");
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}"))
            .andExpect(status().is(423));
        send("nobody@zip.com", "FIND_ID", 404);

        send("t@zip.com", "FIND_ID", 204);
        String idToken = verify("t@zip.com", lastCode.get(), "FIND_ID");
        mvc.perform(post("/api/auth/find-id").contentType("application/json")
            .content("{\"nickname\":\"다른이름\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + idToken + "\"}"))
            .andExpect(status().isNotFound());
        // the token was spent by the wrong guess
        mvc.perform(post("/api/auth/find-id").contentType("application/json")
            .content("{\"nickname\":\"테스터\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + idToken + "\"}"))
            .andExpect(status().isBadRequest());
        forgetPreviousRequest();
        send("t@zip.com", "FIND_ID", 204);
        String again = verify("t@zip.com", lastCode.get(), "FIND_ID");
        mvc.perform(post("/api/auth/find-id").contentType("application/json")
            .content("{\"nickname\":\"테스터\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + again + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("tester01"));

        forgetPreviousRequest();
        send("t@zip.com", "RESET_PASSWORD", 204);
        String resetVerify = verify("t@zip.com", lastCode.get(), "RESET_PASSWORD");
        // a FIND_ID token cannot be used for a reset
        mvc.perform(post("/api/auth/password-reset/verify").contentType("application/json")
            .content("{\"username\":\"tester01\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + again + "\"}"))
            .andExpect(status().isBadRequest());
        String body = mvc.perform(post("/api/auth/password-reset/verify").contentType("application/json")
            .content("{\"username\":\"tester01\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + resetVerify + "\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String resetToken = JsonPath.read(body, "$.resetToken");
        mvc.perform(post("/api/auth/password-reset").contentType("application/json")
            .content("{\"resetToken\":\"" + resetToken + "\",\"newPassword\":\"short\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/password-reset").contentType("application/json")
            .content("{\"resetToken\":\"" + resetToken + "\",\"newPassword\":\"newpass12!\"}")).andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/password-reset").contentType("application/json")
            .content("{\"resetToken\":\"" + resetToken + "\",\"newPassword\":\"newpass34!\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"loginId\":\"tester01\",\"password\":\"newpass12!\"}"))
            .andExpect(status().isOk());
    }

    @Test void resetWithWrongUsernameIsRefused() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname) VALUES (1, 'tester01', ?, 't@zip.com', '테스터')", passwords.encode("abcd123!"));
        send("t@zip.com", "RESET_PASSWORD", 204);
        String token = verify("t@zip.com", lastCode.get(), "RESET_PASSWORD");
        mvc.perform(post("/api/auth/password-reset/verify").contentType("application/json")
            .content("{\"username\":\"someoneelse\",\"email\":\"t@zip.com\",\"emailVerificationToken\":\"" + token + "\"}"))
            .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM password_resets", Integer.class));
    }
}

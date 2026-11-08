package com.zip.backend;

import com.zip.backend.auth.AuthService;
import com.zip.backend.auth.OAuthLoginHandler;
import com.zip.backend.common.ApiException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Google login with Google itself replaced by fake profile data (no network, no real credentials). */
@SpringBootTest(properties = {"zip.oauth.google.client-id=test-client-id", "zip.oauth.google.client-secret=test-secret",
    "zip.oauth.frontend-url=http://localhost:3000"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class GoogleLoginIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired OAuthLoginHandler handler;

    @Test void authorizationEndpointRedirectsToGoogleWithRegisteredRedirectUri() throws Exception {
        var location = mvc.perform(get("/api/oauth2/authorization/google")).andExpect(status().is3xxRedirection())
            .andReturn().getResponse().getRedirectedUrl();
        assertTrue(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), location);
        assertTrue(location.contains("client_id=test-client-id"), location);
        assertTrue(location.contains("redirect_uri=http://localhost/login/oauth2/code/google"), location);
        assertTrue(location.contains("scope=openid%20profile%20email"), location);
        assertTrue(location.contains("state="), location);
    }

    @Test void firstGoogleLoginCreatesAccountThatNeedsConsent() throws Exception {
        String token = auth.socialLogin("GOOGLE", "sub-1", "Kim@Gmail.com", "김지기");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.provider").value("google"))
            .andExpect(jsonPath("$.nickname").value("김지기")).andExpect(jsonPath("$.email").value("kim@gmail.com"))
            .andExpect(jsonPath("$.agreedAt").doesNotExist()).andExpect(jsonPath("$.username").doesNotExist());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM social_accounts WHERE provider = 'GOOGLE'", Integer.class));
    }

    @Test void secondGoogleLoginReusesTheSameAccount() {
        auth.socialLogin("GOOGLE", "sub-1", "a@gmail.com", "김지기");
        auth.socialLogin("GOOGLE", "sub-1", "a@gmail.com", "김지기");
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM auth_sessions", Integer.class));
    }

    @Test void emailOfAnotherAccountIsRejectedNotMerged() {
        jdbc.update("INSERT INTO users (login_id, email, nickname) VALUES ('tester01', 'a@gmail.com', '테스터')");
        var error = assertThrows(ApiException.class, () -> auth.socialLogin("GOOGLE", "sub-9", "a@gmail.com", "x y"));
        assertEquals("EMAIL_EXISTS", error.code());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM social_accounts", Integer.class));
    }

    @Test void suspendedGoogleUserIsRejected() {
        auth.socialLogin("GOOGLE", "sub-1", "a@gmail.com", "김지기");
        jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        var error = assertThrows(ApiException.class, () -> auth.socialLogin("GOOGLE", "sub-1", "a@gmail.com", "김지기"));
        assertEquals("SUSPENDED", error.code());
    }

    @Test void nicknameIsAlwaysValid() {
        auth.socialLogin("GOOGLE", "s1", null, "가나다라마바사아자차카타파하");
        auth.socialLogin("GOOGLE", "s2", null, "A");
        assertEquals(List.of("ZIP 사용자", "가나다라마바사아자차카타"),
            jdbc.queryForList("SELECT nickname FROM users ORDER BY nickname", String.class));
    }

    private MockHttpServletResponse finish(Map<String, Object> profile) throws Exception {
        var principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("OIDC_USER")), profile, "sub");
        var response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response,
            new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google"));
        return response;
    }

    @Test void handlerRedirectsToFrontendCallbackWithWorkingToken() throws Exception {
        var response = finish(Map.of("sub", "sub-1", "email", "a@gmail.com", "email_verified", true, "name", "김지기"));
        String url = response.getRedirectedUrl();
        assertTrue(url.startsWith("http://localhost:3000/oauth/callback?token="), url);
        String token = url.substring(url.indexOf("token=") + 6);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }

    @Test void unverifiedGoogleEmailIsNotStored() throws Exception {
        finish(Map.of("sub", "sub-1", "email", "a@gmail.com", "email_verified", false, "name", "김지기"));
        assertNull(jdbc.queryForObject("SELECT email FROM users", String.class));
    }

    @Test void handlerReportsFailureReasonToFrontend() throws Exception {
        jdbc.update("INSERT INTO users (login_id, email, nickname) VALUES ('tester01', 'a@gmail.com', '테스터')");
        var response = finish(Map.of("sub", "sub-9", "email", "a@gmail.com", "email_verified", true, "name", "김지기"));
        assertTrue(response.getRedirectedUrl().startsWith("http://localhost:3000/oauth/callback?error="), response.getRedirectedUrl());
        assertFalse(response.getRedirectedUrl().contains("token="));
    }
}

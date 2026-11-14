package com.zip.backend;

import com.zip.backend.auth.OAuthLoginHandler;
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

/** Kakao login with Kakao itself replaced by fake profile data (no network, no real credentials). */
@SpringBootTest(properties = {"zip.oauth.kakao.client-id=kakao-test-id", "zip.oauth.kakao.client-secret=kakao-test-secret",
    "zip.oauth.naver.client-id=naver-test-id", "zip.oauth.naver.client-secret=naver-test-secret",
    "zip.oauth.frontend-url=http://localhost:3000"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class KakaoLoginIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired OAuthLoginHandler handler;

    @Test void authorizationEndpointRedirectsToKakaoWithRegisteredRedirectUri() throws Exception {
        var location = mvc.perform(get("/api/oauth2/authorization/kakao")).andExpect(status().is3xxRedirection())
            .andReturn().getResponse().getRedirectedUrl();
        assertTrue(location.startsWith("https://kauth.kakao.com/oauth/authorize"), location);
        assertTrue(location.contains("client_id=kakao-test-id"), location);
        assertTrue(location.contains("redirect_uri=http://localhost/login/oauth2/code/kakao"), location);
        assertTrue(location.contains("state="), location);
    }

    @Test void naverStillWorksNextToKakao() throws Exception {
        var location = mvc.perform(get("/api/oauth2/authorization/naver")).andExpect(status().is3xxRedirection())
            .andReturn().getResponse().getRedirectedUrl();
        assertTrue(location.startsWith("https://nid.naver.com/"), location);
    }

    private MockHttpServletResponse finish(Map<String, Object> kakaoUser) throws Exception {
        // DefaultOAuth2User insists the name attribute exists; use another key when the fake profile has no id.
        var principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("OAUTH2_USER")), kakaoUser,
            kakaoUser.containsKey("id") ? "id" : "properties");
        var response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response,
            new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "kakao"));
        return response;
    }

    private static Map<String, Object> user(Object id, Map<String, Object> account) {
        return Map.of("id", id, "kakao_account", account);
    }

    @Test void firstKakaoLoginCreatesAccountThatNeedsConsent() throws Exception {
        var account = Map.<String, Object>of("email", "Kim@Kakao.com", "is_email_valid", true, "is_email_verified", true,
            "profile", Map.of("nickname", "지기"));
        var response = finish(user(123456789L, account));
        String url = response.getRedirectedUrl();
        assertTrue(url.startsWith("http://localhost:3000/oauth/callback?token="), url);
        String token = url.substring(url.indexOf("token=") + 6);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.provider").value("kakao"))
            .andExpect(jsonPath("$.nickname").value("지기")).andExpect(jsonPath("$.email").value("kim@kakao.com"))
            .andExpect(jsonPath("$.agreedAt").doesNotExist());
        assertEquals("123456789",
            jdbc.queryForObject("SELECT provider_user_id FROM social_accounts WHERE provider = 'KAKAO'", String.class));
    }

    @Test void secondKakaoLoginReusesTheSameAccount() throws Exception {
        var account = Map.<String, Object>of("profile", Map.of("nickname", "지기"));
        finish(user(1L, account));
        finish(user(1L, account));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
    }

    @Test void kakaoWithoutEmailConsentStillWorks() throws Exception {
        var response = finish(Map.of("id", 7L, "properties", Map.of("nickname", "옛날닉")));
        assertTrue(response.getRedirectedUrl().contains("token="), response.getRedirectedUrl());
        assertEquals("옛날닉", jdbc.queryForObject("SELECT nickname FROM users", String.class));
        assertNull(jdbc.queryForObject("SELECT email FROM users", String.class));
    }

    @Test void unverifiedKakaoEmailIsNotStored() throws Exception {
        var account = Map.<String, Object>of("email", "a@kakao.com", "is_email_valid", true, "is_email_verified", false,
            "profile", Map.of("nickname", "지기"));
        finish(user(8L, account));
        assertNull(jdbc.queryForObject("SELECT email FROM users", String.class));
    }

    @Test void kakaoEmailOfAnotherAccountIsRejected() throws Exception {
        jdbc.update("INSERT INTO users (login_id, email, nickname) VALUES ('tester01', 'a@kakao.com', '테스터')");
        var account = Map.<String, Object>of("email", "a@kakao.com", "is_email_valid", true, "is_email_verified", true);
        var response = finish(user(9L, account));
        assertTrue(response.getRedirectedUrl().startsWith("http://localhost:3000/oauth/callback?error="),
            response.getRedirectedUrl());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM social_accounts", Integer.class));
    }

    @Test void missingKakaoIdIsReportedAsError() throws Exception {
        var response = finish(Map.of("properties", Map.of("nickname", "x")));
        assertTrue(response.getRedirectedUrl().contains("error="), response.getRedirectedUrl());
    }
}

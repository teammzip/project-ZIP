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

/** Naver login with Naver itself replaced by fake profile data (no network, no real credentials). */
@SpringBootTest(properties = {"zip.oauth.naver.client-id=naver-test-id", "zip.oauth.naver.client-secret=naver-test-secret",
    "zip.oauth.google.client-id=test-client-id", "zip.oauth.google.client-secret=test-secret",
    "zip.oauth.frontend-url=http://localhost:3000"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class NaverLoginIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired OAuthLoginHandler handler;

    @Test void authorizationEndpointRedirectsToNaverWithRegisteredRedirectUri() throws Exception {
        var location = mvc.perform(get("/api/oauth2/authorization/naver")).andExpect(status().is3xxRedirection())
            .andReturn().getResponse().getRedirectedUrl();
        assertTrue(location.startsWith("https://nid.naver.com/oauth2.0/authorize"), location);
        assertTrue(location.contains("client_id=naver-test-id"), location);
        assertTrue(location.contains("redirect_uri=http://localhost/login/oauth2/code/naver"), location);
        assertTrue(location.contains("state="), location);
    }

    @Test void googleStillWorksNextToNaver() throws Exception {
        var location = mvc.perform(get("/api/oauth2/authorization/google")).andExpect(status().is3xxRedirection())
            .andReturn().getResponse().getRedirectedUrl();
        assertTrue(location.startsWith("https://accounts.google.com/"), location);
    }

    private MockHttpServletResponse finish(Map<String, Object> naverProfile) throws Exception {
        // Naver's real shape: the profile is nested under "response".
        var attributes = Map.<String, Object>of("resultcode", "00", "message", "success", "response", naverProfile);
        var principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("OAUTH2_USER")), attributes, "response");
        var response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response,
            new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "naver"));
        return response;
    }

    @Test void firstNaverLoginCreatesAccountThatNeedsConsent() throws Exception {
        var response = finish(Map.of("id", "naver-1", "email", "Kim@Naver.com", "nickname", "지기", "name", "김지기"));
        String url = response.getRedirectedUrl();
        assertTrue(url.startsWith("http://localhost:3000/oauth/callback?token="), url);
        String token = url.substring(url.indexOf("token=") + 6);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.provider").value("naver"))
            .andExpect(jsonPath("$.nickname").value("지기")).andExpect(jsonPath("$.email").value("kim@naver.com"))
            .andExpect(jsonPath("$.agreedAt").doesNotExist());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM social_accounts WHERE provider = 'NAVER'", Integer.class));
    }

    @Test void secondNaverLoginReusesTheSameAccount() throws Exception {
        finish(Map.of("id", "naver-1", "email", "a@naver.com", "nickname", "지기"));
        finish(Map.of("id", "naver-1", "email", "a@naver.com", "nickname", "지기"));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class));
    }

    @Test void naverWithoutEmailOrNicknameStillWorks() throws Exception {
        var response = finish(Map.of("id", "naver-2"));
        assertTrue(response.getRedirectedUrl().contains("token="), response.getRedirectedUrl());
        assertEquals("ZIP 사용자", jdbc.queryForObject("SELECT nickname FROM users", String.class));
        assertNull(jdbc.queryForObject("SELECT email FROM users", String.class));
    }

    @Test void naverEmailOfAnotherAccountIsRejected() throws Exception {
        jdbc.update("INSERT INTO users (login_id, email, nickname) VALUES ('tester01', 'a@naver.com', '테스터')");
        var response = finish(Map.of("id", "naver-9", "email", "a@naver.com", "nickname", "지기"));
        assertTrue(response.getRedirectedUrl().startsWith("http://localhost:3000/oauth/callback?error="), response.getRedirectedUrl());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM social_accounts", Integer.class));
    }

    @Test void missingNaverIdIsReportedAsError() throws Exception {
        var response = finish(Map.of("email", "a@naver.com"));
        assertTrue(response.getRedirectedUrl().contains("error="), response.getRedirectedUrl());
    }
}

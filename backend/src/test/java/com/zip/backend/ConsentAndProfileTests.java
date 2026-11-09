package com.zip.backend;

import com.zip.backend.auth.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** PATCH /api/auth/me: a social user's first consent, and plain nickname changes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class ConsentAndProfileTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;

    private static final String CONSENT = """
        {"address":"서울 마포구 합정동","agreeTerms":true,"agreePrivacy":true,"agreePolicy":true,"ageOver14":true,"termsVersion":"%s"}""";

    private String socialToken() { return auth.socialLogin("GOOGLE", "sub-1", "a@gmail.com", "김지기"); }

    private org.springframework.test.web.servlet.ResultActions updateMe(String token, String body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/auth/me").header("Authorization", "Bearer " + token).contentType("application/json").content(body));
    }

    @Test void firstConsentSavesAddressAgreementsAndAge() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk())
            .andExpect(jsonPath("$.agreedAt").isString()).andExpect(jsonPath("$.address").value("서울 마포구 합정동"));
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT age_confirmed_at FROM users", java.sql.Timestamp.class));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.agreedAt").isString());
    }

    @Test void consentCanOnlyBeGivenOnce() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk());
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isBadRequest());
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
    }

    @Test void outdatedFutureOrMissingVersionIsRejectedAndNothingIsSaved() throws Exception {
        String token = socialToken();
        for (String version : new String[] {"2020-01-01", "2099-01-01", ""}) {
            updateMe(token, CONSENT.formatted(version)).andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
        assertNull(jdbc.queryForObject("SELECT address FROM users", String.class));
    }

    @Test void everyAgreementAndAnAddressAreRequired() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18").replace("\"agreePolicy\":true", "\"agreePolicy\":false")).andExpect(status().isBadRequest());
        updateMe(token, CONSENT.formatted("2026-10-18").replace("\"ageOver14\":true", "\"ageOver14\":null")).andExpect(status().isBadRequest());
        updateMe(token, CONSENT.formatted("2026-10-18").replace("서울 마포구 합정동", "   ")).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
    }

    @Test void nicknameChangeNeedsNoConsentAndIsValidated() throws Exception {
        String token = socialToken();
        updateMe(token, "{\"nickname\":\"새닉네임\"}").andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("새닉네임"));
        updateMe(token, "{\"nickname\":\"가\"}").andExpect(status().isBadRequest());
        updateMe(token, "{\"nickname\":\"열두글자를넘기는아주긴닉네임\"}").andExpect(status().isBadRequest());
        updateMe(token, "{}").andExpect(status().isBadRequest());
        assertEquals("새닉네임", jdbc.queryForObject("SELECT nickname FROM users", String.class));
    }

    @Test void requiresLogin() throws Exception {
        mvc.perform(patch("/api/auth/me").contentType("application/json").content("{\"nickname\":\"새닉네임\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test void malformedConsentCannotPartiallySave() throws Exception {
        String token = socialToken();
        String valid = CONSENT.formatted("2026-10-18");
        for (String body : java.util.List.of(
            valid.replace("\"agreeTerms\":true", "\"agreeTerms\":\"true\""),
            valid.replace("서울 마포구 합정동", "가".repeat(201)),
            valid.replace("\"address\":", "\"role\":\"ADMIN\",\"address\":"),
            valid.replace("\"address\":", "\"bio\":\"소개\",\"address\":"))) {
            updateMe(token, body).andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
        assertNull(jdbc.queryForObject("SELECT address FROM users", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_profiles", Integer.class));
    }

    @Test void consentAndProfileUpdatesWorkSequentiallyAndRevokedSessionIsRejected() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk());
        updateMe(token, "{\"bio\":\"소개\",\"avatarEmoji\":\"🐻\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.bio").value("소개"))
            .andExpect(jsonPath("$.agreedAt").isString());
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isUnauthorized());
    }
}

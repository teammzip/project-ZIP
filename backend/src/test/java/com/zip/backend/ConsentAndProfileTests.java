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

    @Test void everyAgreementIsRequired() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18").replace("\"agreePolicy\":true", "\"agreePolicy\":false")).andExpect(status().isBadRequest());
        updateMe(token, CONSENT.formatted("2026-10-18").replace("\"ageOver14\":true", "\"ageOver14\":null")).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
    }

    /** 주소는 가입 뒤 주거 설문에서 받으므로 첫 동의에서는 없어도 돼요 (동네는 비어 있음) */
    @Test void firstConsentWithoutAddress() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18").replace("\"address\":\"서울 마포구 합정동\",", "")).andExpect(status().isOk())
            .andExpect(jsonPath("$.agreedAt").isString()).andExpect(jsonPath("$.address").value(""));
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
        assertEquals(null, jdbc.queryForObject("SELECT region_id FROM users", Long.class));
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

    @Test void consentedUserCanChangeAddressAlone() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk());
        // e.g. after neighborhood verification: only the address is sent
        updateMe(token, "{\"address\":\"서울시 용산구 이태원동\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value("서울시 용산구 이태원동")).andExpect(jsonPath("$.agreedAt").isString());
        assertEquals("서울시 용산구 이태원동", jdbc.queryForObject("SELECT address FROM users", String.class));
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM user_term_agreements", Integer.class));
    }

    @Test void addressAloneIsRejectedBeforeConsentOrWhenInvalid() throws Exception {
        String token = socialToken();
        updateMe(token, "{\"address\":\"서울 마포구\"}").andExpect(status().isBadRequest());
        assertNull(jdbc.queryForObject("SELECT address FROM users", String.class));
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk());
        updateMe(token, "{\"address\":\"  \"}").andExpect(status().isBadRequest());
        updateMe(token, "{\"address\":\"" + "가".repeat(201) + "\"}").andExpect(status().isBadRequest());
        assertEquals("서울 마포구 합정동", jdbc.queryForObject("SELECT address FROM users", String.class));
    }

    @Test void addressAndNicknameCanChangeTogether() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk());
        updateMe(token, "{\"address\":\"서울 서대문구\",\"nickname\":\"새닉네임\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value("서울 서대문구")).andExpect(jsonPath("$.nickname").value("새닉네임"));
    }

    @Test void addressSetsRegionFromItsDistrictAndResetsVerificationWhenItChanges() throws Exception {
        String token = socialToken();
        updateMe(token, CONSENT.formatted("2026-10-18")).andExpect(status().isOk())
            .andExpect(jsonPath("$.region.id").value("2")).andExpect(jsonPath("$.region.name").value("마포구"));
        jdbc.update("UPDATE users SET region_verified_at = CURRENT_TIMESTAMP");
        // same district, different street: verification is kept
        updateMe(token, "{\"address\":\"서울특별시 마포구 망원동\"}").andExpect(status().isOk()).andExpect(jsonPath("$.region.id").value("2"));
        assertNotNull(jdbc.queryForObject("SELECT region_verified_at FROM users", java.sql.Timestamp.class));
        updateMe(token, "{\"address\":\"서울시 용산구 이태원동\"}").andExpect(status().isOk()).andExpect(jsonPath("$.region.id").value("3"));
        assertNull(jdbc.queryForObject("SELECT region_verified_at FROM users", java.sql.Timestamp.class));
        // no known district → no region
        updateMe(token, "{\"address\":\"서울 서대문구\"}").andExpect(status().isOk()).andExpect(jsonPath("$.region").isEmpty());
        assertNull(jdbc.queryForObject("SELECT region_id FROM users", Long.class));
    }
}

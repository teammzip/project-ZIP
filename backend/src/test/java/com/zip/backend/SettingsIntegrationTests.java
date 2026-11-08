package com.zip.backend;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class SettingsIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;

    @BeforeEach void seed() {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'tester01', ?, '회원하나'), (2, 'tester02', ?, '회원둘')", hash, hash);
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("loginId", id, "password", "abcd123!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.accessToken");
    }

    private Map<String, Object> basic() {
        return new LinkedHashMap<>(Map.of("rent", 55.0001, "rentDay", 15, "moveIn", "2026-01", "contractEnd", "2027-01", "notiOn", true));
    }

    private org.springframework.test.web.servlet.ResultActions putSettings(String token, Map<String, Object> body) throws Exception {
        return mvc.perform(put("/api/me/settings").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(json.writeValueAsString(body)));
    }

    @Test void defaultsAreReturnedWithoutCreatingRows() throws Exception {
        mvc.perform(get("/api/me/settings").header("Authorization", "Bearer " + login("tester01")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rent").value(0))
            .andExpect(jsonPath("$.rentDay").value(15)).andExpect(jsonPath("$.notiOn").value(true))
            .andExpect(jsonPath("$.homeAddress").value("")).andExpect(jsonPath("$.moveIn").value(""))
            .andExpect(jsonPath("$.regionLocation").isEmpty());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_settings", Integer.class));
    }

    @Test void saveReadAndReloginPersistSettingsSeparatelyForEachUser() throws Exception {
        String token = login("tester01");
        var body = basic(); body.put("homeAddress", "  서울 마포구 테스트주소  "); body.put("notiOn", false);
        putSettings(token, body).andExpect(status().isOk()).andExpect(jsonPath("$.rent").value(55.0001))
            .andExpect(jsonPath("$.homeAddress").value("서울 마포구 테스트주소")).andExpect(jsonPath("$.notiOn").value(false));
        mvc.perform(get("/api/me/settings").header("Authorization", "Bearer " + login("tester01")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rent").value(55.0001));
        mvc.perform(get("/api/me/settings").header("Authorization", "Bearer " + login("tester02")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rent").value(0));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM user_settings", Integer.class));
    }

    @Test void invalidInputsAreRejectedWithoutWritingRows() throws Exception {
        String token = login("tester01");
        Map<String, Object> cases = new LinkedHashMap<>();
        cases.put("rent", -1); cases.put("rentDay", 32); cases.put("moveIn", "2026-13");
        cases.put("contractEnd", "2025-12"); cases.put("notiOn", "true"); cases.put("homeAddress", "가".repeat(201));
        cases.put("userId", "2"); cases.put("regionId", "999");
        for (var entry : cases.entrySet()) {
            var body = basic(); body.put(entry.getKey(), entry.getValue());
            putSettings(token, body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isString());
        }
        for (Object rent : java.util.List.of("55", 1.00001, 10_000_000_000L)) {
            var body = basic(); body.put("rent", rent); putSettings(token, body).andExpect(status().isBadRequest());
        }
        var noDay = basic(); noDay.remove("rentDay"); putSettings(token, noDay).andExpect(status().isBadRequest());
        var fractionalDay = basic(); fractionalDay.put("rentDay", 15.5); putSettings(token, fractionalDay).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_settings", Integer.class));
    }

    @Test void manualRegionIsStoredAndForgedVerificationIsRejected() throws Exception {
        String token = login("tester01");
        var body = basic(); body.put("regionId", "2"); body.put("regionName", "서울 마포구");
        body.put("regionLocation", Map.of("region", "서울 마포구", "source", "manual", "point", Map.of("lat", 37.5, "lon", 126.9)));
        putSettings(token, body).andExpect(status().isOk()).andExpect(jsonPath("$.regionId").value("2"))
            .andExpect(jsonPath("$.regionLocation.source").value("manual"));
        body.put("regionLocation", Map.of("region", "서울 마포구", "source", "verified"));
        putSettings(token, body).andExpect(status().isBadRequest());
        body.put("regionName", "서울 용산구");
        body.put("regionLocation", Map.of("region", "서울 용산구", "source", "manual"));
        putSettings(token, body).andExpect(status().isBadRequest());
        assertEquals("MANUAL", jdbc.queryForObject("SELECT region_source FROM user_settings WHERE user_id = 1", String.class));
        assertEquals(2L, jdbc.queryForObject("SELECT region_id FROM users WHERE id = 1", Long.class));
    }

    @Test void registryOnlyLegacySettingsCanBeReadAndWrittenBack() throws Exception {
        String token = login("tester01");
        jdbc.update("UPDATE users SET region_id = 2 WHERE id = 1");
        String response = mvc.perform(get("/api/me/settings").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        mvc.perform(put("/api/me/settings").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(response)).andExpect(status().isOk())
            .andExpect(jsonPath("$.regionId").value("2"))
            .andExpect(jsonPath("$.regionLocation.source").value("manual"));
    }

    @Test void regionChangesResetVerificationButHomeAddressChangesPreserveIt() throws Exception {
        String token = login("tester01");
        jdbc.update("INSERT INTO user_settings (user_id, region_name, region_source, region_lat, region_lon) VALUES (1, '서울 마포구', 'VERIFIED', 37.5, 126.9)");
        jdbc.update("UPDATE users SET region_id = 2, region_verified_at = CURRENT_TIMESTAMP, home_lat = 1, home_lon = 2 WHERE id = 1");
        var homeOnly = basic(); homeOnly.put("homeAddress", "상세주소만 변경");
        putSettings(token, homeOnly).andExpect(status().isOk());
        assertNotNull(jdbc.queryForObject("SELECT region_verified_at FROM users WHERE id = 1", java.sql.Timestamp.class));
        var region = basic(); region.put("regionId", "3"); region.put("regionName", "서울 용산구");
        putSettings(token, region).andExpect(status().isOk()).andExpect(jsonPath("$.regionLocation.source").value("manual"));
        assertNull(jdbc.queryForObject("SELECT region_verified_at FROM users WHERE id = 1", java.sql.Timestamp.class));
        assertEquals(1, jdbc.queryForObject("SELECT home_lat FROM users WHERE id = 1", java.math.BigDecimal.class).intValue());
    }

    @Test void optionalValuesCanBeClearedAndUnrelatedSettingsSurvive() throws Exception {
        String token = login("tester01"); putSettings(token, basic()).andExpect(status().isOk());
        jdbc.update("UPDATE user_settings SET home_memo_ids = '[\"1\"]', ledger_category_settings = '{\"custom\":[]}' WHERE user_id = 1");
        var body = basic(); body.put("moveIn", ""); body.put("contractEnd", ""); body.put("homeAddress", null); body.put("regionLocation", null);
        putSettings(token, body).andExpect(status().isOk()).andExpect(jsonPath("$.moveIn").value(""))
            .andExpect(jsonPath("$.regionLocation").isEmpty());
        assertEquals("[\"1\"]", jdbc.queryForObject("SELECT home_memo_ids FROM user_settings WHERE user_id = 1", String.class));
        assertEquals("{\"custom\":[]}", jdbc.queryForObject("SELECT ledger_category_settings FROM user_settings WHERE user_id = 1", String.class));
    }

    @Test void incompleteOrInvalidCoordinatesDoNotSave() throws Exception {
        String token = login("tester01");
        for (Map<String, Object> point : java.util.List.<Map<String, Object>>of(Map.of("lat", 37.5), Map.of("lat", 91, "lon", 127), Map.of("lat", 37.1234567, "lon", 127))) {
            var body = basic(); body.put("regionLocation", Map.of("region", "테스트동네", "source", "manual", "point", point));
            putSettings(token, body).andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_settings", Integer.class));
    }

    @Test void unauthenticatedAndRevokedSessionsCannotAccessSettings() throws Exception {
        mvc.perform(get("/api/me/settings")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/settings").contentType("application/json").content(json.writeValueAsString(basic())))
            .andExpect(status().isUnauthorized());
        String token = login("tester01");
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        putSettings(token, basic()).andExpect(status().isUnauthorized());
    }
}

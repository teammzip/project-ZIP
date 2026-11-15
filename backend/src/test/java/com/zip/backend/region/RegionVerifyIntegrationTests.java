package com.zip.backend.region;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.zip.backend.map.KakaoLocalClient;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.client.ResourceAccessException;

/** 동네 인증: GPS → 카카오 행정구역 → 내 동네 · 인증 시각, 30일 유지, 커뮤니티 쓰기 조건 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/community-fixture.sql"})
class RegionVerifyIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean KakaoLocalClient kakao;
    @Autowired RegionVerifyService service;
    String token;

    private static final double MAPO_LAT = 37.5496, MAPO_LON = 126.9137;

    @BeforeEach void seed() throws Exception {
        service.resetLimits();
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname, region_id) VALUES (1, 'member01', ?, '회원하나', 3)", passwords.encode("abcd123!"));
        token = JsonPath.read(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"member01\",\"password\":\"abcd123!\"}")).andReturn().getResponse().getContentAsString(), "$.accessToken");
        when(kakao.enabled()).thenReturn(true);
        when(kakao.coordToRegion(anyDouble(), anyDouble())).thenReturn(List.of(
            new KakaoLocalClient.RegionDocument("B", "서울특별시", "마포구", "합정동"),
            new KakaoLocalClient.RegionDocument("H", "서울특별시", "마포구", "합정동")));
    }

    private ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
        request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private ResultActions verify(double lat, double lon) throws Exception {
        return call(post("/api/me/region-verify"), "{\"lat\":" + lat + ",\"lon\":" + lon + "}");
    }

    private ResultActions writePost() throws Exception {
        return call(post("/api/posts"), "{\"category\":\"FREE\",\"title\":\"제목\",\"body\":\"내용\"}");
    }

    @Test void verifyingSetsRegionAndUnlocksCommunity() throws Exception {
        call(get("/api/auth/me"), null).andExpect(jsonPath("$.regionVerifiedAt").isEmpty());
        writePost().andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REGION_VERIFY_REQUIRED"));

        verify(MAPO_LAT, MAPO_LON).andExpect(status().isOk())
            .andExpect(jsonPath("$.region.id").value("2")).andExpect(jsonPath("$.region.fullName").value("서울특별시 마포구"))
            .andExpect(jsonPath("$.dong").value("합정동")).andExpect(jsonPath("$.expiresAt").isString());
        assertEquals(2L, jdbc.queryForObject("SELECT region_id FROM users WHERE id = 1", Long.class)); // 용산구 → 마포구
        call(get("/api/auth/me"), null).andExpect(jsonPath("$.regionVerifiedAt").isString()).andExpect(jsonPath("$.region.name").value("마포구"));
        writePost().andExpect(status().isCreated());
    }

    @Test void verificationExpiresAfterThirtyDays() throws Exception {
        jdbc.update("UPDATE users SET region_verified_at = ? WHERE id = 1", Timestamp.from(Instant.now().minusSeconds(31L * 86400)));
        call(get("/api/auth/me"), null).andExpect(jsonPath("$.regionVerifiedAt").isEmpty());
        writePost().andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REGION_VERIFY_REQUIRED"));
        jdbc.update("UPDATE users SET region_verified_at = ? WHERE id = 1", Timestamp.from(Instant.now().minusSeconds(29L * 86400)));
        writePost().andExpect(status().isCreated());
    }

    @Test void unknownDistrictIsCreatedFromKakao() throws Exception {
        when(kakao.coordToRegion(anyDouble(), anyDouble())).thenReturn(List.of(new KakaoLocalClient.RegionDocument("H", "경기도", "성남시 분당구", "정자동")));
        String response = verify(37.36, 127.11).andExpect(status().isOk()).andExpect(jsonPath("$.region.fullName").value("경기도 성남시 분당구"))
            .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(JsonPath.read(response, "$.region.id"));
        assertEquals(2, jdbc.queryForObject("SELECT level FROM regions WHERE id = ?", Integer.class, id));
        // 한 번 더 해도 같은 동네를 또 만들지 않음
        verify(37.36, 127.11).andExpect(jsonPath("$.region.id").value(Long.toString(id)));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM regions WHERE name = '경기도'", Integer.class));
    }

    @Test void invalidOrUnavailable() throws Exception {
        call(post("/api/me/region-verify"), "{}").andExpect(status().isBadRequest());
        verify(35.68, 139.69).andExpect(status().isBadRequest()); // 도쿄
        when(kakao.coordToRegion(anyDouble(), anyDouble())).thenReturn(List.of());
        verify(MAPO_LAT, MAPO_LON).andExpect(status().isBadRequest());
        when(kakao.coordToRegion(anyDouble(), anyDouble())).thenThrow(new ResourceAccessException("timeout"));
        verify(MAPO_LAT, MAPO_LON).andExpect(status().isServiceUnavailable());
        when(kakao.enabled()).thenReturn(false);
        verify(MAPO_LAT, MAPO_LON).andExpect(status().isServiceUnavailable());
        assertEquals(3L, jdbc.queryForObject("SELECT region_id FROM users WHERE id = 1", Long.class)); // 그대로
    }

    @Test void tooManyAttemptsAreLimited() throws Exception {
        for (int i = 0; i < RegionVerifyService.PER_USER_PER_HOUR; i++) verify(MAPO_LAT, MAPO_LON).andExpect(status().isOk());
        verify(MAPO_LAT, MAPO_LON).andExpect(status().isTooManyRequests());
    }
}

package com.zip.backend;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
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

/**
 * 월별 고정 지출(/api/bills/monthly)의 납부 · 해지 저장과 동시 납부.
 * 예전 일반 고정 지출 API(/api/bills, /api/bills/{id}, /api/bills/{id}/payments/{month})는 화면이 쓰지 않아 2026-11-28 에 지웠고,
 * 그 API 의 테스트도 함께 지웠다. 권한 · 인증 · 중복은 BillMonthlyWriteTests · BillMonthlyDeleteTests · BillMonthlyTests 가 확인한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql","/home-info-fixture.sql"})
class BillIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;
    private String token;
    private final YearMonth current = YearMonth.now(ZoneId.of("Asia/Seoul"));

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'tester01', ?, '회원하나'), (2, 'tester02', ?, '회원둘')", hash, hash);
        token = login("tester01");
    }

    private String login(String id) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("loginId", id, "password", "abcd123!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
    }

    /** 이번 달 월별 고정 지출 등록 (납부 기한은 오늘 — 오늘은 항상 이번 달) */
    private String registerMonthly() throws Exception {
        String due = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
        String body = mvc.perform(post("/api/bills/monthly").param("month", current.toString()).param("timeZone", "Asia/Seoul")
            .header("Authorization", "Bearer " + token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("name", "관리비", "tag", "관리비", "amount", 50000, "dueDate", due))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("관리비"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.id");
    }

    private org.springframework.test.web.servlet.ResultActions pay(String id) throws Exception {
        return mvc.perform(put("/api/bills/monthly/" + id + "/payment").param("month", current.toString()).param("timeZone", "Asia/Seoul")
            .header("Authorization", "Bearer " + token).contentType("application/json").content("{\"paid\":true}"));
    }

    @Test void monthlyPaymentAndChosenTerminationRoutesPersistToDatabase() throws Exception {
        String id = registerMonthly();
        pay(id).andExpect(status().isNoContent());
        assertNotNull(jdbc.queryForObject("SELECT paid_at FROM bill_payments WHERE bill_item_id=?", java.sql.Timestamp.class, Long.valueOf(id)));
        String effective = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1).toString();
        mvc.perform(post("/api/bills/monthly/" + id + "/termination").param("timeZone", "Asia/Seoul")
            .header("Authorization", "Bearer " + token).contentType("application/json").content(json.writeValueAsString(Map.of("effectiveDate", effective))))
            .andExpect(status().isNoContent());
        assertEquals(effective, jdbc.queryForObject("SELECT termination_date FROM bill_items WHERE id=?", java.sql.Date.class, Long.valueOf(id)).toString());
        assertNull(jdbc.queryForObject("SELECT deleted_at FROM bill_payments WHERE bill_item_id=?", java.sql.Timestamp.class, Long.valueOf(id)));
    }

    /** 같은 달 납부를 두 번 동시에 눌러도 월별 기록은 한 줄 (예전 API 테스트에서 옮김) */
    @Test void concurrentMonthlyPaymentRequestsKeepOneRow() throws Exception {
        String id = registerMonthly();
        var start = new java.util.concurrent.CountDownLatch(1);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<Integer> request = () -> {
                start.await();
                return pay(id).andReturn().getResponse().getStatus();
            };
            var a = executor.submit(request); var b = executor.submit(request); start.countDown();
            assertEquals(204, a.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(204, b.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=?", Integer.class, Long.valueOf(id)));
            assertNotNull(jdbc.queryForObject("SELECT paid_at FROM bill_payments WHERE bill_item_id=?", java.sql.Timestamp.class, Long.valueOf(id)));
        } finally { executor.shutdownNow(); }
    }
}

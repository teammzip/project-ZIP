package com.zip.backend;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
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

    private String create() throws Exception {
        String body = mvc.perform(post("/api/bills").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"name\":\" 관리비 \",\"amount\":50000,\"tag\":\"관리비\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("관리비"))
            .andExpect(jsonPath("$.snapshot").value(true)).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.id");
    }

    private org.springframework.test.web.servlet.ResultActions payment(String id, YearMonth month, String body) throws Exception {
        return mvc.perform(put("/api/bills/" + id + "/payments/" + month).header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body));
    }

    @Test void createListAndReloginKeepData() throws Exception {
        mvc.perform(get("/api/bills").param("month", current.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        create();
        mvc.perform(get("/api/bills").param("month", current.toString()).header("Authorization", "Bearer " + login("tester01")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].amount").value(50000))
            .andExpect(jsonPath("$[0].paid").value(false)).andExpect(jsonPath("$[0].id").isString());
    }

    @Test void duplicateNamesAndRenameConflictsAreRejected() throws Exception {
        create();
        mvc.perform(post("/api/bills").header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"name\":\"관리비\",\"amount\":60000,\"tag\":\"관리비\"}")).andExpect(status().isConflict());
        String second = mvc.perform(post("/api/bills").header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"name\":\"전기\",\"amount\":30000,\"tag\":\"관리비\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(second, "$.id");
        mvc.perform(patch("/api/bills/" + id).header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"name\":\"관리비\"}")).andExpect(status().isConflict());
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM bill_items", Integer.class));
    }

    @Test void repeatedPaymentIsIdempotentAndAmountOnlyEditPreservesPaidTime() throws Exception {
        String id = create();
        String body = payment(id, current, "{\"paid\":true}").andExpect(status().isOk())
            .andExpect(jsonPath("$.paid").value(true)).andReturn().getResponse().getContentAsString();
        String at = com.jayway.jsonpath.JsonPath.read(body, "$.paidAt");
        payment(id, current, "{\"paid\":true}").andExpect(status().isOk()).andExpect(jsonPath("$.paidAt").value(at));
        payment(id, current, "{\"amount\":45000}").andExpect(status().isOk())
            .andExpect(jsonPath("$.amount").value(45000)).andExpect(jsonPath("$.paidAt").value(at));
        payment(id, current, "{\"paid\":false}").andExpect(status().isOk())
            .andExpect(jsonPath("$.paidAt").isEmpty()).andExpect(jsonPath("$.amount").value(45000));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments", Integer.class));
    }

    @Test void defaultChangesPreserveCurrentAndPastSnapshots() throws Exception {
        String id = create();
        payment(id, current.minusMonths(1), "{\"amount\":41000,\"paid\":true}").andExpect(status().isOk());
        mvc.perform(patch("/api/bills/" + id).header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"amount\":70000,\"name\":\"새관리비\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.defaultAmount").value(70000)).andExpect(jsonPath("$.amount").value(50000));
        mvc.perform(get("/api/bills").param("month", current.minusMonths(1).toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].amount").value(41000)).andExpect(jsonPath("$[0].paid").value(true));
        mvc.perform(get("/api/bills").param("month", current.plusMonths(1).toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].amount").value(70000)).andExpect(jsonPath("$[0].snapshot").value(false));
    }

    @Test void missingPastMonthsAreNotInventedAndRequireExplicitAmount() throws Exception {
        String id = create();
        var past = current.minusMonths(2);
        mvc.perform(get("/api/bills").param("month", past.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        payment(id, past, "{\"paid\":true}").andExpect(status().isBadRequest());
        payment(id, past, "{\"amount\":32000,\"paid\":true}").andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(32000));
        payment(id, current.plusMonths(1), "{\"paid\":true}").andExpect(status().isBadRequest());
    }

    @Test void deletingStopsFutureBillsAndKeepsHistoricalRecords() throws Exception {
        String id = create(); payment(id, current, "{\"paid\":true}").andExpect(status().isOk());
        mvc.perform(delete("/api/bills/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/bills/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/bills").param("month", current.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].active").value(false)).andExpect(jsonPath("$[0].paid").value(true));
        mvc.perform(get("/api/bills").param("month", current.plusMonths(1).toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch("/api/bills/" + id).header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"amount\":1}")).andExpect(status().isNotFound());
        payment(id, current.minusMonths(1), "{\"amount\":1}").andExpect(status().isNotFound());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_items", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments", Integer.class));
    }

    @Test void otherUsersCannotReadModifyPayOrDeleteOwnedBill() throws Exception {
        String id = create(); token = login("tester02");
        mvc.perform(get("/api/bills").param("month", current.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(patch("/api/bills/" + id).header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"amount\":1}")).andExpect(status().isNotFound());
        payment(id, current, "{\"paid\":true}").andExpect(status().isNotFound());
        mvc.perform(delete("/api/bills/" + id).header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        assertEquals(50000L, jdbc.queryForObject("SELECT amount FROM bill_payments", Long.class));
    }

    @Test void badAmountsFieldsMonthsAndEmptyPatchesDoNotWrite() throws Exception {
        for (String body : java.util.List.of("{}", "{\"name\":\" \",\"amount\":1,\"tag\":\"관리비\"}",
            "{\"name\":\"관리비\",\"amount\":-1,\"tag\":\"관리비\"}", "{\"name\":\"관리비\",\"amount\":1.5,\"tag\":\"관리비\"}",
            "{\"name\":\"관리비\",\"amount\":\"1\",\"tag\":\"관리비\"}", "{\"name\":\"관리비\",\"amount\":9007199254740992,\"tag\":\"관리비\"}",
            "{\"name\":\"관리비\",\"amount\":1,\"tag\":\"관리비\",\"userId\":\"2\"}")) {
            mvc.perform(post("/api/bills").header("Authorization", "Bearer " + token).contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM bill_items", Integer.class));
        String id = create();
        for (String month : java.util.List.of("2026-13", "0000-01", "2026-1", "bad")) {
            mvc.perform(get("/api/bills").param("month", month).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/bills").header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        payment(id, current, "{}").andExpect(status().isBadRequest());
        payment(id, current, "{\"paid\":\"true\"}").andExpect(status().isBadRequest());
        mvc.perform(patch("/api/bills/" + id).header("Authorization", "Bearer " + token).contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
    }

    @Test void noTokenAndRevokedTokenAreRejected() throws Exception {
        mvc.perform(get("/api/bills").param("month", current.toString())).andExpect(status().isUnauthorized());
        String id = create();
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        payment(id, current, "{\"paid\":true}").andExpect(status().isUnauthorized());
    }

    @Test void legacyItemWithoutSnapshotIsReadOnlyUntilExplicitWrite() throws Exception {
        jdbc.update("INSERT INTO bill_items (id, user_id, name, default_amount, tag, created_at) VALUES (100, 1, '기존항목', 12000, '기타', ?)",
            java.sql.Timestamp.from(current.minusMonths(2).atDay(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()));
        mvc.perform(get("/api/bills").param("month", current.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].snapshot").value(false));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments", Integer.class));
        mvc.perform(patch("/api/bills/100").header("Authorization", "Bearer " + token)
            .contentType("application/json").content("{\"amount\":18000}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(12000))
            .andExpect(jsonPath("$.defaultAmount").value(18000)).andExpect(jsonPath("$.snapshot").value(true));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments", Integer.class));
    }

    @Test void concurrentPaymentRequestsProduceOneMonthlyRow() throws Exception {
        String id = create();
        var start = new java.util.concurrent.CountDownLatch(1);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<Integer> request = () -> {
                start.await();
                return payment(id, current, "{\"paid\":true}").andReturn().getResponse().getStatus();
            };
            var a = executor.submit(request); var b = executor.submit(request); start.countDown();
            assertEquals(200, a.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(200, b.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments", Integer.class));
            assertNotNull(jdbc.queryForObject("SELECT paid_at FROM bill_payments", java.sql.Timestamp.class));
        } finally { executor.shutdownNow(); }
    }
}

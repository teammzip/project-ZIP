package com.zip.backend;

import com.zip.backend.auth.AuthService;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
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
@Sql({"/auth-fixture.sql","/home-info-fixture.sql"})
class HomeInfoTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired ObjectMapper json;
    private String token(String id) { return auth.socialLogin("GOOGLE",id,id+"@example.com","검증회원"); }
    private Map<String,Object> monthly() {
        var body=new LinkedHashMap<String,Object>();
        body.put("kind","monthly"); body.put("deposit",10000000); body.put("rent",550003); body.put("rentDay",15);
        body.put("mgmtIncluded",false); body.put("mgmtFee",50000); body.put("contractFee",0);
        body.put("moveIn","2026-01"); body.put("contractEnd","2028-01"); body.put("homeAddress","검증용 집 주소"); body.put("loan",null);
        return body;
    }
    private org.springframework.test.web.servlet.ResultActions save(String token,Map<String,Object> body) throws Exception {
        return mvc.perform(put("/api/me/home-info").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsString(body)));
    }
    private org.springframework.test.web.servlet.ResultActions read(String token) throws Exception { return mvc.perform(get("/api/me/home-info").header("Authorization","Bearer "+token)); }

    @Test void monthlySaveReadAndReloginPreserveSettingsAndNoDuplicateManagement() throws Exception {
        String t=token("monthly");
        read(t).andExpect(status().isOk()).andExpect(jsonPath("$.contract").isEmpty());
        save(t,monthly()).andExpect(status().isOk()).andExpect(jsonPath("$.settings.rent").value(55.0003)).andExpect(jsonPath("$.managementBill.defaultAmount").value(50000));
        save(t,monthly()).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items WHERE is_active=1",Integer.class));
        read(token("monthly")).andExpect(jsonPath("$.contract.kind").value("monthly")).andExpect(jsonPath("$.settings.homeAddress").value("검증용 집 주소"));
        var clear=monthly(); clear.put("moveIn",""); clear.put("contractEnd",""); clear.remove("homeAddress");
        save(t,clear).andExpect(status().isOk()).andExpect(jsonPath("$.settings.moveIn").value("")).andExpect(jsonPath("$.settings.homeAddress").value("검증용 집 주소"));
        assertNull(jdbc.queryForObject("SELECT move_in_ym FROM user_settings",String.class));
    }

    @Test void invalidInputLeavesAllRecordsUnchanged() throws Exception {
        String t=token("invalid"); save(t,monthly()).andExpect(status().isOk());
        for (String field:List.of("rent","deposit","mgmtFee","rentDay")) {
            var body=monthly(); body.put(field,-1); save(t,body).andExpect(status().isBadRequest());
        }
        var bad=monthly(); bad.put("contractEnd","2025-01"); save(t,bad).andExpect(status().isBadRequest());
        bad=monthly(); bad.put("moveIn",null); save(t,bad).andExpect(status().isBadRequest());
        bad=monthly(); bad.put("userId","2"); save(t,bad).andExpect(status().isBadRequest());
        assertEquals(50000,jdbc.queryForObject("SELECT default_amount FROM bill_items",Long.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM home_contracts",Integer.class));
    }

    @Test void failureAfterManagementWriteRollsBackEveryTable() throws Exception {
        String t=token("rollback"); save(t,monthly()).andExpect(status().isOk());
        jdbc.execute("ALTER TABLE home_contracts ADD CONSTRAINT test_max_deposit CHECK(deposit < 20000000)");
        var bad=monthly(); bad.put("deposit",30000000); bad.put("mgmtFee",70000); bad.put("homeAddress","바뀌면 안 되는 주소");
        try { save(t,bad); } catch (Exception expected) { /* unhandled SQL constraint failure is propagated by MockMvc */ }
        assertEquals(50000,jdbc.queryForObject("SELECT default_amount FROM bill_items",Long.class));
        assertEquals("검증용 집 주소",jdbc.queryForObject("SELECT home_address FROM user_settings",String.class));
        assertEquals(10000000,jdbc.queryForObject("SELECT deposit FROM home_contracts",Long.class));
    }

    @Test void jeonseInterestKeepsSnapshotsAndStoppingPreservesHistory() throws Exception {
        String t=token("loan"); var body=monthly(); body.put("kind","jeonse"); body.put("contractFee",20000000);
        body.put("loan",Map.of("principal",100000000,"annualRate",4,"paymentDay",1,"startDate","2026-01-01"));
        save(t,body).andExpect(status().isOk()).andExpect(jsonPath("$.settings.rent").value(0)).andExpect(jsonPath("$.loan.active").value(true));
        long count=jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Long.class);
        assertEquals(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).getDayOfMonth()==1?1:0,count);
        jdbc.update("UPDATE loan_interest_charges SET paid_at=CURRENT_TIMESTAMP");
        var amounts=jdbc.queryForList("SELECT amount FROM loan_interest_charges ORDER BY charge_date",Long.class);
        body.put("loan",Map.of("principal",100000000,"annualRate",6,"paymentDay",1,"startDate","2026-01-01"));
        save(t,body).andExpect(status().isOk()); read(t).andExpect(status().isOk());
        assertEquals(amounts,jdbc.queryForList("SELECT amount FROM loan_interest_charges ORDER BY charge_date",Long.class));
        save(t,monthly()).andExpect(status().isOk()).andExpect(jsonPath("$.loan.active").value(false));
        assertEquals(count,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Long.class));
    }

    @Test void usersAreIsolatedAndAnonymousDenied() throws Exception {
        String a=token("user-a"),b=token("user-b"); save(a,monthly()).andExpect(status().isOk());
        read(b).andExpect(status().isOk()).andExpect(jsonPath("$.contract").isEmpty());
        var body=monthly(); body.put("homeAddress","다른 회원 집"); save(b,body).andExpect(status().isOk());
        read(a).andExpect(jsonPath("$.settings.homeAddress").value("검증용 집 주소"));
        mvc.perform(get("/api/me/home-info")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/home-info").contentType("application/json").content("{}" )).andExpect(status().isUnauthorized());
    }

    @Test void outsideCurrentContractCannotSaveOrWriteHistoricalMonth() throws Exception {
        String t=token("outside-save");
        save(t,monthly()).andExpect(status().isOk());
        var now=java.time.YearMonth.now(java.time.ZoneId.of("Asia/Seoul"));
        for (var first:List.of(now.plusMonths(2),now.minusMonths(3))) {
            var body=monthly(); body.put("moveIn",first.toString()); body.put("contractEnd",first.plusMonths(1).toString());
            save(t,body).andExpect(status().isBadRequest());
        }
        assertEquals("2026-01",jdbc.queryForObject("SELECT move_in_ym FROM user_settings",String.class));
        jdbc.update("UPDATE user_settings SET move_in_ym=?,contract_end_ym=?",now.minusMonths(3).toString(),now.minusMonths(1).toString());
        mvc.perform(post("/api/bills/monthly").param("month",now.minusMonths(2).toString()).param("timeZone","Asia/Seoul")
            .header("Authorization","Bearer "+t).contentType("application/json")
            .content(json.writeValueAsString(Map.of("tag","공과금","amount",10000,"dueDate",now.atEndOfMonth().toString()))))
            .andExpect(status().isBadRequest());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }

    @Test void expiredContractShowsSpecificWarningAndDoesNotChangeHome() throws Exception {
        String t=token("expired-contract-warning");
        save(t,monthly()).andExpect(status().isOk());
        var now=java.time.YearMonth.now(java.time.ZoneId.of("Asia/Seoul"));
        var body=monthly(); body.put("moveIn",now.minusMonths(10).toString()); body.put("contractEnd",now.minusMonths(1).toString());
        body.put("rent",600000); body.put("mgmtFee",70000);
        var result=save(t,body).andExpect(status().isBadRequest()).andReturn();
        assertTrue(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8).contains("계약 종료 월을 확인해 주세요"));
        assertEquals("2028-01",jdbc.queryForObject("SELECT contract_end_ym FROM user_settings",String.class));
        assertEquals(new java.math.BigDecimal("55.0003"),jdbc.queryForObject("SELECT rent_amount FROM user_settings",java.math.BigDecimal.class));
        assertEquals(50000L,jdbc.queryForObject("SELECT default_amount FROM bill_items",Long.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
    }

    @Test void futureMoveInShowsSpecificWarningAndDoesNotChangeHome() throws Exception {
        String t=token("future-move-in-warning");
        save(t,monthly()).andExpect(status().isOk());
        var future=java.time.YearMonth.now(java.time.ZoneId.of("Asia/Seoul")).plusMonths(1);
        var body=monthly(); body.put("moveIn",future.toString()); body.put("contractEnd",future.plusMonths(12).toString());
        body.put("rent",600000); body.put("mgmtFee",70000);
        var result=save(t,body).andExpect(status().isBadRequest()).andReturn();
        assertTrue(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8).contains("입주 월을 확인해 주세요"));
        assertEquals("2026-01",jdbc.queryForObject("SELECT move_in_ym FROM user_settings",String.class));
        assertEquals(50000L,jdbc.queryForObject("SELECT default_amount FROM bill_items",Long.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
    }

    @Test void switchingContractRemovesOnlyUpcomingUnpaidOppositeType() throws Exception {
        String t=token("switch-kind");
        save(t,monthly()).andExpect(status().isOk());
        jdbc.update("UPDATE home_contracts SET billing_time_zone='Asia/Seoul'");
        long user=jdbc.queryForObject("SELECT id FROM users WHERE nickname='검증회원'",Long.class);
        var now=java.time.YearMonth.now(java.time.ZoneId.of("Asia/Seoul"));
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (?,?,550003,?)",user,now.toString(),java.sql.Date.valueOf(now.atEndOfMonth()));
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date,paid_at) VALUES (?,?,550003,?,CURRENT_TIMESTAMP)",user,now.minusMonths(1).toString(),java.sql.Date.valueOf(now.minusMonths(1).atEndOfMonth()));
        var body=monthly(); body.put("kind","jeonse"); body.put("contractFee",20000000);
        body.put("loan",Map.of("principal",100000000,"annualRate",4,"paymentDay",31,"startDate",now.atDay(1).toString()));
        save(t,body).andExpect(status().isOk()).andExpect(jsonPath("$.contract.kind").value("jeonse"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE paid_at IS NULL",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE paid_at IS NOT NULL",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Integer.class));
        var back=monthly(); back.put("rentDay",31);
        save(t,back).andExpect(status().isOk()).andExpect(jsonPath("$.contract.kind").value("monthly"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges WHERE paid_at IS NULL",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE period_ym=?",Integer.class,now.toString()));
    }

    @Test void switchingToMonthlyRefreshesStoredRentAndSeparatesManagementOwnership() throws Exception {
        var today=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
        org.junit.jupiter.api.Assumptions.assumeTrue(today.getDayOfMonth()>1);
        var month=java.time.YearMonth.from(today);
        String t=token("switch-refresh");
        var jeonse=monthly(); jeonse.put("kind","jeonse");
        save(t,jeonse).andExpect(status().isOk());
        jdbc.update("UPDATE home_contracts SET billing_time_zone='Asia/Seoul'");
        long user=jdbc.queryForObject("SELECT id FROM users WHERE nickname='검증회원'",Long.class);
        long oldManaged=jdbc.queryForObject("SELECT management_bill_id FROM home_contracts WHERE user_id=?",Long.class,user);
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (?,?,400000,?)",user,month.toString(),java.sql.Date.valueOf(month.atEndOfMonth()));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date) VALUES (?,?,50000,?)",oldManaged,month.toString(),java.sql.Date.valueOf(month.atEndOfMonth()));
        var body=monthly(); body.put("rent",600000); body.put("rentDay",1); body.put("mgmtFee",70000);
        save(t,body).andExpect(status().isOk());
        long newManaged=jdbc.queryForObject("SELECT management_bill_id FROM home_contracts WHERE user_id=?",Long.class,user);
        assertNotEquals(oldManaged,newManaged);
        assertEquals("jeonse",jdbc.queryForObject("SELECT home_contract_kind FROM bill_items WHERE id=?",String.class,oldManaged));
        assertEquals("monthly",jdbc.queryForObject("SELECT home_contract_kind FROM bill_items WHERE id=?",String.class,newManaged));
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE user_id=?",Long.class,user));
        assertEquals(java.sql.Date.valueOf(month.atEndOfMonth()),jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE user_id=?",java.sql.Date.class,user));
        assertEquals(50000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=?",Long.class,oldManaged));
        assertNotNull(jdbc.queryForObject("SELECT deleted_at FROM bill_payments WHERE bill_item_id=?",java.sql.Timestamp.class,oldManaged));
        mvc.perform(get("/api/bills/monthly").param("month",month.toString()).param("timeZone","Asia/Seoul").header("Authorization","Bearer "+t))
            .andExpect(status().isOk()).andExpect(jsonPath("$.contractKind").value("monthly"))
            .andExpect(jsonPath("$.housingItems[0].amount").value(600000)).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test void homeEditUpdatesFutureUnpaidAndPreservesPaidHistory() throws Exception {
        String t=token("change-home");
        var body=monthly(); body.put("rentDay",25);
        save(t,body).andExpect(status().isOk());
        long user=jdbc.queryForObject("SELECT id FROM users WHERE nickname='검증회원'",Long.class);
        long managed=jdbc.queryForObject("SELECT management_bill_id FROM home_contracts WHERE user_id=?",Long.class,user);
        var future=java.time.YearMonth.now(java.time.ZoneId.of("Asia/Seoul")).plusMonths(1);
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (?,?,550003,?)",user,future.toString(),java.sql.Date.valueOf(future.atDay(25)));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date) VALUES (?,?,50000,?)",managed,future.toString(),java.sql.Date.valueOf(future.atDay(25)));
        var paid=future.plusMonths(1);
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date,paid_at) VALUES (?,?,550003,?,CURRENT_TIMESTAMP)",user,paid.toString(),java.sql.Date.valueOf(paid.atDay(25)));
        body.put("rent",600000); body.put("rentDay",28); body.put("mgmtFee",60000);
        save(t,body).andExpect(status().isOk());
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE user_id=? AND period_ym=?",Long.class,user,future.toString()));
        assertEquals(java.sql.Date.valueOf(future.atDay(28)),jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE user_id=? AND period_ym=?",java.sql.Date.class,user,future.toString()));
        assertEquals(60000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=?",Long.class,managed,future.toString()));
        assertEquals(550003L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE user_id=? AND period_ym=?",Long.class,user,paid.toString()));
        assertEquals(java.sql.Date.valueOf(paid.atDay(25)),jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE user_id=? AND period_ym=?",java.sql.Date.class,user,paid.toString()));
    }
    @Test void recurringDayBeforeTodaySavesWithoutMovingExistingRecordIntoPast() throws Exception {
        var today=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
        org.junit.jupiter.api.Assumptions.assumeTrue(today.getDayOfMonth()>1);
        String t=token("change-rollback");
        var body=monthly(); body.put("rentDay",31);
        save(t,body).andExpect(status().isOk());
        long user=jdbc.queryForObject("SELECT id FROM users WHERE nickname='검증회원'",Long.class);
        var month=java.time.YearMonth.from(today);
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (?,?,550003,?)",user,month.toString(),java.sql.Date.valueOf(month.atEndOfMonth()));
        body.put("rent",600000); body.put("rentDay",1); body.put("mgmtFee",60000);
        save(t,body).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("SELECT rent_day FROM user_settings WHERE user_id=?",Integer.class,user));
        assertEquals(60000L,jdbc.queryForObject("SELECT default_amount FROM bill_items WHERE user_id=?",Long.class,user));
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE user_id=?",Long.class,user));
        assertEquals(java.sql.Date.valueOf(month.atEndOfMonth()),jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE user_id=?",java.sql.Date.class,user));
    }
}

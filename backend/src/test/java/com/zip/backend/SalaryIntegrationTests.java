package com.zip.backend;

import com.zip.backend.auth.AuthService;
import com.zip.backend.auth.AuthRepository;
import com.zip.backend.ledger.SalaryService;
import java.time.*;
import org.junit.jupiter.api.*;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql","/ledger-fixture.sql"})
class SalaryIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired AuthService auth;
    @Autowired AuthRepository authRepository;
    @Autowired JdbcTemplate jdbc;
    String token;
    long owner;
    @BeforeEach void seed() {
        token=auth.socialLogin("GOOGLE","salary-user","salary@example.com","월급검증");
        owner=jdbc.queryForObject("SELECT user_id FROM auth_sessions ORDER BY id LIMIT 1",Long.class);
    }
    @Autowired tools.jackson.databind.json.JsonMapper json;
    SalaryService at(String instant) { return new SalaryService(jdbc,authRepository,Clock.fixed(Instant.parse(instant),ZoneOffset.UTC),json); }
    @Test void firstManualSalarySetsMonthlyIncomeAndFurtherRegistrationIsRejected() throws Exception {
        String date=LocalDate.now(ZoneOffset.UTC).toString();
        String body="{\"amount\":1000,\"date\":\""+date+"\",\"cat\":\"월급\",\"memo\":\"\",\"incomeType\":\"fixed\"}";
        mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isCreated());
        mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.incomePeriod").value("monthly"))
            .andExpect(jsonPath("$.amount").value(1000)).andExpect(jsonPath("$.paymentDay").value(LocalDate.parse(date).getDayOfMonth()));
        mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isConflict());
        mvc.perform(get("/api/ledger/income").param("timeZone","UTC").param("month",date.substring(0,7)).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body.replace("월급","임대 수입"))).andExpect(status().isCreated());
        long id=jdbc.queryForObject("SELECT MAX(id) FROM incomes",Long.class);
        mvc.perform(put("/api/ledger/income/"+id).param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isConflict());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records",Integer.class));
    }
    @Test void latestLegacySalaryFillsOnlyAnUnregisteredAccount() throws Exception {
        long category=jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind='INCOME' AND name='월급'",Long.class);
        jdbc.update("INSERT INTO incomes(user_id,category_id,amount,income_date,memo,income_type) VALUES (?,?,1500000,'2025-01-05','','FIXED'),(?,?,2700000,'2025-02-07','','FIXED')",owner,category,owner,category);
        for (int i=0;i<2;i++) mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(2700000)).andExpect(jsonPath("$.paymentDay").value(7));
        jdbc.update("UPDATE salary_settings SET amount=0 WHERE user_id=?",owner);
        mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(0));
    }
    @Test void existingManualSalaryPreventsAutomaticDuplicateInSameMonth() {
        long category=jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind='INCOME' AND name='월급'",Long.class);
        jdbc.update("INSERT INTO incomes(user_id,category_id,amount,income_date,memo,income_type) VALUES (?,?,2500000,'2026-01-05','','FIXED')",owner,category);
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,2500000,'monthly',1,'2026-01')",owner);
        var service=at("2026-02-05T12:00:00Z");
        service.sync(owner,"UTC"); service.sync(owner,"UTC");
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records",Integer.class));
    }
    @Test void salarySettingsCreateOneFixedIncomeAndProtectItFromLedgerEdits() throws Exception {
        for(int i=0;i<2;i++) mvc.perform(put("/api/me/salary").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"amount\":2500000,\"incomePeriod\":\"monthly\",\"paymentDay\":1}")).andExpect(status().isOk()).andExpect(jsonPath("$.monthlyAmount").value(2500000));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals("FIXED",jdbc.queryForObject("SELECT income_type FROM incomes",String.class));
        String month=YearMonth.now(ZoneOffset.UTC).toString();
        mvc.perform(get("/api/ledger/income").param("timeZone","UTC").param("month",month).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].salaryManaged").value(true)).andExpect(jsonPath("$[0].amount").value(2500000));
        mvc.perform(get("/api/ledger/income-summary").param("timeZone","UTC").header("Authorization","Bearer "+token))
            .andExpect(jsonPath("$['"+month+"']").value(2500000));
        long id=jdbc.queryForObject("SELECT id FROM incomes",Long.class);
        mvc.perform(put("/api/ledger/income/"+id).param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"amount\":1,\"date\":\""+LocalDate.now(ZoneOffset.UTC)+"\",\"cat\":\"월급\",\"memo\":\"\",\"incomeType\":\"fixed\"}")).andExpect(status().isConflict());
        mvc.perform(put("/api/me/salary").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"amount\":3000000,\"incomePeriod\":\"monthly\",\"paymentDay\":1}")).andExpect(status().isOk());
        assertEquals(2500000L,jdbc.queryForObject("SELECT amount FROM incomes",Long.class));
        mvc.perform(delete("/api/ledger/income/"+id).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.startMonth").value(""));
        mvc.perform(get("/api/ledger/income").param("timeZone","UTC").param("month",month).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE income_id IS NULL",Integer.class));
        mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"amount\":2000000,\"date\":\""+LocalDate.now(ZoneOffset.UTC)+"\",\"cat\":\"월급\",\"memo\":\"\",\"incomeType\":\"fixed\"}")).andExpect(status().isCreated());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE income_id IS NOT NULL",Integer.class));
        mvc.perform(get("/api/me/salary")).andExpect(status().isUnauthorized());
    }
    @Test void annualIncomeUsesMonthEndAndDecemberRemainderWithoutDuplicates() {
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,12000001,'annual',31,'2026-01')",owner);
        var feb=at("2026-02-28T12:00:00Z");
        feb.sync(owner,"UTC"); feb.sync(owner,"UTC");
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals("2026-02-28",jdbc.queryForObject("SELECT MAX(income_date) FROM incomes",java.sql.Date.class).toString());
        at("2026-12-31T12:00:00Z").sync(owner,"UTC");
        assertEquals(12,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals(12000001L,jdbc.queryForObject("SELECT SUM(amount) FROM incomes",Long.class));
        assertEquals(1000001L,jdbc.queryForObject("SELECT amount FROM incomes WHERE income_date='2026-12-31'",Long.class));
    }
    @Test void futurePaydayIsExcludedAccordingToSelectedTimeZone() {
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,1000000,'monthly',1,'2026-08')",owner);
        var service=at("2026-08-01T00:30:00Z");
        service.sync(owner,"America/Los_Angeles");
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        service.sync(owner,"UTC");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
    }
    @Test void freshServiceCatchesUpMissedMonthsAndKeepsRecordsAcrossYearAndZoneChanges() {
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,1000000,'monthly',31,'2026-11')",owner);
        at("2026-11-30T12:00:00Z").sync(owner,"UTC");
        // A fresh service instance represents losing all process-local state after restart.
        at("2027-02-28T12:00:00Z").sync(owner,"UTC");
        assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records",Integer.class));
        assertEquals(4000000L,jdbc.queryForObject("SELECT SUM(amount) FROM incomes",Long.class));
        assertEquals("2027-02-28",jdbc.queryForObject("SELECT MAX(income_date) FROM incomes",java.sql.Date.class).toString());
        at("2027-03-01T00:30:00Z").sync(owner,"America/Los_Angeles");
        at("2027-03-01T00:30:00Z").sync(owner,"Asia/Seoul");
        at("2027-03-01T00:30:00Z").sync(owner,"UTC");
        assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM incomes",Integer.class));
        assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM salary_records",Integer.class));
    }
    @Test void invalidAmountsDaysPeriodsAndOtherUsersAreIsolated() throws Exception {
        for(String body:new String[]{"{\"amount\":12,\"incomePeriod\":\"annual\",\"paymentDay\":0}","{\"amount\":11,\"incomePeriod\":\"annual\",\"paymentDay\":25}","{\"amount\":-1,\"incomePeriod\":\"monthly\",\"paymentDay\":25}","{\"amount\":1.5,\"incomePeriod\":\"monthly\",\"paymentDay\":25}","{\"amount\":12,\"incomePeriod\":\"weekly\",\"paymentDay\":25}"})
            mvc.perform(put("/api/me/salary").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,1000000,'monthly',1,'2026-08')",owner);
        String other=auth.socialLogin("GOOGLE","salary-other","salary-other@example.com","다른월급");
        mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+other)).andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(0));
    }
}

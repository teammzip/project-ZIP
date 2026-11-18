package com.zip.backend;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.*;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql","/home-info-fixture.sql"})
class ContractAutoRegisterTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BillRepository repository;
    @Autowired AuthRepository auth;
    BillService service;
    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'자동등록'),(2,'다른회원')");
        jdbc.update("INSERT INTO auth_sessions(id,user_id,refresh_token_hash,remember,created_at,expires_at) VALUES (10,1,?,false,'2026-01-01','2099-01-01')","a".repeat(64));
        jdbc.update("INSERT INTO user_settings(user_id,rent_amount,rent_day,move_in_ym,contract_end_ym) VALUES (1,55,15,'2026-01','2027-12')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (20,1,'관리비','관리비',50000,'2026-01-01')");
        jdbc.update("INSERT INTO home_contracts(user_id,contract_kind,management_bill_id) VALUES (1,'monthly',20)");
        service=at("2026-11-30T15:00:00Z");
    }
    BillService at(String instant) { return new BillService(repository,auth,Clock.fixed(Instant.parse(instant),ZoneOffset.UTC)); }
    @Test void savedEffectiveDatePreventsPastRecurringPaymentsAndEstimatesButNextMonthRegisters() {
        jdbc.update("UPDATE home_contracts SET payment_effective_from='2026-11-18' WHERE user_id=1");
        var now=at("2026-11-18T03:00:00Z");
        now.autoRegister(1,10,"Asia/Seoul");
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        assertTrue(((List<?>)now.monthly(1,YearMonth.of(2026,11),"Asia/Seoul").get("housingItems")).isEmpty());
        assertTrue(((List<?>)now.monthly(1,YearMonth.of(2026,11),"Asia/Seoul").get("items")).isEmpty());
        service.autoRegister(1,10,"Asia/Seoul");
        assertEquals("2026-12-15",jdbc.queryForObject("SELECT due_date FROM rent_payments",java.sql.Date.class).toString());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }

    @Test void effectiveDateAlsoPreventsPastJeonseInterestAndIncludesToday() {
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse',management_included=true,payment_effective_from='2026-11-18' WHERE user_id=1");
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('effective-loan',1,100000000,3.6,15,'2026-01-01')");
        var now=at("2026-11-18T03:00:00Z");
        now.autoRegister(1,10,"Asia/Seoul");
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Integer.class));
        assertTrue(((List<?>)now.monthly(1,YearMonth.of(2026,11),"Asia/Seoul").get("housingItems")).isEmpty());
        jdbc.update("UPDATE housing_loans SET payment_day=18 WHERE user_id=1");
        now.autoRegister(1,10,"Asia/Seoul");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Integer.class));
    }
    @Test void localMonthRegistersRentAndManagementExactlyOnceAndPreservesAmounts() {
        service.autoRegister(1,10,"Asia/Seoul"); service.autoRegister(1,10,"Asia/Seoul");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
        assertEquals("2026-12",jdbc.queryForObject("SELECT period_ym FROM rent_payments",String.class));
        assertEquals(550000L,jdbc.queryForObject("SELECT amount FROM rent_payments",Long.class));
        assertEquals(50000L,jdbc.queryForObject("SELECT amount FROM bill_payments",Long.class));
        jdbc.update("UPDATE user_settings SET rent_amount=60 WHERE user_id=1");
        service.autoRegister(1,10,"Asia/Seoul");
        assertEquals(550000L,jdbc.queryForObject("SELECT amount FROM rent_payments",Long.class));
        at("2026-12-31T15:00:00Z").autoRegister(1,10,"Asia/Seoul");
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE period_ym='2027-01'",Long.class));
        assertNull(jdbc.queryForObject("SELECT paid_at FROM rent_payments WHERE period_ym='2026-12'",java.sql.Timestamp.class));
    }
    @Test void jeonseCalculatesInterestWithoutRentAndIncludedManagementDoesNotRegister() {
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse',management_included=true WHERE user_id=1");
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,31,'2026-01-01')");
        service.autoRegister(1,10,"Asia/Seoul"); service.autoRegister(1,10,"Asia/Seoul");
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges",Integer.class));
        assertEquals(300000L,jdbc.queryForObject("SELECT amount FROM loan_interest_charges",Long.class));
        assertEquals("2026-12-31",jdbc.queryForObject("SELECT charge_date FROM loan_interest_charges",java.sql.Date.class).toString());
    }
    @Test void managedBillsRejectLedgerChangesAndDeletedRecordsDoNotReappear() {
        service.autoRegister(1,10,"Asia/Seoul");
        assertEquals(409,assertThrows(ApiException.class,()->service.updateMonthly(1,10,20,"2026-12","Asia/Seoul",Map.of("amount",1,"dueDate","2026-12-31"))).status());
        assertEquals(409,assertThrows(ApiException.class,()->service.deleteMonthly(1,10,20,"2026-12","Asia/Seoul")).status());
        assertEquals(409,assertThrows(ApiException.class,()->service.update(1,10,20,Map.of("amount",1))).status());
        assertEquals(409,assertThrows(ApiException.class,()->service.remove(1,10,20)).status());
        assertEquals(409,assertThrows(ApiException.class,()->service.pay(1,10,20,YearMonth.of(2026,12),Map.of("amount",1))).status());
        jdbc.update("UPDATE bill_payments SET deleted_at=CURRENT_TIMESTAMP WHERE bill_item_id=20");
        service.autoRegister(1,10,"Asia/Seoul");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments WHERE deleted_at IS NOT NULL",Integer.class));
    }
    @Test void contractEndAndDeviceZoneDoNotCreateWrongMonthOrOtherUsersRows() {
        service.autoRegister(1,10,"America/Los_Angeles");
        assertEquals("2026-11",jdbc.queryForObject("SELECT period_ym FROM rent_payments",String.class));
        assertEquals("America/Los_Angeles",repository.savedZone(1));
        assertEquals(400,assertThrows(ApiException.class,()->service.autoRegister(1,10,"bad-zone")).status());
        assertEquals(401,assertThrows(ApiException.class,()->service.autoRegister(2,10,"UTC")).status());
        at("2028-01-01T00:00:00Z").autoRegisterForUser(1,"UTC");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
    }
    @Test void outsideTermBlocksNewManagementPaymentThroughLegacyEndpoint() {
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        assertEquals(400,assertThrows(ApiException.class,()->service.pay(1,10,20,YearMonth.of(2026,12),Map.of("paid",true))).status());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
}

package com.zip.backend;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.*;
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
class BillHousingMonthlyTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BillRepository repository;
    @Autowired AuthRepository auth;
    BillService service;
    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'계약회원'),(2,'다른회원')");
        jdbc.update("INSERT INTO user_settings(user_id,rent_amount,rent_day,move_in_ym,contract_end_ym) VALUES (1,55,31,'2026-01','2026-12')");
        jdbc.update("INSERT INTO home_contracts(user_id,contract_kind,management_included) VALUES (1,'monthly',false)");
        service=new BillService(repository,auth,Clock.fixed(Instant.parse("2026-11-18T03:00:00Z"),ZoneOffset.UTC));
    }
    BillResponse.Monthly query(int month) { return service.monthly(1,YearMonth.of(2026,month),"Asia/Seoul"); }
    @Test void monthlyRentUsesWonAndClampsDayWithoutWriting() {
        var result=query(11); var rows=result.housingItems();
        assertEquals("monthly",result.contractKind()); assertEquals(1,rows.size());
        assertEquals(550000L,rows.get(0).amount()); assertEquals("2026-11-30",rows.get(0).dueDate());
        assertFalse(rows.get(0).paid());
        var past=query(10).housingItems().get(0);
        assertFalse(past.snapshot());
        assertFalse(past.paid());
        assertEquals(550000L,past.amount());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
        assertTrue(service.monthly(2,YearMonth.of(2026,11),"UTC").housingItems().isEmpty());
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2026-10',480000,'2026-10-15')");
        var saved=query(10).housingItems().get(0);
        assertTrue(saved.snapshot());
        assertEquals(480000L,saved.amount());
        assertEquals("2026-10-15",saved.dueDate());
        assertFalse(saved.paid());
    }
    @Test void outsideContractPeriodIsReportedButSavedHistoryRemainsVisible() {
        assertFalse(query(11).contractPeriod().outside());
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        var period=query(11).contractPeriod();
        assertTrue(period.outside());
        assertEquals("2026-01",period.from());
        assertEquals("2026-10",period.through());
        assertTrue(query(11).housingItems().isEmpty());
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount) VALUES (1,'2026-11',550000)");
        assertEquals(550000L,query(11).housingItems().get(0).amount());
        jdbc.update("UPDATE user_settings SET move_in_ym='2026-12',contract_end_ym='2027-12' WHERE user_id=1");
        assertTrue(query(11).contractPeriod().outside());
        assertFalse(service.monthly(2,YearMonth.of(2026,11),"UTC").contractPeriod().outside());
    }
    @Test void jeonseOnlyProjectsActiveInterestAndPreservesStoredSnapshots() {
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse' WHERE user_id=1");
        assertTrue(query(11).housingItems().isEmpty());
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,31,'2026-01-01')");
        var estimated=query(11).housingItems().get(0);
        assertEquals("interest",estimated.source()); assertEquals(300000L,estimated.amount());
        jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount) VALUES ('loan','2026-11-30',100000000,2.4,200000)");
        var saved=query(11).housingItems(); assertEquals(1,saved.size()); assertEquals(200000L,saved.get(0).amount());
        assertFalse(saved.get(0).paid());
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,paid_at) VALUES (1,'2026-10',500000,'2026-10-15 03:00:00')");
        assertTrue(query(10).housingItems().isEmpty());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE user_id=1 AND period_ym='2026-10'",Integer.class));
        jdbc.update("UPDATE housing_loans SET is_active=false WHERE user_id=1");
        assertEquals(200000L,query(11).housingItems().get(0).amount());
    }
    @Test void selectedContractFiltersBothPaidAndUnpaidOppositeHousingWithoutDeletingHistory() {
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,paid_at) VALUES (1,'2026-11',550000,NULL),(1,'2026-10',500000,'2026-10-15 03:00:00')");
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,31,'2026-01-01')");
        jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount,paid_at) VALUES ('loan','2026-11-30',100000000,3.6,300000,NULL),('loan','2026-10-31',100000000,3.6,300000,'2026-10-31 03:00:00')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'전기','공과금',40000,'2026-01-01')");
        for(int month:List.of(10,11)) {
            assertEquals(1,query(month).housingItems().size());
            assertEquals("rent",query(month).housingItems().get(0).source());
        }
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse' WHERE user_id=1");
        for(int month:List.of(10,11)) {
            assertEquals(1,query(month).housingItems().size());
            assertEquals("interest",query(month).housingItems().get(0).source());
        }
        assertEquals(1,query(11).items().size());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE user_id=1",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id='loan'",Integer.class));
    }

    @Test void managementHistoryOnlyAppearsForItsOwnContractKind() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at,is_active,home_contract_kind) VALUES (10,1,'관리비','관리비',50000,'2026-01-01',false,'jeonse'),(11,1,'관리비','관리비',70000,'2026-01-01',true,'monthly'),(12,1,'전기','공과금',40000,'2026-01-01',true,NULL)");
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-11',50000),(11,'2026-11',70000)");
        jdbc.update("UPDATE home_contracts SET management_bill_id=11 WHERE user_id=1");
        var monthly=query(11).items();
        assertEquals(2,monthly.size());
        assertEquals("11",monthly.get(0).id());
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse',management_bill_id=10 WHERE user_id=1");
        var jeonse=query(11).items();
        assertEquals(2,jeonse.size());
        assertEquals("10",jeonse.get(0).id());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        assertTrue(repository.managed(1,11));
    }

    @Test void includedManagementOnlySuppressesLinkedEstimateNotStoredHistory() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'관리비','관리비',50000,'2026-01-01')");
        jdbc.update("UPDATE home_contracts SET management_bill_id=10,management_included=true WHERE user_id=1");
        assertTrue(query(11).items().isEmpty());
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-10',50000)");
        assertEquals(1,query(10).items().size());
        assertTrue(query(11).housingItems().get(0).name().contains("관리비 포함"));
    }
    @Test void outsideContractHidesOnlyManagementEstimateAndPreservesSavedBills() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'관리비','관리비',50000,'2026-01-01'),(11,1,'전기','공과금',40000,'2026-01-01')");
        jdbc.update("UPDATE home_contracts SET management_bill_id=10,management_included=false WHERE user_id=1");
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        var items=query(11).items();
        assertEquals(1,items.size());
        assertEquals("전기",items.get(0).name());
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-11',50000)");
        assertEquals(2,query(11).items().size());
    }
}

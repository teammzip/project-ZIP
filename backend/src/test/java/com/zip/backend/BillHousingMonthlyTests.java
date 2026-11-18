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
    Map<String,Object> query(int month) { return service.monthly(1,YearMonth.of(2026,month),"Asia/Seoul"); }
    @SuppressWarnings("unchecked") List<Map<String,Object>> housing(Map<String,Object> result) { return (List<Map<String,Object>>)result.get("housingItems"); }
    @Test void monthlyRentUsesWonAndClampsDayWithoutWriting() {
        var result=query(11); var rows=housing(result);
        assertEquals("monthly",result.get("contractKind")); assertEquals(1,rows.size());
        assertEquals(550000L,rows.get(0).get("amount")); assertEquals("2026-11-30",rows.get(0).get("dueDate"));
        assertEquals(false,rows.get(0).get("paid"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments",Integer.class));
        assertTrue(housing(query(10)).isEmpty());
        assertTrue(housing(service.monthly(2,YearMonth.of(2026,11),"UTC")).isEmpty());
    }
    @Test void outsideContractPeriodIsReportedButSavedHistoryRemainsVisible() {
        assertEquals(false,((Map<?,?>)query(11).get("contractPeriod")).get("outside"));
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        var period=(Map<?,?>)query(11).get("contractPeriod");
        assertEquals(true,period.get("outside"));
        assertEquals("2026-01",period.get("from"));
        assertEquals("2026-10",period.get("through"));
        assertTrue(housing(query(11)).isEmpty());
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount) VALUES (1,'2026-11',550000)");
        assertEquals(550000L,housing(query(11)).get(0).get("amount"));
        jdbc.update("UPDATE user_settings SET move_in_ym='2026-12',contract_end_ym='2027-12' WHERE user_id=1");
        assertEquals(true,((Map<?,?>)query(11).get("contractPeriod")).get("outside"));
        assertEquals(false,((Map<?,?>)service.monthly(2,YearMonth.of(2026,11),"UTC").get("contractPeriod")).get("outside"));
    }
    @Test void jeonseOnlyProjectsActiveInterestAndPreservesStoredSnapshots() {
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse' WHERE user_id=1");
        assertTrue(housing(query(11)).isEmpty());
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,31,'2026-01-01')");
        var estimated=housing(query(11)).get(0);
        assertEquals("interest",estimated.get("source")); assertEquals(300000L,estimated.get("amount"));
        jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount) VALUES ('loan','2026-11-30',100000000,2.4,200000)");
        var saved=housing(query(11)); assertEquals(1,saved.size()); assertEquals(200000L,saved.get(0).get("amount"));
        assertEquals(false,saved.get(0).get("paid"));
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,paid_at) VALUES (1,'2026-10',500000,'2026-10-15 03:00:00')");
        assertTrue(housing(query(10)).isEmpty());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE user_id=1 AND period_ym='2026-10'",Integer.class));
        jdbc.update("UPDATE housing_loans SET is_active=false WHERE user_id=1");
        assertEquals(200000L,housing(query(11)).get(0).get("amount"));
    }
    @Test void selectedContractFiltersBothPaidAndUnpaidOppositeHousingWithoutDeletingHistory() {
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,paid_at) VALUES (1,'2026-11',550000,NULL),(1,'2026-10',500000,'2026-10-15 03:00:00')");
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,31,'2026-01-01')");
        jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount,paid_at) VALUES ('loan','2026-11-30',100000000,3.6,300000,NULL),('loan','2026-10-31',100000000,3.6,300000,'2026-10-31 03:00:00')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'전기','공과금',40000,'2026-01-01')");
        for(int month:List.of(10,11)) {
            assertEquals(1,housing(query(month)).size());
            assertEquals("rent",housing(query(month)).get(0).get("source"));
        }
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse' WHERE user_id=1");
        for(int month:List.of(10,11)) {
            assertEquals(1,housing(query(month)).size());
            assertEquals("interest",housing(query(month)).get(0).get("source"));
        }
        assertEquals(1,((List<?>)query(11).get("items")).size());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM rent_payments WHERE user_id=1",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id='loan'",Integer.class));
    }

    @Test void managementHistoryOnlyAppearsForItsOwnContractKind() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at,is_active,home_contract_kind) VALUES (10,1,'관리비','관리비',50000,'2026-01-01',false,'jeonse'),(11,1,'관리비','관리비',70000,'2026-01-01',true,'monthly'),(12,1,'전기','공과금',40000,'2026-01-01',true,NULL)");
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-11',50000),(11,'2026-11',70000)");
        jdbc.update("UPDATE home_contracts SET management_bill_id=11 WHERE user_id=1");
        var monthly=(List<?>)query(11).get("items");
        assertEquals(2,monthly.size());
        assertEquals("11",((Map<?,?>)monthly.get(0)).get("id"));
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse',management_bill_id=10 WHERE user_id=1");
        var jeonse=(List<?>)query(11).get("items");
        assertEquals(2,jeonse.size());
        assertEquals("10",((Map<?,?>)jeonse.get(0)).get("id"));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        assertTrue(repository.managed(1,11));
    }

    @Test void includedManagementOnlySuppressesLinkedEstimateNotStoredHistory() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'관리비','관리비',50000,'2026-01-01')");
        jdbc.update("UPDATE home_contracts SET management_bill_id=10,management_included=true WHERE user_id=1");
        assertEquals(List.of(),query(11).get("items"));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-10',50000)");
        assertEquals(1,((List<?>)query(10).get("items")).size());
        assertTrue(housing(query(11)).get(0).get("name").toString().contains("관리비 포함"));
    }
    @Test void outsideContractHidesOnlyManagementEstimateAndPreservesSavedBills() {
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'관리비','관리비',50000,'2026-01-01'),(11,1,'전기','공과금',40000,'2026-01-01')");
        jdbc.update("UPDATE home_contracts SET management_bill_id=10,management_included=false WHERE user_id=1");
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        var items=(List<?>)query(11).get("items");
        assertEquals(1,items.size());
        assertEquals("전기",((Map<?,?>)items.get(0)).get("name"));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (10,'2026-11',50000)");
        assertEquals(2,((List<?>)query(11).get("items")).size());
    }
}

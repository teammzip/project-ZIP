package com.zip.backend;

import com.zip.backend.settings.*;
import com.zip.backend.bills.*;
import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.math.BigDecimal;
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
class ContractPaymentChangesTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired SettingsRepository settings;
    Clock clock=Clock.fixed(Instant.parse("2026-11-18T03:00:00Z"),ZoneOffset.UTC);
    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'변경회원'),(2,'다른회원')");
        jdbc.update("INSERT INTO user_settings(user_id,rent_amount,rent_day,move_in_ym,contract_end_ym) VALUES (1,55,25,'2026-01','2027-12')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount) VALUES (20,1,'관리비','관리비',50000)");
        jdbc.update("INSERT INTO home_contracts(user_id,contract_kind,billing_time_zone,management_bill_id) VALUES (1,'monthly','Asia/Seoul',20)");
        jdbc.update("INSERT INTO auth_sessions(id,user_id,refresh_token_hash,created_at,expires_at) VALUES (10,1,'change-session','2026-01-01 00:00:00','2027-12-31 00:00:00')");
    }
    HomeInfoInput input(String kind,int day,long rent,long fee,HomeInfoInput.Loan loan) {
        return new HomeInfoInput(kind,0,rent,day,false,fee,0,"2026-01","2027-12",null,loan);
    }
    @Test void currentDateOutsideContractRejectsWritingEvenAnInsideHistoricalMonth() {
        jdbc.update("UPDATE user_settings SET contract_end_ym='2026-10' WHERE user_id=1");
        var service=new BillService(new BillRepository(jdbc),new AuthRepository(jdbc),clock);
        var error=assertThrows(ApiException.class,()->service.registerMonthly(1,10,"2026-10","Asia/Seoul",
            Map.of("tag","공과금","amount",40000,"dueDate","2026-11-25")));
        assertEquals(400,error.status());
        assertTrue(error.getMessage().contains("현재 날짜"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void rentAndManagementOnlyChangeUnpaidDatesOnOrAfterToday() {
        for(String month:List.of("2026-10","2026-11","2026-12","2027-02")) {
            jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date,paid_at) VALUES (1,?,550000,?,?)",month,month+"-25",month.equals("2026-12")?"2026-11-17 00:00:00":null);
            jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date,paid_at) VALUES (20,?,50000,?,?)",month,month+"-25",month.equals("2026-12")?"2026-11-17 00:00:00":null);
        }
        new ContractPaymentChanges(jdbc,clock).apply(1,input("monthly",31,600000,60000,null),settings.read(1),null,20L,25);
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE period_ym='2026-11'",Long.class));
        assertEquals("2026-11-30",jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE period_ym='2026-11'",java.sql.Date.class).toString());
        assertEquals("2027-02-28",jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE period_ym='2027-02'",java.sql.Date.class).toString());
        for(String month:List.of("2026-10","2026-12")) {
            assertEquals(550000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE period_ym=?",Long.class,month));
            assertEquals(50000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE period_ym=?",Long.class,month));
        }
        assertEquals(60000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE period_ym='2026-11'",Long.class));
    }
    @Test void loanInterestMovesDateAndRecalculatesOnlyUnpaidFutureSnapshots() {
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,25,'2026-01-01')");
        for(String month:List.of("2026-10","2026-11","2026-12"))
            jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount,paid_at) VALUES ('loan',?,100000000,3.6,300000,?)",month+"-25",month.equals("2026-12")?"2026-11-17 00:00:00":null);
        var old=Map.<String,Object>of("id","loan","principal",100000000L,"annualRate",new BigDecimal("3.6"),"paymentDay",25);
        var loan=new HomeInfoInput.Loan(100000000,new BigDecimal("4.8"),30,LocalDate.of(2026,1,1));
        new ContractPaymentChanges(jdbc,clock).apply(1,input("jeonse",25,0,50000,loan),settings.read(1),old,20L,25);
        assertEquals(400000L,jdbc.queryForObject("SELECT amount FROM loan_interest_charges WHERE charge_date='2026-11-30'",Long.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM loan_interest_charges WHERE amount=300000",Integer.class));
    }
    @Test void genericBillsRejectOutsideContractAndPropagateOnlyEligibleSameItem() {
        var repo=new BillRepository(jdbc);
        var service=new BillService(repo,new AuthRepository(jdbc),clock);
        assertEquals(400,assertThrows(ApiException.class,()->service.registerMonthly(1,10,"2025-12","Asia/Seoul",Map.of("tag","공과금","amount",1,"dueDate","2026-12-25"))).status());
        assertEquals(400,assertThrows(ApiException.class,()->service.registerMonthly(1,10,"2026-11","Asia/Seoul",Map.of("tag","공과금","amount",1,"dueDate","2028-01-01"))).status());
        var saved=service.registerMonthly(1,10,"2026-11","Asia/Seoul",Map.of("tag","공과금","amount",40000,"dueDate","2026-11-25"));
        long id=Long.parseLong((String)saved.get("id"));
        for(String month:List.of("2026-10","2026-12","2027-01"))
            jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date,paid_at) VALUES (?,?,40000,?,?)",id,month,month+"-25",month.equals("2027-01")?"2026-11-17 00:00:00":null);
        service.updateMonthly(1,10,id,"2026-11","Asia/Seoul",Map.of("amount",45000,"dueDate","2026-11-30"));
        assertEquals(45000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym='2026-12'",Long.class,id));
        assertEquals("2026-12-30",jdbc.queryForObject("SELECT due_date FROM bill_payments WHERE bill_item_id=? AND period_ym='2026-12'",java.sql.Date.class,id).toString());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=? AND amount=40000",Integer.class,id));
    }
    @Test void recurringDayBeforeTodayDoesNotRejectOrMoveStoredRecordIntoPast() {
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2026-11',550000,'2026-11-25')");
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2026-12',550000,'2026-12-25')");
        new ContractPaymentChanges(jdbc,clock).apply(1,input("monthly",1,600000,50000,null),settings.read(1),null,20L,25);
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE period_ym='2026-11'",Long.class));
        assertEquals("2026-11-25",jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE period_ym='2026-11'",java.sql.Date.class).toString());
        assertEquals(600000L,jdbc.queryForObject("SELECT amount FROM rent_payments WHERE period_ym='2026-12'",Long.class));
        assertEquals("2026-12-01",jdbc.queryForObject("SELECT due_date FROM rent_payments WHERE period_ym='2026-12'",java.sql.Date.class).toString());
    }
    @Test void amountOnlyEditPreservesFutureDueDate() {
        var repo=new BillRepository(jdbc);
        var service=new BillService(repo,new AuthRepository(jdbc),clock);
        var saved=service.registerMonthly(1,10,"2026-11","Asia/Seoul",Map.of("tag","공과금","amount",40000,"dueDate","2026-11-30"));
        long id=Long.parseLong((String)saved.get("id"));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date) VALUES (?,'2026-12',40000,'2026-12-31')",id);
        service.updateMonthly(1,10,id,"2026-11","Asia/Seoul",Map.of("amount",45000,"dueDate","2026-11-30"));
        assertEquals(45000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE period_ym='2026-12'",Long.class));
        assertEquals("2026-12-31",jdbc.queryForObject("SELECT due_date FROM bill_payments WHERE period_ym='2026-12'",java.sql.Date.class).toString());
    }
    @Test void savingUnchangedHomeRepairsStaleUpcomingRentSnapshot() {
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2026-11',400000,'2026-11-30')");
        new ContractPaymentChanges(jdbc,clock).apply(1,input("monthly",25,550000,50000,null),settings.read(1),null,20L,25);
        assertEquals(550000L,jdbc.queryForObject("SELECT amount FROM rent_payments",Long.class));
        assertEquals("2026-11-25",jdbc.queryForObject("SELECT due_date FROM rent_payments",java.sql.Date.class).toString());
    }
}

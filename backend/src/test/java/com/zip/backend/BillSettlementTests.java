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
class BillSettlementTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BillRepository repository;
    @Autowired AuthRepository auth;
    final Clock clock=Clock.fixed(Instant.parse("2026-11-19T03:00:00Z"),ZoneOffset.UTC);
    BillSettlementService service;
    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'납부회원'),(2,'다른회원')");
        jdbc.update("INSERT INTO auth_sessions(id,user_id,refresh_token_hash,created_at,expires_at) VALUES (10,1,'settlement-session','2026-01-01','2027-12-31'),(11,2,'other-session','2026-01-01','2027-12-31')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (20,1,'통신','통신',40000,'2026-01-01')");
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date) VALUES (20,'2026-11',45000,'2026-11-25')");
        service=new BillSettlementService(jdbc,repository,auth,clock);
    }
    void paid(String id,boolean value) { service.payment(1,10,id,"2026-11","Asia/Seoul",Map.of("paid",value)); }
    @Test void registeredPaymentIsIdempotentAndCancellationPreservesAmountAndDate() {
        paid("20",true);
        var first=repository.payment(20,YearMonth.of(2026,11));
        new BillSettlementService(jdbc,repository,auth,Clock.offset(clock,Duration.ofMinutes(10)))
            .payment(1,10,"20","2026-11","Asia/Seoul",Map.of("paid",true));
        assertEquals(first.paidAt(),repository.payment(20,YearMonth.of(2026,11)).paidAt());
        paid("20",false); paid("20",false);
        var after=repository.payment(20,YearMonth.of(2026,11));
        assertNull(after.paidAt()); assertEquals(45000,after.amount()); assertEquals(LocalDate.of(2026,11,25),after.dueDate());
    }
    @Test void rejectsOtherOwnerFutureMonthDeletedOrMissingRecordAndAmountPayload() {
        assertEquals(404,assertThrows(ApiException.class,()->service.payment(2,11,"20","2026-11","UTC",Map.of("paid",true))).status());
        assertEquals(400,assertThrows(ApiException.class,()->service.payment(1,10,"20","2026-12","UTC",Map.of("paid",true))).status());
        assertEquals(400,assertThrows(ApiException.class,()->service.payment(1,10,"20","2026-11","UTC",Map.of("paid",true,"amount",1))).status());
        assertEquals(400,assertThrows(ApiException.class,()->paid("interest:2026-11",true)).status());
        jdbc.update("UPDATE bill_payments SET deleted_at=CURRENT_TIMESTAMP WHERE bill_item_id=20");
        assertEquals(404,assertThrows(ApiException.class,()->paid("20",true)).status());
    }
    @Test void rentAndInterestPaymentOnlyChangeStatusForCurrentContract() {
        jdbc.update("INSERT INTO user_settings(user_id,rent_amount,rent_day) VALUES (1,55,25)");
        jdbc.update("INSERT INTO home_contracts(user_id,contract_kind) VALUES (1,'monthly')");
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2026-11',550000,'2026-11-25')");
        paid("rent:2026-11",true);
        assertNotNull(repository.rent(1,YearMonth.of(2026,11)).paidAt());
        paid("rent:2026-11",false);
        assertNull(repository.rent(1,YearMonth.of(2026,11)).paidAt());
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse' WHERE user_id=1");
        assertEquals(404,assertThrows(ApiException.class,()->paid("rent:2026-11",true)).status());
        jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date) VALUES ('loan',1,100000000,3.6,25,'2026-01-01')");
        jdbc.update("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount) VALUES ('loan','2026-11-25',100000000,3.6,300000)");
        paid("interest:loan:2026-11",true);
        assertNotNull(repository.interest(1,YearMonth.of(2026,11)).get(0).paidAt());
        paid("interest:loan:2026-11",false);
        assertNull(repository.interest(1,YearMonth.of(2026,11)).get(0).paidAt());
    }
    @Test void chosenTerminationDateCancelsOnlyUnpaidOnOrAfterThatDate() {
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date,paid_at) VALUES (20,'2026-10',40000,'2026-10-25',NULL),(20,'2026-12',40000,'2026-12-25','2026-11-18 03:00:00'),(20,'2027-01',40000,'2027-01-25',NULL)");
        service.terminate(1,10,20,"Asia/Seoul",Map.of("effectiveDate","2026-11-25"));
        service.terminate(1,10,20,"Asia/Seoul",Map.of("effectiveDate","2026-11-25"));
        assertEquals(LocalDate.of(2026,11,25),repository.find(1,20).terminationDate());
        assertNotNull(repository.payment(20,YearMonth.of(2026,11)).deletedAt());
        assertNotNull(repository.payment(20,YearMonth.of(2027,1)).deletedAt());
        assertNull(repository.payment(20,YearMonth.of(2026,10)).deletedAt());
        assertNull(repository.payment(20,YearMonth.of(2026,12)).deletedAt());
        var update = BillInput.monthlyUpdate(Map.of("amount",45000,"dueDate","2026-11-26"));
        assertEquals(409,assertThrows(ApiException.class,()->new BillService(repository,auth,clock).updateMonthly(1,10,20,YearMonth.of(2026,11),"Asia/Seoul",update)).status());
        var december=Clock.fixed(Instant.parse("2026-12-26T03:00:00Z"),ZoneOffset.UTC);
        new BillSettlementService(jdbc,repository,auth,december).payment(1,10,"20","2026-12","Asia/Seoul",Map.of("paid",false));
        assertNotNull(repository.payment(20,YearMonth.of(2026,12)).deletedAt());
    }
    @Test void terminationProtectsOwnershipContractManagedAndPastDates() {
        assertEquals(400,assertThrows(ApiException.class,()->service.terminate(1,10,20,"UTC",Map.of("effectiveDate","2026-11-18"))).status());
        assertEquals(404,assertThrows(ApiException.class,()->service.terminate(2,11,20,"UTC",Map.of("effectiveDate","2026-12-01"))).status());
        jdbc.update("UPDATE bill_items SET home_contract_kind='monthly' WHERE id=20");
        assertEquals(409,assertThrows(ApiException.class,()->service.terminate(1,10,20,"UTC",Map.of("effectiveDate","2026-12-01"))).status());
    }
}

package com.zip.backend;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.AuthService;
import com.zip.backend.bills.BillRepository;
import com.zip.backend.bills.BillService;
import com.zip.backend.common.ApiException;
import java.sql.Timestamp;
import java.time.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
@Sql({"/auth-fixture.sql","/home-info-fixture.sql"})
class BillMonthlyTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BillRepository repository;
    @Autowired AuthRepository auth;
    @Autowired AuthService authService;
    @Autowired MockMvc mvc;

    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'조회회원'),(2,'다른회원')");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (10,1,'전기','공과금',40000,?),(20,2,'다른전기','공과금',99999,?)",
            Timestamp.from(Instant.parse("2026-03-01T00:00:00Z")),Timestamp.from(Instant.parse("2026-03-01T00:00:00Z")));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,paid_at) VALUES (10,'2026-04',30000,?)",Timestamp.from(Instant.parse("2026-04-29T00:00:00Z")));
    }
    private BillService at(String instant) {
        return new BillService(repository,auth,Clock.fixed(Instant.parse(instant),ZoneOffset.UTC));
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> items(Map<String,Object> result) { return (List<Map<String,Object>>)result.get("items"); }

    @Test void localMidnightStartsNewMonthWithUnpaidEstimates() {
        var before=at("2026-04-30T14:59:59Z").monthly(1,YearMonth.of(2026,4),"Asia/Seoul");
        assertEquals("2026-04",before.get("currentMonth"));
        assertEquals(30000L,items(before).get(0).get("amount"));
        var after=at("2026-04-30T15:00:00Z").monthly(1,YearMonth.of(2026,5),"Asia/Seoul");
        assertEquals("2026-05",after.get("currentMonth"));
        assertEquals(Instant.parse("2026-04-30T15:00:00Z"),OffsetDateTime.parse((String)after.get("periodThrough")).toInstant());
        assertEquals(after.get("periodFrom"),after.get("periodThrough"));
        assertEquals(1,items(after).size());
        assertEquals(40000L,items(after).get(0).get("amount"));
        assertEquals(false,items(after).get(0).get("snapshot"));
        assertEquals(false,items(after).get(0).get("paid"));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }

    @Test void differentLocationHasDifferentCurrentMonthAtSameInstant() {
        var service=at("2026-04-30T15:00:00Z");
        assertEquals("2026-04",service.monthly(1,YearMonth.of(2026,4),"America/New_York").get("currentMonth"));
        assertThrows(ApiException.class,()->service.monthly(1,YearMonth.of(2026,5),"America/New_York"));
        assertEquals("2026-05",service.monthly(1,YearMonth.of(2026,5),"Asia/Seoul").get("currentMonth"));
    }

    @Test void pastMonthUsesFullLocalPeriodAndDoesNotInventMissingHistory() {
        var service=at("2026-05-10T12:34:56Z");
        var april=service.monthly(1,YearMonth.of(2026,4),"Asia/Seoul");
        assertEquals(Instant.parse("2026-04-30T14:59:59.999999999Z"),OffsetDateTime.parse((String)april.get("periodThrough")).toInstant());
        assertEquals(30000L,items(april).get(0).get("amount"));
        assertTrue(items(service.monthly(1,YearMonth.of(2026,3),"Asia/Seoul")).isEmpty());
        var march=service.monthly(1,YearMonth.of(2026,3),"America/New_York");
        var start=OffsetDateTime.parse((String)march.get("periodFrom")).toInstant();
        var end=OffsetDateTime.parse((String)march.get("periodThrough")).toInstant().plusNanos(1);
        assertEquals(743,Duration.between(start,end).toHours()); // DST가 바뀌는 31일짜리 월
    }

    @Test void currentPeriodStopsAtServerNowAndExcludesFutureCreatedItemsAndPayments() {
        Instant now=Instant.parse("2026-05-01T03:04:05Z");
        jdbc.update("INSERT INTO bill_items(id,user_id,name,tag,default_amount,created_at) VALUES (30,1,'미래항목','공과금',10000,?)",Timestamp.from(now.plusSeconds(1)));
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,paid_at) VALUES (10,'2026-05',35000,?)",Timestamp.from(now.plusSeconds(1)));
        var result=at(now.toString()).monthly(1,YearMonth.of(2026,5),"Asia/Seoul");
        assertEquals(now,OffsetDateTime.parse((String)result.get("queriedAt")).toInstant());
        assertEquals(now,OffsetDateTime.parse((String)result.get("periodThrough")).toInstant());
        assertEquals(1,items(result).size());
        assertEquals(false,items(result).get(0).get("paid"));
        assertNull(items(result).get(0).get("paidAt"));
    }

    @Test void endpointRequiresLoginAndValidMonthAndTimeZone() throws Exception {
        mvc.perform(get("/api/bills/monthly").param("month","2026-05").param("timeZone","Asia/Seoul")).andExpect(status().isUnauthorized());
        String token=authService.socialLogin("GOOGLE","monthly-view","monthly-view@example.com","조회테스트");
        String month=YearMonth.now(ZoneOffset.UTC).toString();
        mvc.perform(get("/api/bills/monthly").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.month").value(month)).andExpect(jsonPath("$.items.length()").value(0));
        for(String invalid:List.of("2026-13","2026-5","0000-01","9999-12")) mvc.perform(get("/api/bills/monthly").param("month",invalid).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/bills/monthly").param("month",month).param("timeZone","invalid-zone").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
    }
}

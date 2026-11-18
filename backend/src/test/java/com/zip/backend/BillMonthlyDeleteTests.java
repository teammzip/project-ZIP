package com.zip.backend;

import com.zip.backend.auth.AuthService;
import com.zip.backend.bills.BillService;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
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
class BillMonthlyDeleteTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired BillService service;
    @Autowired JwtDecoder decoder;
    String token, month;
    long user, session, id;
    @BeforeEach void seed() {
        token=auth.socialLogin("GOOGLE","monthly-delete","delete@example.com","삭제검증");
        var jwt=decoder.decode(token);
        user=Long.parseLong(jwt.getSubject()); session=Long.parseLong(jwt.getClaimAsString("sid"));
        month=YearMonth.now(ZoneOffset.UTC).toString();
        var bill=service.registerPhoto(user,session,month,"UTC","a".repeat(64),"b".repeat(64),Map.of("tag","공과금","amount",40000,"dueDate",LocalDate.now(ZoneOffset.UTC).plusDays(10).toString()));
        id=Long.parseLong((String)bill.get("id"));
    }
    @Test void deletionHidesRecordAndPreservesHistoryAndIdentity() throws Exception {
        var previous=YearMonth.parse(month).minusMonths(1).toString();
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (?,?,30000)",id,previous);
        jdbc.update("UPDATE bill_payments SET paid_at=CURRENT_TIMESTAMP WHERE bill_item_id=? AND period_ym=?",id,month);
        for(int i=0;i<2;i++) mvc.perform(delete("/api/bills/monthly/"+id).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/bills/monthly").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        assertNotNull(jdbc.queryForObject("SELECT deleted_at FROM bill_payments WHERE bill_item_id=? AND period_ym=?",java.sql.Timestamp.class,id,month));
        assertEquals(30000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=? AND deleted_at IS NULL",Long.class,id,previous));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_document_keys WHERE user_id=?",Integer.class,user));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_photo_imports WHERE user_id=?",Integer.class,user));
        assertEquals(404,assertThrows(ApiException.class,()->service.updateMonthly(user,session,id,month,"UTC",Map.of("amount",1,"dueDate",LocalDate.now(ZoneOffset.UTC).toString()))).status());
        assertEquals(404,assertThrows(ApiException.class,()->service.pay(user,session,id,YearMonth.parse(month),Map.of("paid",true))).status());
    }
    @Test void unregisteredFutureAndUnauthorizedRequestsAreRejected() throws Exception {
        mvc.perform(delete("/api/bills/monthly/"+id).param("month",month).param("timeZone","UTC")).andExpect(status().isUnauthorized());
        assertEquals(404,assertThrows(ApiException.class,()->service.deleteMonthly(user,session,id,YearMonth.parse(month).minusMonths(1).toString(),"UTC")).status());
        assertEquals(400,assertThrows(ApiException.class,()->service.deleteMonthly(user,session,id,YearMonth.parse(month).plusMonths(1).toString(),"UTC")).status());
        String other=auth.socialLogin("GOOGLE","other-delete","other-delete@example.com","다른사용자");
        mvc.perform(delete("/api/bills/monthly/"+id).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        assertNull(jdbc.queryForObject("SELECT deleted_at FROM bill_payments WHERE bill_item_id=? AND period_ym=?",java.sql.Timestamp.class,id,month));
    }
}

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
        assertTrue(count>0);
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
}

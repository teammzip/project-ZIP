package com.zip.backend;

import com.zip.backend.auth.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/home-info-fixture.sql", "/ledger-fixture.sql"})
class HousingOnboardingTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    private String token;

    @BeforeEach void account() {
        token = auth.socialLogin("GOOGLE", "survey", "survey@example.com", "검증회원").accessToken();
        jdbc.update("""
            INSERT INTO user_term_agreements(user_id,terms_id,agreed_at)
            SELECT u.id,t.id,CURRENT_TIMESTAMP FROM users u CROSS JOIN terms_documents t WHERE u.email='survey@example.com'
            """);
    }

    private ResultActions submit(String body) throws Exception {
        return mvc.perform(put("/api/me/housing-onboarding").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body));
    }

    private ResultActions read(String path) throws Exception {
        return mvc.perform(get(path).header("Authorization", "Bearer " + token));
    }

    @Test void invalidContractRollsBackEarlierWritesIncludingAutomaticSalary() throws Exception {
        submit("""
            {"action":"save","address":"서울 마포구","birth":"1995-06-01","timeZone":"Asia/Seoul",
             "salary":{"amount":2500000,"incomePeriod":"monthly","paymentDay":1},
             "home":{"kind":"monthly","rent":-1}}
            """).andExpect(status().isBadRequest());
        read("/api/auth/me").andExpect(jsonPath("$.firstLogin").value(true)).andExpect(jsonPath("$.address").value(""));
        for (String table : new String[]{"user_personal_info", "salary_settings", "salary_records", "incomes", "home_contracts"}) {
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class), table);
        }
    }

    @Test void partialAnswersPersistAndReplayDoesNotOverwrite() throws Exception {
        submit("""
            {"action":"save","birth":"1995-06-01",
             "salary":{"amount":2500000,"incomePeriod":"monthly"},
             "home":{"kind":"jeonse","loan":{"principal":120000000}}}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.firstLogin").value(false));
        read("/api/me/home-info").andExpect(jsonPath("$.contract.kind").value("jeonse"))
            .andExpect(jsonPath("$.loan").isEmpty()).andExpect(jsonPath("$.loanDraft.principal").value(120000000));
        read("/api/me/salary").andExpect(jsonPath("$.startMonth").value(""))
            .andExpect(jsonPath("$.draft.amount").value(2500000));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM salary_records", Integer.class));
        submit("{\"action\":\"save\",\"birth\":\"1990-01-01\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.birth").value("1995-06-01"));
    }

    @Test void addressOnlyDoesNotCreateAContract() throws Exception {
        submit("{\"action\":\"save\",\"address\":\"서울 마포구\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.region.id").value("2")).andExpect(jsonPath("$.firstLogin").value(false));
        read("/api/me/home-info").andExpect(jsonPath("$.contract").isEmpty())
            .andExpect(jsonPath("$.settings.homeAddress").value("서울 마포구"));
    }
}

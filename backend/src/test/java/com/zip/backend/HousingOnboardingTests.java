package com.zip.backend;

import com.zip.backend.auth.AuthService;
import java.util.List;
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
            .andExpect(jsonPath("$.loan").hasJsonPath()).andExpect(jsonPath("$.loan").isEmpty())
            .andExpect(jsonPath("$.loanDraft.principal").value(120000000))
            .andExpect(jsonPath("$.loanDraft.annualRate").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.loanDraft.paymentDay").doesNotHaveJsonPath())
            .andExpect(jsonPath("$.loanDraft.startDate").doesNotHaveJsonPath());
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

    @Test void skipAcceptsOnlyTheActionAndCompletedSurveyIgnoresReplay() throws Exception {
        for (String body : List.of("{\"action\":\"skip\",\"address\":null}", "{\"action\":\"save\",\"unknown\":1}",
            "{\"action\":\"save\",\"home\":{\"kind\":\"jeonse\",\"loan\":null}}")) {
            submit(body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("설문 항목을 확인해 주세요."));
        }
        submit("null").andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("요청 JSON 형식을 확인해 주세요."));
        submit("{\"action\":\"save\",\"address\":null}").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("집 주소는 문자열이어야 해요."));
        read("/api/auth/me").andExpect(jsonPath("$.firstLogin").value(true));

        submit("{\"action\":\"skip\"}").andExpect(status().isOk()).andExpect(jsonPath("$.firstLogin").value(false));
        assertEquals("SKIPPED", jdbc.queryForObject("SELECT housing_survey_status FROM users", String.class));
        submit("{\"action\":\"invalid\",\"address\":\"서울 마포구\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value(""));
    }

    @Test void sameContractKeepsItsLoanWhenSurveyLeavesItOut() throws Exception {
        mvc.perform(put("/api/me/home-info").header("Authorization", "Bearer " + token).contentType("application/json")
                .content("""
                    {"kind":"jeonse","deposit":0,"rent":0,"rentDay":18,"mgmtIncluded":false,"mgmtFee":0,
                     "contractFee":120000000,"loan":{"principal":90000000,"annualRate":3.25,"paymentDay":20,"startDate":"2026-01-01"}}
                    """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.loan.active").value(true));
        submit("{\"action\":\"save\",\"home\":{\"kind\":\"jeonse\"}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.firstLogin").value(false));
        read("/api/me/home-info").andExpect(jsonPath("$.contract.contractFee").value(120000000))
            .andExpect(jsonPath("$.settings.rentDay").value(18))
            .andExpect(jsonPath("$.loan.active").value(true)).andExpect(jsonPath("$.loan.principal").value(90000000))
            .andExpect(jsonPath("$.loan.annualRate").value(3.25)).andExpect(jsonPath("$.loan.paymentDay").value(20))
            .andExpect(jsonPath("$.loan.startDate").value("2026-01-01"));
    }
}

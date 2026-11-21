package com.zip.backend;

import com.zip.backend.auth.AuthService;
import java.time.*;
import org.junit.jupiter.api.*;
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
@Sql({"/auth-fixture.sql","/ledger-fixture.sql"})
class LedgerIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    String token, other, date, month;
    @BeforeEach void seed() {
        token=auth.socialLogin("GOOGLE","ledger-user","ledger@example.com","가계부");
        other=auth.socialLogin("GOOGLE","ledger-other","ledger-other@example.com","다른회원");
        date=LocalDate.now(ZoneOffset.UTC).toString(); month=date.substring(0,7);
    }
    String body(int amount,String category,String type) {
        return "{\"amount\":"+amount+",\"date\":\""+date+"\",\"cat\":\""+category+"\",\"memo\":\"검증\""+(type==null?"":",\"incomeType\":\""+type+"\"")+"}";
    }
    private org.springframework.test.web.servlet.ResultActions changeCategory(String scope, String body) throws Exception {
        return mvc.perform(post("/api/me/ledger-categories").param("scope", scope)
            .header("Authorization", "Bearer " + token).contentType("application/json").content(body));
    }

    @Test void categoryRenameUpdatesExistingTransactionsOnlyForTheOwner() throws Exception {
        mvc.perform(post("/api/ledger/spend").param("timeZone", "UTC").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body(1000, "식비", null))).andExpect(status().isCreated());
        mvc.perform(post("/api/ledger/spend").param("timeZone", "UTC").header("Authorization", "Bearer " + other)
            .contentType("application/json").content(body(2000, "식비", null))).andExpect(status().isCreated());
        changeCategory("spend", """
            {"action":"import","previous":{"custom":[{"name":"반려동물","color":"#6485df"}],"order":["반려동물","식비"]}}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.order[0]").value("반려동물"));
        changeCategory("spend", """
            {"action":"rename","name":"식비","target":"외식"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.hidden[0]").value("식비"));
        changeCategory("spend", """
            {"action":"move","name":"외식","target":"반려동물"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.order[0]").value("외식"));
        changeCategory("spend", """
            {"action":"delete","name":"반려동물"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.custom.length()").value(1));
        changeCategory("spend", """
            {"action":"import","previous":{"custom":[{"name":"반려동물","color":"#6485df"}]}}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.custom.length()").value(1));
        changeCategory("bill", """
            {"action":"delete","name":"공과금"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.hidden[0]").value("공과금"));
        changeCategory("spend", """
            {"action":"add","name":"외식"}
            """).andExpect(status().isConflict());
        mvc.perform(get("/api/me/ledger-categories").param("scope", "spend").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.order[0]").value("외식"));
        mvc.perform(get("/api/me/ledger-categories").param("scope", "spend").header("Authorization", "Bearer " + other))
            .andExpect(status().isOk()).andExpect(jsonPath("$.custom.length()").value(0)).andExpect(jsonPath("$.hidden.length()").value(0));
        mvc.perform(get("/api/ledger/spend").param("month", month).param("timeZone", "UTC").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].cat").value("외식")).andExpect(jsonPath("$[0].amount").value(1000));
        mvc.perform(get("/api/ledger/spend").param("month", month).param("timeZone", "UTC").header("Authorization", "Bearer " + other))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].cat").value("식비"));
    }
    @Test void renamingSalaryKeepsItLinkedToSalarySettings() throws Exception {
        changeCategory("fixed-income", """
            {"action":"rename","name":"월급","target":"급여"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.salaryLabel").value("급여"));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token)
                .contentType("application/json").content(body(5000,"급여","fixed")))
                .andExpect(attempt == 0 ? status().isCreated() : status().isConflict());
        }
        mvc.perform(get("/api/ledger/income").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].cat").value("급여")).andExpect(jsonPath("$[0].salaryCategory").value(true));
        mvc.perform(get("/api/me/salary").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(5000));
    }
    @Test void incomeIsPartitionedByTypeAndMonthAndSummaryUsesBothTypes() throws Exception {
        for(String type:new String[]{"fixed","other"}) mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(1000,"임대 수입",type))).andExpect(status().isCreated());
        mvc.perform(get("/api/ledger/income").param("month",month).param("timeZone","UTC").param("incomeType","fixed").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/ledger/income-summary").param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$['"+month+"']").value(2000));
        mvc.perform(get("/api/ledger/income").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+other)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/ledger/income").param("month",YearMonth.parse(month).minusMonths(1).toString()).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void expenseEditAndDeleteAreOwnerScopedAndPersisted() throws Exception {
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(1000,"식비",null))).andExpect(status().isCreated());
        long id=jdbc.queryForObject("SELECT id FROM expenses",Long.class);
        mvc.perform(put("/api/ledger/spend/"+id).param("timeZone","UTC").header("Authorization","Bearer "+other).contentType("application/json").content(body(2000,"식비",null))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/ledger/spend/"+id).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        mvc.perform(put("/api/ledger/spend/"+id).param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(2000,"식비",null))).andExpect(status().isNoContent());
        assertEquals(2000L,jdbc.queryForObject("SELECT amount FROM expenses WHERE id=?",Long.class,id));
        mvc.perform(delete("/api/ledger/spend/"+id).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM expenses",Integer.class));
    }
    @Test void invalidAmountDateZoneAndUnauthenticatedWritesAreRejected() throws Exception {
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").contentType("application/json").content(body(1000,"식비",null))).andExpect(status().isUnauthorized());
        for(int amount:new int[]{0,-1,100000000}) mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(amount,"식비",null))).andExpect(status().isBadRequest());
        date=LocalDate.now(ZoneOffset.UTC).plusDays(1).toString();
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(1000,"식비",null))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/ledger/spend").param("month",month).param("timeZone","invalid").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM expenses",Integer.class));
    }
    @Test void ledgerMemoIsRegisteredInExistingMemoBoardAndUpdatesWithoutDuplication() throws Exception {
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(1000,"식비",null))).andExpect(status().isCreated());
        long id=jdbc.queryForObject("SELECT id FROM expenses",Long.class);
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("검증"));
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+other)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/ledger/spend/"+id).param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(2000,"식비",null).replace("검증","수정된 메모"))).andExpect(status().isNoContent());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        assertEquals("수정된 메모",jdbc.queryForObject("SELECT body FROM memos",String.class));
        mvc.perform(delete("/api/ledger/spend/"+id).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
    }
    @Test void blankLedgerMemoDoesNotCreateAnEmptyMemo() throws Exception {
        mvc.perform(post("/api/ledger/income").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(body(1000,"임대 수입","fixed").replace("검증",""))).andExpect(status().isCreated());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
    }
    @Test void billMemoRegistersInTheSameMemoList() throws Exception {
        long owner=jdbc.queryForObject("SELECT user_id FROM auth_sessions ORDER BY id LIMIT 1",Long.class);
        jdbc.update("INSERT INTO bill_items(user_id,name,tag,default_amount) VALUES (?,?,?,?)",owner,"전기","공과금",40000);
        long id=jdbc.queryForObject("SELECT id FROM bill_items",Long.class);
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (?,?,?)",id,month,40000);
        var repository=new com.zip.backend.bills.BillRepository(jdbc);
        repository.monthlyMemo(id,YearMonth.parse(month),"문의할 내용");
        repository.monthlyMemo(id,YearMonth.parse(month),"수정 내용");
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("수정 내용"));
    }
    @Test void memoPageDraftIsReusedAndLinkedWithItsTitleAndContext() throws Exception {
        String draft="{\"kind\":\"spend\",\"key\":\""+"a".repeat(32)+"\",\"label\":\"기타 지출 · 식비\"}";
        for(int i=0;i<2;i++) mvc.perform(post("/api/memos/ledger-draft").header("Authorization","Bearer "+token).contentType("application/json").content(draft)).andExpect(status().isOk());
        long id=jdbc.queryForObject("SELECT id FROM memos",Long.class);
        String longMemo="메".repeat(300);
        mvc.perform(patch("/api/memos/"+id).header("Authorization","Bearer "+token).contentType("application/json").content("{\"title\":\"점심 모임\",\"body\":\""+longMemo+"\"}")).andExpect(status().isOk());
        String registration=body(1000,"식비",null).replace("\"memo\":\"검증\"","\"memoId\":\""+id+"\"");
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+other).contentType("application/json").content(registration)).andExpect(status().isNotFound());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM expenses",Integer.class));
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(registration)).andExpect(status().isCreated());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        assertEquals(longMemo,jdbc.queryForObject("SELECT body FROM memos WHERE id=?",String.class,id));
        assertEquals(100,jdbc.queryForObject("SELECT memo FROM expenses",String.class).length());
        mvc.perform(get("/api/ledger/spend").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].memoTitle").value("점심 모임")).andExpect(jsonPath("$[0].memoId").value(Long.toString(id)));
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].ledgerContext").value("기타 지출 · "+date+" · 식비"));
    }
}

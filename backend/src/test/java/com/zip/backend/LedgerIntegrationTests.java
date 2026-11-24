package com.zip.backend;

import com.zip.backend.auth.AuthService;
import jakarta.servlet.ServletException;
import java.time.*;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DuplicateKeyException;
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
        token=auth.socialLogin("GOOGLE","ledger-user","ledger@example.com","가계부").accessToken();
        other=auth.socialLogin("GOOGLE","ledger-other","ledger-other@example.com","다른회원").accessToken();
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
    @Test void monthlyListKeepsMemoReferencesAndSalaryFlagsScopedToEachRecord() throws Exception {
        long owner = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, "ledger@example.com");
        long otherUser = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, "ledger-other@example.com");
        long salaryCategory = jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind = 'INCOME' AND name = '월급'", Long.class);
        long incomeCategory = jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind = 'INCOME' AND name = '용돈'", Long.class);
        long expenseCategory = jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind = 'EXPENSE' AND name = '식비'", Long.class);
        var recordDate = java.sql.Date.valueOf(date);
        jdbc.update("""
            INSERT INTO incomes (id, user_id, category_id, amount, income_date, income_type)
            VALUES (10, ?, ?, 5000, ?, 'FIXED'), (11, ?, ?, 1000, ?, 'FIXED')
            """, owner, salaryCategory, recordDate, owner, incomeCategory, recordDate);
        jdbc.update("INSERT INTO expenses (id, user_id, category_id, amount, expense_date) VALUES (10, ?, ?, 2000, ?)",
            owner, expenseCategory, recordDate);
        jdbc.update("INSERT INTO salary_records (user_id, period_ym, income_id) VALUES (?, ?, 10)", owner, month);
        jdbc.update("""
            INSERT INTO memos (id, user_id, title, body, items, ledger_source, ledger_key) VALUES
            (101, ?, '수입 메모', '', '[]', 'income', '10'),
            (102, ?, '지출 메모', '', '[]', 'spend', '10'),
            (103, ?, '다른 회원의 메모', '', '[]', 'income', '11'),
            (104, ?, '다른 문자열 키', '', '[]', 'income', '011')
            """, owner, owner, otherUser, owner);

        mvc.perform(get("/api/ledger/income").param("month", month).param("timeZone", "UTC")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].id").value("11"))
            .andExpect(jsonPath("$[0].salaryManaged").value(false))
            .andExpect(jsonPath("$[0].memoId").doesNotHaveJsonPath())
            .andExpect(jsonPath("$[0].memoTitle").doesNotHaveJsonPath())
            .andExpect(jsonPath("$[1].id").value("10"))
            .andExpect(jsonPath("$[1].salaryManaged").value(true))
            .andExpect(jsonPath("$[1].memoId").value("101"))
            .andExpect(jsonPath("$[1].memoTitle").value("수입 메모"));
        mvc.perform(get("/api/ledger/spend").param("month", month).param("timeZone", "UTC")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value("10"))
            .andExpect(jsonPath("$[0].salaryManaged").value(false))
            .andExpect(jsonPath("$[0].memoId").value("102"))
            .andExpect(jsonPath("$[0].memoTitle").value("지출 메모"));
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

    @Test void rejectedMemoLinkRollsBackExpenseEditAndNewCategory() throws Exception {
        mvc.perform(post("/api/ledger/spend").param("timeZone", "UTC").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body(1000, "식비", null))).andExpect(status().isCreated());
        long expenseId = jdbc.queryForObject("SELECT id FROM expenses", Long.class);
        long otherUser = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, "ledger-other@example.com");
        jdbc.update("INSERT INTO memos (id, user_id, title, body, items) VALUES (90, ?, '다른 회원의 메모', '', '[]')", otherUser);

        String edit = body(2000, "새 분류", null).replace("\"memo\":\"검증\"", "\"memoId\":\"90\"");
        mvc.perform(put("/api/ledger/spend/" + expenseId).param("timeZone", "UTC").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(edit)).andExpect(status().isNotFound());

        assertEquals(1000L, jdbc.queryForObject("SELECT amount FROM expenses WHERE id=?", Long.class, expenseId));
        assertEquals("식비", jdbc.queryForObject("""
            SELECT c.name FROM expenses e JOIN ledger_categories c ON c.id=e.category_id WHERE e.id=?
            """, String.class, expenseId));
        assertEquals("검증", jdbc.queryForObject("SELECT memo FROM expenses WHERE id=?", String.class, expenseId));
        assertEquals("검증", jdbc.queryForObject("SELECT body FROM memos WHERE ledger_source='spend' AND ledger_key=?",
            String.class, Long.toString(expenseId)));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM ledger_categories WHERE name='새 분류'", Integer.class));
    }

    @Test void failedSalaryLinkRollsBackIncomeMemoAndSalarySettings() throws Exception {
        mvc.perform(post("/api/ledger/income").param("timeZone", "UTC").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body(1000, "용돈", "other").replace("검증", "")))
            .andExpect(status().isCreated());
        long incomeId = jdbc.queryForObject("SELECT id FROM incomes", Long.class);
        // Occupy the monthly link so the last write fails after the income, memo and settings inserts.
        jdbc.update("INSERT INTO salary_records (user_id, period_ym, income_id) SELECT user_id, ?, id FROM incomes WHERE id=?",
            month, incomeId);

        var failure = assertThrows(ServletException.class, () -> postLedgerRecord("income", token, body(5000, "월급", "fixed")));
        assertInstanceOf(DuplicateKeyException.class, failure.getCause());
        assertEquals(List.of(incomeId), jdbc.queryForList("SELECT id FROM incomes", Long.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM memos", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM salary_settings", Integer.class));
        assertEquals(List.of(incomeId), jdbc.queryForList("SELECT income_id FROM salary_records", Long.class));
    }

    @Test void concurrentExpenseSavesKeepEachMemoOnItsOwnRecord() throws Exception {
        String secondSession = auth.socialLogin("GOOGLE", "ledger-user", "ledger@example.com", "가계부").accessToken();
        assertEquals(List.of(201, 201), concurrentStatuses(
            () -> postLedgerRecord("spend", token, body(1000, "식비", null).replace("검증", "첫 지출")),
            () -> postLedgerRecord("spend", secondSession, body(2000, "식비", null).replace("검증", "둘째 지출"))));

        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM expenses", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM memos", Integer.class));
        assertEquals(List.of("첫 지출", "둘째 지출"), jdbc.queryForList("""
            SELECT m.body FROM expenses e JOIN memos m
              ON m.user_id=e.user_id AND m.ledger_source='spend' AND m.ledger_key=CONCAT(e.id, '')
            ORDER BY e.amount
            """, String.class));
    }

    @Test void concurrentFirstSalarySavesCommitOneConsistentRecord() throws Exception {
        String secondSession = auth.socialLogin("GOOGLE", "ledger-user", "ledger@example.com", "가계부").accessToken();
        assertEquals(List.of(201, 409), concurrentStatuses(
            () -> postLedgerRecord("income", token, body(5000, "월급", "fixed")),
            () -> postLedgerRecord("income", secondSession, body(6000, "월급", "fixed"))));

        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM incomes", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM memos", Integer.class));
        assertEquals(1, jdbc.queryForObject("""
            SELECT COUNT(*) FROM incomes i
            JOIN salary_settings s ON s.user_id=i.user_id AND s.amount=i.amount
            JOIN salary_records r ON r.user_id=i.user_id AND r.income_id=i.id AND r.period_ym=?
            JOIN memos m ON m.user_id=i.user_id AND m.ledger_source='income' AND m.ledger_key=CONCAT(i.id, '')
            """, Integer.class, month));
    }

    @Test void concurrentMembersSavingTheSameNewCategoryShareItsId() throws Exception {
        assertEquals(List.of(201, 201), concurrentStatuses(
            () -> postLedgerRecord("spend", token, body(1000, "새 분류", null)),
            () -> postLedgerRecord("spend", other, body(2000, "새 분류", null))));

        assertEquals(2, jdbc.queryForObject("SELECT COUNT(DISTINCT user_id) FROM expenses", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(DISTINCT category_id) FROM expenses", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM ledger_categories WHERE kind='EXPENSE' AND name='새 분류'", Integer.class));
    }

    private int postLedgerRecord(String kind, String accessToken, String content) throws Exception {
        return mvc.perform(post("/api/ledger/" + kind).param("timeZone", "UTC").header("Authorization", "Bearer " + accessToken)
            .contentType("application/json").content(content)).andReturn().getResponse().getStatus();
    }

    private List<Integer> concurrentStatuses(Callable<Integer> first, Callable<Integer> second) throws Exception {
        var start = new CyclicBarrier(2);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var a = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return first.call();
            });
            var b = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return second.call();
            });
            return List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS)).stream().sorted().toList();
        } finally {
            executor.shutdownNow();
        }
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
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].draft").value(true));
        String longMemo="메".repeat(300);
        mvc.perform(patch("/api/memos/"+id).header("Authorization","Bearer "+token).contentType("application/json").content("{\"title\":\"점심 모임\",\"body\":\""+longMemo+"\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].draft").value(true));
        mvc.perform(patch("/api/memos/"+id).header("Authorization","Bearer "+other).contentType("application/json").content("{\"complete\":true}")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/memos/"+id).header("Authorization","Bearer "+token).contentType("application/json").content("{\"complete\":true}")).andExpect(status().isOk()).andExpect(jsonPath("$.draft").value(false));
        mvc.perform(post("/api/memos/ledger-draft").header("Authorization","Bearer "+token).contentType("application/json").content(draft)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(Long.toString(id)));
        String registration=body(1000,"식비",null).replace("\"memo\":\"검증\"","\"memoId\":\""+id+"\"");
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+other).contentType("application/json").content(registration)).andExpect(status().isNotFound());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM expenses",Integer.class));
        mvc.perform(post("/api/ledger/spend").param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(registration)).andExpect(status().isCreated());
        mvc.perform(delete("/api/memos/ledger-draft/"+"a".repeat(32)).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        assertEquals(longMemo,jdbc.queryForObject("SELECT body FROM memos WHERE id=?",String.class,id));
        assertEquals(100,jdbc.queryForObject("SELECT memo FROM expenses",String.class).length());
        mvc.perform(get("/api/ledger/spend").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].memoTitle").value("점심 모임")).andExpect(jsonPath("$[0].memoId").value(Long.toString(id)));
        mvc.perform(get("/api/memos").header("Authorization","Bearer "+token)).andExpect(jsonPath("$[0].draft").value(false)).andExpect(jsonPath("$[0].ledgerContext").value("기타 지출 · "+date+" · 식비"));
    }
    @Test void ledgerDraftsReuseFoldersByLedgerType() throws Exception {
        String[][] cases={{"income","fixed","고정 수입"},{"income","other","기타 수입"},{"bill","fixed","고정 지출"},{"spend","fixed","기타 지출"}};
        int key=1;
        for(var entry:cases) {
            for(int i=0;i<2;i++) {
                String draft="{\"kind\":\""+entry[0]+"\",\"incomeType\":\""+entry[1]+"\",\"key\":\""+String.format("%032x",key++)+"\",\"label\":\"検証\"}";
                mvc.perform(post("/api/memos/ledger-draft").header("Authorization","Bearer "+token).contentType("application/json").content(draft)).andExpect(status().isOk());
            }
            assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memo_folders WHERE name=?",Integer.class,entry[2]));
            assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM memos m JOIN memo_folders f ON m.folder_id=f.id WHERE f.name=? AND m.user_id=f.user_id",Integer.class,entry[2]));
        }
    }
    @Test void ledgerDraftKeepsFolderLimitAndFallsBackToUnclassified() throws Exception {
        // 폴더가 이미 100개면 분류 폴더를 새로 만들지 않고(일반 생성과 같은 제한) 초안은 미분류로 만들어짐
        long user=jdbc.queryForObject("SELECT id FROM users WHERE email='ledger@example.com'",Long.class);
        for(int i=0;i<100;i++) jdbc.update("INSERT INTO memo_folders(user_id,name) VALUES (?,?)",user,"폴더"+i);
        String draft="{\"kind\":\"spend\",\"key\":\""+"c".repeat(32)+"\",\"label\":\"기타 지출 · 식비\"}";
        mvc.perform(post("/api/memos/ledger-draft").header("Authorization","Bearer "+token).contentType("application/json").content(draft)).andExpect(status().isOk());
        assertEquals(100,jdbc.queryForObject("SELECT COUNT(*) FROM memo_folders WHERE user_id=?",Integer.class,user));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos WHERE user_id=? AND folder_id IS NULL",Integer.class,user));
    }
    @Test void discardingUnregisteredLedgerMemoDeletesOnlyOwnedDraft() throws Exception {
        String key="b".repeat(32);
        String draft="{\"kind\":\"income\",\"key\":\""+key+"\",\"label\":\"고정 수입\"}";
        mvc.perform(post("/api/memos/ledger-draft").header("Authorization","Bearer "+token).contentType("application/json").content(draft)).andExpect(status().isOk());
        long id=jdbc.queryForObject("SELECT id FROM memos",Long.class);
        mvc.perform(patch("/api/memos/"+id).header("Authorization","Bearer "+token).contentType("application/json").content("{\"complete\":true}")).andExpect(status().isOk());
        mvc.perform(delete("/api/memos/ledger-draft/"+key).header("Authorization","Bearer "+other)).andExpect(status().isNoContent());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        for(int i=0;i<2;i++) mvc.perform(delete("/api/memos/ledger-draft/"+key).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM memos",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM memo_folders",Integer.class));
        mvc.perform(delete("/api/memos/ledger-draft/"+key)).andExpect(status().isUnauthorized());
    }
}

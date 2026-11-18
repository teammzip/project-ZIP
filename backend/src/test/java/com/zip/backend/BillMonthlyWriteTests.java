package com.zip.backend;

import com.zip.backend.ai.GeminiClient;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="zip.ai.daily-limit=2")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql","/home-info-fixture.sql"})
class BillMonthlyWriteTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired BillService service;
    @Autowired com.zip.backend.ai.AiService ai;
    @Autowired JwtDecoder decoder;
    @MockitoBean GeminiClient gemini;
    String token, month;
    long user, session, conversationId;
    @BeforeEach void seed() {
        token=auth.socialLogin("GOOGLE","monthly-write","write@example.com","월별등록");
        var jwt=decoder.decode(token); user=Long.parseLong(jwt.getSubject()); session=Long.parseLong(jwt.getClaimAsString("sid"));
        month=YearMonth.now(ZoneOffset.UTC).toString();
        conversationId=Long.parseLong((String)ai.create(user,"AI_PAGE","bill").get("id"));
        when(gemini.enabled()).thenReturn(true);
    }
    Map<String,Object> input(long amount) { return Map.of("name","전기","tag","공과금","amount",amount,"dueDate","2026-12-05"); }
    @Test void registrationWithoutNameUsesCategoryAsDisplayName() {
        var saved=service.registerMonthly(user,session,month,"UTC",Map.of("tag","통신","amount",30000,"dueDate","2026-12-05"));
        assertEquals("통신",saved.get("name"));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void monthlyRegistrationAndEditPreserveOtherMonthAndPaidStatus() {
        var created=service.registerMonthly(user,session,month,"UTC",input(40000));
        long id=Long.parseLong((String)created.get("id"));
        var previous=YearMonth.parse(month).minusMonths(1);
        jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (?,?,?)",id,previous.toString(),30000);
        jdbc.update("UPDATE bill_payments SET paid_at=CURRENT_TIMESTAMP WHERE bill_item_id=? AND period_ym=?",id,month);
        assertEquals(409,assertThrows(ApiException.class,()->service.updateMonthly(user,session,id,month,"UTC",Map.of("amount",45000,"dueDate","2026-12-10"))).status());
        assertEquals(40000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=?",Long.class,id,month));
        jdbc.update("UPDATE bill_payments SET paid_at=NULL WHERE bill_item_id=? AND period_ym=?",id,month);
        var edited=service.updateMonthly(user,session,id,month,"UTC",Map.of("amount",45000,"dueDate","2026-12-10"));
        assertEquals(45000L,edited.get("amount")); assertEquals("2026-12-10",edited.get("dueDate")); assertEquals(false,edited.get("paid"));
        assertEquals(30000L,jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=?",Long.class,id,previous.toString()));
        assertEquals(45000L,jdbc.queryForObject("SELECT default_amount FROM bill_items WHERE id=?",Long.class,id));
        var separate=service.registerMonthly(user,session,month,"UTC",input(50000));
        assertNotEquals(created.get("id"),separate.get("id")); // category/name alone cannot identify a bill
    }
    @Test void unregisteredMonthAndOtherUsersCannotBeEdited() {
        long id=Long.parseLong((String)service.registerMonthly(user,session,month,"UTC",input(40000)).get("id"));
        String previous=YearMonth.parse(month).minusMonths(1).toString();
        assertEquals(404,assertThrows(ApiException.class,()->service.updateMonthly(user,session,id,previous,"UTC",Map.of("amount",100,"dueDate","2026-12-01"))).status());
        String other=auth.socialLogin("GOOGLE","monthly-other","other@example.com","다른회원");
        var jwt=decoder.decode(other);
        assertEquals(404,assertThrows(ApiException.class,()->service.updateMonthly(Long.parseLong(jwt.getSubject()),Long.parseLong(jwt.getClaimAsString("sid")),id,month,"UTC",Map.of("amount",100,"dueDate","2026-12-01"))).status());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void existingEstimateCanBeRegisteredWithoutDuplicatingItem() {
        jdbc.update("INSERT INTO bill_items(user_id,name,tag,default_amount) VALUES (?,'전기','공과금',40000)",user);
        var created=service.registerMonthly(user,session,month,"UTC",input(42000));
        assertEquals(true,created.get("snapshot"));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void invalidInputsAndFutureMonthsAreRejectedBeforeSaving() throws Exception {
        for (String payload: List.of("{\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":-1,\"dueDate\":\"2026-12-01\"}",
            "{\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":1,\"dueDate\":\"2026-02-30\"}")) {
            mvc.perform(post("/api/bills/monthly").param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token).contentType("application/json").content(payload)).andExpect(status().isBadRequest());
        }
        assertThrows(ApiException.class,()->service.registerMonthly(user,session,YearMonth.parse(month).plusMonths(1).toString(),"UTC",input(40000)));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
    }
    MockMultipartFile photo() { return new MockMultipartFile("photo","bill.png","image/png",new byte[]{(byte)137,80,78,71,13,10,26,10,0}); }
    String analyze(MockMultipartFile file) throws Exception {
        String response=mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(file).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.preview.amount").value(42000)).andReturn().getResponse().getContentAsString();
        return tools.jackson.databind.json.JsonMapper.builder().build().readTree(response).path("draftId").asText();
    }
    org.springframework.test.web.servlet.ResultActions decide(String id,boolean register) throws Exception {
        return mvc.perform(post("/api/ai/conversations/"+conversationId+"/bill-photo/"+id+"/decision")
            .header("Authorization","Bearer "+token).contentType("application/json").content("{\"register\":"+register+"}"));
    }
    @Test void photoRequiresConsentAndRetryDoesNotDuplicate() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn("{\"readable\":true,\"name\":\"사진전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-12-05\"}");
        var id=analyze(photo());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        assertEquals("PENDING",jdbc.queryForObject("SELECT state FROM bill_photo_drafts WHERE id=?",String.class,id));
        decide(id,true).andExpect(status().isOk()).andExpect(jsonPath("$.registered").value(true));
        decide(id,true).andExpect(status().isConflict());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        verify(gemini,times(1)).billImage(any(),anyString(),anyString(),anyString());
    }
    @Test void cancellationExpiryAndWrongTopicDoNotRegister() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn("{\"readable\":true,\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-12-05\"}");
        var cancelled=analyze(photo());
        decide(cancelled,false).andExpect(status().isOk()).andExpect(jsonPath("$.registered").value(false));
        decide(cancelled,true).andExpect(status().isConflict());
        var expired=analyze(photo());
        jdbc.update("UPDATE bill_photo_drafts SET expires_at=? WHERE id=?",java.sql.Timestamp.from(Instant.now().minusSeconds(1)),expired);
        decide(expired,true).andExpect(status().isGone());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        conversationId=Long.parseLong((String)ai.create(user,"AI_PAGE","qna").get("id"));
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
    }
    @Test void anotherOwnerCannotConfirmDraft() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn("{\"readable\":true,\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-12-05\"}");
        var id=analyze(photo());
        String other=auth.socialLogin("GOOGLE","draft-other","draft-other@example.com","다른회원");
        mvc.perform(post("/api/ai/conversations/"+conversationId+"/bill-photo/"+id+"/decision").header("Authorization","Bearer "+other)
            .contentType("application/json").content("{\"register\":true}")).andExpect(status().isNotFound());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void unreadablePhotoAndAiFailureDoNotSaveOrConsumeQuota() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn("{\"readable\":false}").thenThrow(new IllegalStateException("provider failure"));
        for (int code:List.of(422,502)) mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().is(code));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT question_count FROM ai_usage_daily WHERE user_id=?",Integer.class,user));
    }
    @Test void disabledAiInvalidPhotoAndAnonymousRequestsAreRejected() throws Exception {
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC")).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(new MockMultipartFile("photo","fake.png","image/png",new byte[]{1,2,3})).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        when(gemini.enabled()).thenReturn(false);
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isServiceUnavailable());
        verify(gemini,never()).billImage(any(),anyString(),anyString(),anyString());
    }
    @Test void invalidAiDateDoesNotPersistAnything() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn("{\"readable\":true,\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-02-30\"}");
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_photo_imports",Integer.class));
    }
    @Test void photoQuotaIsSharedWithChat() throws Exception {
        jdbc.update("INSERT INTO ai_usage_daily(user_id,usage_date,question_count) VALUES (?,?,2)",user,LocalDate.now(ZoneId.of("Asia/Seoul")));
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isTooManyRequests());
        verify(gemini,never()).billImage(any(),anyString(),anyString(),anyString());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
    }
    @Test void photosRequireOwnedConversationAndMemoPersists() throws Exception {
        String other=auth.socialLogin("GOOGLE","photo-other","photo-other@example.com","다른회원");
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        verify(gemini,never()).billImage(any(),anyString(),anyString(),anyString());
        var body=new HashMap<String,Object>(input(40000)); body.put("memo","이번 달 전기요금");
        var saved=service.registerMonthly(user,session,month,"UTC",body);
        assertEquals("이번 달 전기요금",saved.get("memo"));
        service.updateMonthly(user,session,Long.parseLong((String)saved.get("id")),month,"UTC",Map.of("amount",45000,"dueDate","2026-12-05","memo","수정 메모"));
        assertEquals("수정 메모",jdbc.queryForObject("SELECT memo FROM bill_payments WHERE bill_item_id=?",String.class,Long.parseLong((String)saved.get("id"))));
    }
    @Test void chatSaveFailureRollsBackBillAndPhotoImport() throws Exception {
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenAnswer(call -> {
            jdbc.update("DELETE FROM ai_conversations WHERE id=?",conversationId);
            return "{\"readable\":true,\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-12-05\"}";
        });
        mvc.perform(multipart("/api/ai/conversations/"+conversationId+"/bill-photo").file(photo()).param("month",month).param("timeZone","UTC").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_items",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_photo_imports",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT question_count FROM ai_usage_daily WHERE user_id=?",Integer.class,user));
    }
    @Test void sameRecognizedDocumentFromAnotherPhotoIsBlockedButDifferentBillIsAllowed() throws Exception {
        String document="{\"readable\":true,\"name\":\"전기\",\"tag\":\"공과금\",\"amount\":42000,\"dueDate\":\"2026-12-05\",\"issuer\":\"한국전력\",\"billReference\":\"INV-123\",\"billingMonth\":\"2026-11\"}";
        jdbc.update("UPDATE ai_usage_daily SET question_count=0 WHERE user_id=?",user);
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn(document);
        decide(analyze(photo()),true).andExpect(status().isOk());
        var otherPhoto=new MockMultipartFile("photo","retaken.png","image/png",new byte[]{(byte)137,80,78,71,13,10,26,10,1});
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn(document.replace("INV-123","ＩＮＶ １２３").replace("한국전력","한국 전력"));
        decide(analyze(otherPhoto),true).andExpect(status().isConflict());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        jdbc.update("UPDATE ai_usage_daily SET question_count=0 WHERE user_id=?",user);
        when(gemini.billImage(any(),anyString(),anyString(),anyString())).thenReturn(document.replace("INV-123","INV-999"));
        decide(analyze(otherPhoto),true).andExpect(status().isOk());
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM bill_document_keys",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
    }
    @Test void pastDeadlineIsBlockedAndTodayIsAcceptedInSelectedTimeZone() {
        jdbc.update("UPDATE auth_sessions SET expires_at=? WHERE id=?",java.sql.Timestamp.from(Instant.parse("2026-11-19T00:30:00Z")),session);
        var fixed=new BillService(new com.zip.backend.bills.BillRepository(jdbc),new com.zip.backend.auth.AuthRepository(jdbc),Clock.fixed(Instant.parse("2026-11-18T00:30:00Z"),ZoneOffset.UTC));
        var body=Map.<String,Object>of("tag","공과금","amount",40000,"dueDate","2026-11-17");
        assertEquals(400,assertThrows(ApiException.class,()->fixed.registerMonthly(user,session,"2026-11","UTC",body)).status());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments",Integer.class));
        var saved=fixed.registerMonthly(user,session,"2026-11","America/Los_Angeles",body);
        assertEquals("2026-11-17",saved.get("dueDate"));
    }
    @Test void categoryAmountAndDeadlineWithoutPrintedIdentityAreNotConsideredTheSameBill() {
        var json=tools.jackson.databind.json.JsonMapper.builder().build();
        assertNull(com.zip.backend.bills.BillDocumentIdentity.from(json.readTree("{\"tag\":\"공과금\",\"amount\":40000,\"dueDate\":\"2026-12-05\"}")));
        assertNull(com.zip.backend.bills.BillDocumentIdentity.from(json.readTree("{\"issuer\":\"한국전력\",\"billReference\":\"\",\"billingMonth\":\"2026-11\"}")));
    }
}

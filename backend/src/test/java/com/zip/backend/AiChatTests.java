package com.zip.backend;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.zip.backend.ai.GeminiClient;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

/** Saved AI conversations with Gemini itself replaced by a fake (no network, no real key). */
@SpringBootTest(properties = {"zip.oauth.frontend-url=http://localhost:3000", "zip.ai.daily-limit=2"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class AiChatTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean GeminiClient gemini;

    private void seedUser(long id, String loginId) {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, email, nickname, address) VALUES (?, ?, ?, ?, '테스터', '서울 마포구')",
            id, loginId, passwords.encode("abcd123!"), loginId + "@zip.com");
        jdbc.update("INSERT INTO user_settings (user_id) VALUES (?)", id);
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) SELECT ?, id, CURRENT_TIMESTAMP FROM terms_documents WHERE version = '2026-10-18'", id);
    }

    private String login(String loginId) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + loginId + "\",\"password\":\"abcd123!\",\"remember\":false}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
    }

    private String newConversation(String token, String entryPoint, String topic) throws Exception {
        String body = mvc.perform(post("/api/ai/conversations").header("Authorization", token).contentType("application/json")
            .content("{\"entryPoint\":\"" + entryPoint + "\",\"topic\":" + (topic == null ? "null" : "\"" + topic + "\"") + "}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.id");
    }

    private static String ask(String text) { return "{\"text\":\"" + text + "\"}"; }

    @Test void aQuestionIsAnsweredAndBothMessagesAreSaved() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        when(gemini.enabled()).thenReturn(true);
        when(gemini.chat(anyString(), any())).thenReturn("식초와 베이킹소다를 써 보세요.");
        String id = newConversation(token, "AI_PAGE", "qna");

        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("곰팡이 어떻게 지워요?")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.role").value("USER"))
            .andExpect(jsonPath("$.reply.role").value("ASSISTANT"))
            .andExpect(jsonPath("$.reply.text").value("식초와 베이킹소다를 써 보세요."));

        mvc.perform(get("/api/ai/conversations/" + id + "/messages").header("Authorization", token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].text").value("곰팡이 어떻게 지워요?")).andExpect(jsonPath("$[1].role").value("ASSISTANT"));
        mvc.perform(get("/api/ai/conversations?entryPoint=AI_PAGE").header("Authorization", token))
            .andExpect(jsonPath("$[0].title").value("곰팡이 어떻게 지워요?")).andExpect(jsonPath("$[0].topic").value("qna"));
        assertEquals(1, jdbc.queryForObject("SELECT question_count FROM ai_usage_daily WHERE user_id = 1", Integer.class));
    }

    @Test void theHistorySentToTheAiComesFromTheDatabase() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        when(gemini.enabled()).thenReturn(true);
        when(gemini.chat(anyString(), any())).thenReturn("첫 답").thenAnswer(call -> {
            List<GeminiClient.Turn> turns = call.getArgument(1);
            assertEquals(3, turns.size());
            assertEquals("user", turns.get(0).role());
            assertEquals("첫 질문", turns.get(0).text());
            assertEquals("model", turns.get(1).role());
            assertEquals("둘째 질문", turns.get(2).text());
            return "둘째 답";
        });
        String id = newConversation(token, "HOME_MODAL", null);
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("첫 질문"))).andExpect(status().isOk());
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("둘째 질문"))).andExpect(status().isOk());
    }

    @Test void anExchangeTheAppAnsweredItselfIsSavedWithItsCard() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        String id = newConversation(token, "HOME_MODAL", "summary");
        mvc.perform(post("/api/ai/conversations/" + id + "/exchanges").header("Authorization", token).contentType("application/json")
            .content("{\"text\":\"이번 달 지출 요약해 줘\",\"reply\":\"이번 달 지출을 정리해 봤어요.\",\"card\":{\"type\":\"SPEND_SUMMARY\",\"data\":{\"month\":11,\"total\":120000,\"rows\":[[\"월세\",100000]]}}}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/ai/conversations/" + id + "/messages").header("Authorization", token))
            .andExpect(jsonPath("$[1].card.type").value("SPEND_SUMMARY"))
            .andExpect(jsonPath("$[1].card.data.total").value(120000))
            .andExpect(jsonPath("$[1].card.data.rows[0][0]").value("월세"));
        assertEquals(0, jdbc.queryForList("SELECT question_count FROM ai_usage_daily WHERE user_id = 1").size());
    }

    @Test void aBadCardTypeIsRejected() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        String id = newConversation(token, "HOME_MODAL", null);
        mvc.perform(post("/api/ai/conversations/" + id + "/exchanges").header("Authorization", token).contentType("application/json")
            .content("{\"text\":\"질문\",\"reply\":\"답\",\"card\":{\"type\":\"EVIL\",\"data\":{}}}")).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages", Integer.class));
    }

    @Test void nobodyElseCanSeeUseOrDeleteAConversation() throws Exception {
        seedUser(1, "tester01");
        seedUser(2, "tester02");
        String owner = login("tester01");
        String other = login("tester02");
        when(gemini.enabled()).thenReturn(true);
        String id = newConversation(owner, "HOME_MODAL", null);
        mvc.perform(get("/api/ai/conversations/" + id + "/messages").header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", other).contentType("application/json").content(ask("안녕"))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/ai/conversations/" + id).header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/ai/conversations").header("Authorization", other)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/ai/conversations/" + id + "/messages").header("Authorization", owner)).andExpect(status().isOk());
    }

    @Test void requiresLogin() throws Exception {
        mvc.perform(get("/api/ai/conversations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/conversations/1/messages").contentType("application/json").content(ask("안녕"))).andExpect(status().isUnauthorized());
    }

    @Test void answers503WhenNoKeyIsConfigured() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        when(gemini.enabled()).thenReturn(false);
        String id = newConversation(token, "HOME_MODAL", null);
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("안녕")))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("AI_DISABLED"));
    }

    @Test void stopsAtTheDailyLimit() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        when(gemini.enabled()).thenReturn(true);
        when(gemini.chat(anyString(), any())).thenReturn("답변");
        String id = newConversation(token, "HOME_MODAL", null);
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("질문" + i))).andExpect(status().isOk());
        }
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("또 질문")))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("AI_LIMIT"));
        assertEquals(4, jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages", Integer.class));
    }

    @Test void aFailedCallSavesNothingAndKeepsTheQuestion() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        when(gemini.enabled()).thenReturn(true);
        when(gemini.chat(anyString(), any())).thenThrow(new IllegalStateException("boom"));
        String id = newConversation(token, "HOME_MODAL", null);
        mvc.perform(post("/api/ai/conversations/" + id + "/messages").header("Authorization", token).contentType("application/json").content(ask("안녕")))
            .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("AI_FAILED"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT question_count FROM ai_usage_daily WHERE user_id = 1", Integer.class));
    }

    @Test void deletingConversationsRemovesTheirMessagesAndWithdrawalRemovesEverything() throws Exception {
        seedUser(1, "tester01");
        String token = login("tester01");
        String first = newConversation(token, "HOME_MODAL", null);
        newConversation(token, "AI_PAGE", null);
        mvc.perform(post("/api/ai/conversations/" + first + "/exchanges").header("Authorization", token).contentType("application/json")
            .content("{\"text\":\"질문\",\"reply\":\"답\"}")).andExpect(status().isOk());
        mvc.perform(delete("/api/ai/conversations/" + first).header("Authorization", token)).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM ai_conversations", Integer.class));
        mvc.perform(delete("/api/ai/conversations").header("Authorization", token)).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM ai_conversations", Integer.class));
    }
}

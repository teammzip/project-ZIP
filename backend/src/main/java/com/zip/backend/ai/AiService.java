package com.zip.backend.ai;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * AI chat with saved conversations (ai_conversations / ai_messages, frontend/API.md section 8).
 * The conversation history sent to Gemini always comes from the database, never from the browser.
 */
@Service
public class AiService {
    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Set<String> ENTRY_POINTS = Set.of("HOME_MODAL", "AI_PAGE");
    private static final Set<String> CARD_TYPES = Set.of("SPEND_SUMMARY", "LINK");
    private static final int HISTORY_TURNS = 12;
    private static final int MAX_MESSAGES = 400;
    private static final int MAX_CARD_JSON = 4000;

    // 법률·세금·의료·금융은 틀리면 피해가 크다. AI가 지시문의 "전문가 확인" 안내를 빼먹어도 되도록,
    // 이런 질문·답변에는 서버가 면책 문구를 항상 직접 덧붙인다(AI에게 맡기지 않는다).
    private static final String DISCLAIMER = "※ 참고용 안내예요. 법률·세금·의료·금융처럼 중요한 결정은 꼭 전문가나 관할 기관에 확인해 주세요.";
    // 면책이 필요한지 가르는 단어 목록. "법", "약"처럼 너무 흔한 한 글자는 일부러 뺐다(방법, 약속 등에 반응하지 않도록).
    private static final List<String> SENSITIVE_WORDS = List.of(
        "법률", "법적", "소송", "고소", "변호사", "내용증명", "임대차", "확정일자", "전입신고", "손해배상",
        "세금", "세무", "소득세", "부가세", "연말정산", "종합소득", "양도세", "취득세",
        "증상", "진료", "병원", "처방", "복용", "약국", "치료", "질환", "진단",
        "대출", "투자", "주식", "보험", "펀드", "금리", "이자율");

    private static final String SYSTEM = """
        너는 혼자 사는 사람(자취생)의 생활을 돕는 한국어 도우미 "ZIP AI"야.
        분리배출, 냉장고 재료로 요리, 곰팡이·청소, 월세·보증금·계약, 공과금과 생활비 절약, 집주인에게 보낼 연락 문구 등을 도와줘.
        - 존댓말로, 친근하고 짧게 답해. 길어도 핵심만 단계별로 정리해.
        - 법률·세금·의료처럼 전문 판단이 필요한 내용은 일반적인 안내만 하고, 중요한 결정은 전문가나 관할 기관에 확인하라고 덧붙여.
        - 모르는 건 아는 척하지 말고 모른다고 말해.
        - 마크다운 기호(별표 *, **, 샵 #, 백틱 `)는 절대 쓰지 말고 일반 글자로만 답해. 목록은 줄마다 "- "나 "1. "로 시작해.
        - 서비스 이용과 무관한 요청이나 위험한 요청은 정중히 거절해.
        """;

    private final GeminiClient gemini;
    private final AiRepository repository;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final JsonMapper json;
    private final Clock clock;
    private final int dailyLimit;

    public AiService(GeminiClient gemini, AiRepository repository, JdbcTemplate jdbc, TransactionTemplate tx, JsonMapper json,
        Clock clock, @Value("${zip.ai.daily-limit:30}") int dailyLimit) {
        this.gemini = gemini;
        this.repository = repository;
        this.jdbc = jdbc;
        this.tx = tx;
        this.json = json;
        this.clock = clock;
        this.dailyLimit = dailyLimit;
    }

    public record CardInput(String type, Map<String, Object> data) {}

    public List<Map<String, Object>> list(long userId, String entryPoint) {
        if (entryPoint != null && !ENTRY_POINTS.contains(entryPoint)) throw new ApiException(400, "시작한 곳을 확인해 주세요.");
        return repository.list(userId, entryPoint, 20).stream().map(c -> {
            var out = new LinkedHashMap<String, Object>();
            out.put("id", Long.toString(c.id()));
            out.put("title", c.title());
            out.put("topic", c.topic());
            out.put("entryPoint", c.entryPoint());
            out.put("updatedAt", c.updatedAt().toString());
            return (Map<String, Object>) out;
        }).toList();
    }

    public Map<String, Object> create(long userId, String entryPoint, String topic) {
        if (!ENTRY_POINTS.contains(entryPoint)) throw new ApiException(400, "시작한 곳을 확인해 주세요.");
        long id = repository.createConversation(userId, repository.topicId(topic), entryPoint, clock.instant());
        return Map.of("id", Long.toString(id));
    }

    public List<Map<String, Object>> messages(long userId, long conversationId) {
        owned(userId, conversationId);
        return repository.messages(conversationId).stream().map(this::view).toList();
    }

    /** A question for the AI. Nothing is saved unless the AI answers, and a failed call does not use up a daily question. */
    public Map<String, Object> ask(long userId, long conversationId, String text, String topic) {
        if (!gemini.enabled()) throw new ApiException(503, "AI가 아직 준비되지 않았어요.", "AI_DISABLED");
        var conversation = owned(userId, conversationId);
        String question = clean(text);
        checkRoom(conversationId);

        var turns = new ArrayList<GeminiClient.Turn>();
        for (var m : repository.recent(conversationId, HISTORY_TURNS)) {
            turns.add(new GeminiClient.Turn("USER".equals(m.role()) ? "user" : "model", m.content()));
        }
        turns.add(new GeminiClient.Turn("user", question));
        // Gemini wants the conversation to start with the user; drop leading assistant messages (greetings, summaries).
        while ("model".equals(turns.get(0).role())) turns.remove(0);

        var date = LocalDate.now(clock.withZone(SEOUL));
        if (!takeQuestion(userId, date)) {
            throw new ApiException(429, "오늘은 질문 " + dailyLimit + "번을 모두 썼어요. 내일 다시 물어봐 주세요.", "AI_LIMIT");
        }
        String answer;
        try {
            String code = topic != null && !topic.isBlank() ? topic.strip() : conversation.topic();
            String system = code == null ? SYSTEM : SYSTEM + "\n지금 대화 주제 코드: " + code;
            answer = plain(gemini.chat(system, merge(turns)));
            if (answer.isEmpty()) throw new IllegalStateException("empty answer");
            answer = withDisclaimer(question, answer); // 빈 답변 검사 뒤에 붙인다(빈 답변이 문구만 남아 성공처럼 보이지 않게)
        } catch (RuntimeException error) {
            giveBack(userId, date);
            log.warn("Gemini call failed: {}", error.toString());
            if (error instanceof org.springframework.web.client.RestClientResponseException http && http.getStatusCode().value() == 429) {
                // Gemini's own quota/rate limit is used up (not the per-user daily limit)
                throw new ApiException(503, "AI 사용량을 모두 써서 지금은 더 이상 답할 수 없어요. 잠시 뒤나 내일 다시 시도해 주세요.", "AI_QUOTA");
            }
            throw new ApiException(502, "AI가 지금 답하지 못했어요. 잠시 뒤에 다시 시도해 주세요.", "AI_FAILED");
        }
        try {
            return save(conversationId, question, answer, null);
        } catch (RuntimeException error) {
            giveBack(userId, date);
            throw error;
        }
    }

    /** Stores an exchange the app answered by itself (fixed topics, spend summary card, demo answer). No AI call, no daily question used. */
    public Map<String, Object> record(long userId, long conversationId, String text, String reply, CardInput card) {
        owned(userId, conversationId);
        String question = clean(text);
        String answer = clean(reply);
        checkRoom(conversationId);
        return save(conversationId, question, answer, card);
    }

    public void delete(long userId, long conversationId) {
        owned(userId, conversationId);
        repository.delete(conversationId);
    }

    public void deleteAll(long userId) {
        repository.deleteAll(userId);
    }

    private Map<String, Object> save(long conversationId, String question, String answer, CardInput card) {
        String cardType = null;
        String cardData = null;
        if (card != null) {
            if (card.type() == null || !CARD_TYPES.contains(card.type()) || card.data() == null) throw new ApiException(400, "카드 내용을 확인해 주세요.");
            cardType = card.type();
            cardData = json.writeValueAsString(card.data());
            if (cardData.length() > MAX_CARD_JSON) throw new ApiException(400, "카드 내용이 너무 길어요.");
        }
        final String type = cardType;
        final String data = cardData;
        return tx.execute(status -> {
            var now = clock.instant();
            var user = repository.addMessage(conversationId, "USER", question, null, null, now);
            var reply = repository.addMessage(conversationId, "ASSISTANT", answer, type, data, now);
            repository.touch(conversationId, title(question), now);
            return Map.of("user", view(user), "reply", view(reply));
        });
    }

    public void requireConversation(long userId, long conversationId) { owned(userId, conversationId); checkRoom(conversationId); }

    private AiRepository.Conversation owned(long userId, long conversationId) {
        return repository.find(conversationId, userId).orElseThrow(() -> new ApiException(404, "대화를 찾을 수 없어요."));
    }

    private static String clean(String text) {
        String value = text == null ? "" : text.strip();
        if (value.isEmpty()) throw new ApiException(400, "내용을 입력해 주세요.");
        return value;
    }

    private void checkRoom(long conversationId) {
        if (repository.countMessages(conversationId) >= MAX_MESSAGES) throw new ApiException(400, "대화가 너무 길어졌어요. 새 대화를 시작해 주세요.");
    }

    /** Conversation title = the first question, shortened. */
    private static String title(String question) {
        String one = question.replaceAll("\\s+", " ");
        return one.codePointCount(0, one.length()) <= 30 ? one : one.substring(0, one.offsetByCodePoints(0, 30)) + "…";
    }

    private Map<String, Object> view(AiRepository.Message m) {
        var out = new LinkedHashMap<String, Object>();
        out.put("id", Long.toString(m.id()));
        out.put("role", m.role());
        out.put("text", m.content());
        out.put("createdAt", m.createdAt().toString());
        if (m.cardType() != null && m.cardData() != null) {
            out.put("card", Map.of("type", m.cardType(), "data", json.readTree(m.cardData())));
        }
        return out;
    }

    /**
     * 질문이나 답변에 법률·세금·의료·금융 단어가 있으면 답변 끝에 면책 문구를 붙인다. 이미 붙어 있으면 또 붙이지 않는다.
     * 이 서버 코드가 붙이므로 AI가 지시문을 무시해도 항상 들어간다.
     */
    public static String withDisclaimer(String question, String answer) {
        if (answer == null || answer.isEmpty() || answer.contains(DISCLAIMER)) return answer;
        String all = (question == null ? "" : question) + "\n" + answer;
        for (String word : SENSITIVE_WORDS) {
            if (all.contains(word)) return answer + "\n\n" + DISCLAIMER;
        }
        return answer;
    }

    /** The chat shows plain text, so markdown marks the model still adds are removed (**bold**, # headings, `code`, "* " bullets). */
    public static String plain(String text) {
        if (text == null) return "";
        return text
            .replaceAll("(?m)^\\s{0,3}#{1,6}\\s+", "")
            .replaceAll("(?m)^(\\s*)[*+]\\s+", "$1- ")
            .replaceAll("\\*{1,3}([^*\\n]+?)\\*{1,3}", "$1")
            .replace("**", "")
            .replace("`", "")
            .strip();
    }

    /** Back-to-back turns with the same role are joined so the alternation rule always holds. */
    private static List<GeminiClient.Turn> merge(List<GeminiClient.Turn> turns) {
        var out = new ArrayList<GeminiClient.Turn>();
        for (var turn : turns) {
            if (!out.isEmpty() && out.get(out.size() - 1).role().equals(turn.role())) {
                var last = out.remove(out.size() - 1);
                out.add(new GeminiClient.Turn(last.role(), last.text() + "\n" + turn.text()));
            } else {
                out.add(turn);
            }
        }
        return out;
    }

    public boolean takeQuestion(long userId, LocalDate date) {
        for (int attempt = 0; attempt < 2; attempt++) {
            if (jdbc.update("UPDATE ai_usage_daily SET question_count = question_count + 1 WHERE user_id = ? AND usage_date = ? AND question_count < ?",
                userId, date, dailyLimit) == 1) return true;
            boolean exists = jdbc.queryForObject("SELECT COUNT(*) FROM ai_usage_daily WHERE user_id = ? AND usage_date = ?", Long.class, userId, date) > 0;
            if (exists) return false;
            try {
                jdbc.update("INSERT INTO ai_usage_daily (user_id, usage_date, question_count) VALUES (?, ?, 1)", userId, date);
                return true;
            } catch (DuplicateKeyException raced) {
                // another request created the row at the same moment: try the update again
            }
        }
        return false;
    }

    public void giveBack(long userId, LocalDate date) {
        jdbc.update("UPDATE ai_usage_daily SET question_count = question_count - 1 WHERE user_id = ? AND usage_date = ? AND question_count > 0", userId, date);
    }
}

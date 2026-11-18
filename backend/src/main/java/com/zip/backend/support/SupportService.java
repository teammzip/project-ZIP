package com.zip.backend.support;

import com.zip.backend.common.ApiException;
import com.zip.backend.notification.NotificationService;
import java.time.Clock;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 고객센터 1대1 문의 (frontend/API.md 13장). 회원은 내 문의만 보고 쓰고, 답변은 관리자만(/api/admin/** 는 보안 설정에서 ADMIN 만).
 * 문의 하나에 답변 하나: 이미 답변이 있으면 409 (먼저 단 답변을 덮어쓰지 않음).
 */
@Service
public class SupportService {
    static final List<String> CATEGORIES = List.of("이용 문의", "오류 신고", "개선 제안", "계정 문의", "기타");
    static final int TITLE_MAX = 100;
    static final int CONTENT_MAX = 3_000;
    /** 한 사람이 하루에 남길 수 있는 문의 수 (도배 막기) */
    static final int DAILY_MAX = 20;
    static final int ADMIN_LIST_MAX = 500;
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");

    private final SupportRepository repository;
    private final NotificationService notifications;
    private final Clock clock;

    public SupportService(SupportRepository repository, NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.notifications = notifications;
        this.clock = clock;
    }

    public record InquiryInput(String category, String title, String content) {}
    public record AnswerInput(String content) {}

    public List<Map<String, Object>> mine(long userId) {
        return repository.mine(userId).stream().map(SupportService::inquiry).toList();
    }

    public List<Map<String, Object>> all() {
        return repository.all(ADMIN_LIST_MAX).stream().map(SupportService::inquiry).toList();
    }

    @Transactional
    public Map<String, Object> create(long userId, InquiryInput input) {
        if (input == null) throw new ApiException(400, "문의 내용을 보내 주세요.");
        if (input.category() == null || !CATEGORIES.contains(input.category())) {
            throw new ApiException(400, "문의 유형은 " + String.join(" · ", CATEGORIES) + " 중 하나예요.");
        }
        var title = input.title() == null ? "" : input.title().strip();
        if (title.isEmpty() || title.length() > TITLE_MAX || title.contains("\n") || CONTROL.matcher(title).find()) {
            throw new ApiException(400, "제목은 " + TITLE_MAX + "자 이내 한 줄로 입력해 주세요.");
        }
        var content = text(input.content(), "내용");
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS); // MySQL DATETIME 반올림 대비
        if (repository.countSince(userId, now.minus(Duration.ofDays(1))) >= DAILY_MAX) {
            throw new ApiException(429, "문의는 하루에 " + DAILY_MAX + "개까지 남길 수 있어요. 내일 다시 시도해 주세요.");
        }
        long id = repository.insert(userId, input.category(), title, content, now);
        return inquiry(repository.find(id).orElseThrow());
    }

    @Transactional
    public Map<String, Object> answer(long adminId, String inquiryId, AnswerInput input) {
        if (inquiryId == null || !ID.matcher(inquiryId).matches()) throw notFound();
        long id = Long.parseLong(inquiryId);
        var content = text(input == null ? null : input.content(), "답변");
        if (repository.answer(id, adminId, content, clock.instant().truncatedTo(ChronoUnit.SECONDS)) == 0) {
            repository.find(id).orElseThrow(SupportService::notFound);
            throw new ApiException(409, "이미 답변이 등록된 문의예요.");
        }
        var answered = repository.find(id).orElseThrow();
        notifications.send(answered.userId(), adminId, NotificationService.SYSTEM, "문의에 답변이 등록됐어요",
            "「" + NotificationService.preview(answered.title(), 40) + "」", "support", id);
        return inquiry(answered);
    }

    /** 내용 · 답변: 앞뒤 공백을 빼고 1~3,000자, 줄바꿈 · 탭 말고 제어 문자는 안 됨 */
    private static String text(String value, String what) {
        var text = value == null ? "" : value.strip();
        if (text.isEmpty() || text.length() > CONTENT_MAX || CONTROL.matcher(text).find()) {
            throw new ApiException(400, what + "은(는) 1~3,000자로 입력해 주세요.");
        }
        return text;
    }

    private static ApiException notFound() {
        return new ApiException(404, "문의를 찾을 수 없어요.");
    }

    /** 응답 모양 (frontend/API.md 13장, 화면의 Inquiry) */
    private static Map<String, Object> inquiry(SupportRepository.InquiryRow q) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(q.id()));
        result.put("userId", Long.toString(q.userId()));
        result.put("nickname", q.nickname());
        result.put("category", q.category());
        result.put("title", q.title());
        result.put("content", q.content());
        result.put("createdAt", q.createdAt().toString());
        result.put("answer", q.answeredAt() == null ? null : Map.of("content", q.answer(), "createdAt", q.answeredAt().toString()));
        return result;
    }
}

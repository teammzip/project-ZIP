package com.zip.backend.notice;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.zip.backend.common.ApiException;
import com.zip.backend.notification.NotificationService;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공지사항 (frontend/API.md 14장). 누구나(로그인 회원) 목록 · 내용을 보고, 관리자만 쓰고 · 고치고 · 지워요.
 * 쓸 때 notify=true 면 알림을 켠 일반 회원 모두에게 알림(SYSTEM, link "notice")을 보내요.
 */
@Service
public class NoticeService {
    static final int TITLE_MAX = 100, BODY_MAX = 5000, LIST_MAX = 100, POPUP_MAX = 5;
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");

    private final NoticeRepository repository;
    private final Clock clock;

    public NoticeService(NoticeRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** popup: 앱을 열면 팝업으로, notify: true 면 회원들에게 알림도 보냄 */
    public record NoticeInput(String title, String body, Boolean pinned, Boolean popup, @JsonProperty("notify") Boolean sendAlert) {}

    public List<NoticeResponse> list() {
        return repository.list(LIST_MAX).stream().map(n -> notice(n, false)).toList();
    }

    /** 앱을 열면 띄울 팝업 공지 (내용 포함, 새 것부터 최대 5개). 안 보기 · 닫기는 화면이 브라우저에 기억해요 */
    public List<NoticeResponse> popups() {
        return repository.popups(POPUP_MAX).stream().map(n -> notice(n, true)).toList();
    }

    public NoticeResponse get(String id) {
        return notice(repository.find(id(id)).orElseThrow(NoticeService::notFound), true);
    }

    @Transactional
    public NoticeResponse create(long adminId, NoticeInput input) {
        var valid = valid(input);
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS); // MySQL DATETIME 반올림 대비
        long id = repository.insert(adminId, valid.title(), valid.body(), valid.pinned(), valid.popup(), now);
        if (Boolean.TRUE.equals(input.sendAlert())) {
            repository.notifyAll(id, "새 공지: " + NotificationService.preview(valid.title(), 90), NotificationService.preview(valid.body(), 80), now);
        }
        return get(Long.toString(id));
    }

    @Transactional
    public NoticeResponse update(String id, NoticeInput input) {
        long noticeId = id(id);
        var valid = valid(input);
        if (repository.update(noticeId, valid.title(), valid.body(), valid.pinned(), valid.popup(), clock.instant().truncatedTo(ChronoUnit.SECONDS)) == 0) throw notFound();
        return get(id);
    }

    @Transactional
    public void delete(String id) {
        if (repository.delete(id(id)) == 0) throw notFound();
    }

    private record Valid(String title, String body, boolean pinned, boolean popup) {}

    private static Valid valid(NoticeInput input) {
        if (input == null) throw new ApiException(400, "공지 내용을 보내 주세요.");
        var title = input.title() == null ? "" : input.title().strip();
        var body = input.body() == null ? "" : input.body().strip();
        if (title.isEmpty()) throw new ApiException(400, "제목을 입력해 주세요.");
        if (title.length() > TITLE_MAX) throw new ApiException(400, "제목은 " + TITLE_MAX + "자까지 쓸 수 있어요.");
        if (body.isEmpty()) throw new ApiException(400, "내용을 입력해 주세요.");
        if (body.length() > BODY_MAX) throw new ApiException(400, "내용은 " + String.format("%,d", BODY_MAX) + "자까지 쓸 수 있어요.");
        return new Valid(title, body, Boolean.TRUE.equals(input.pinned()), Boolean.TRUE.equals(input.popup()));
    }

    private static NoticeResponse notice(NoticeRepository.NoticeRow n, boolean withBody) {
        return new NoticeResponse(
            Long.toString(n.id()),
            n.title(),
            withBody ? n.body() : null,
            n.pinned(),
            n.popup(),
            n.author() == null ? "운영자" : n.author(),
            n.createdAt().toString(),
            n.updatedAt().toString()
        );
    }

    private static long id(String value) {
        if (value == null || !ID.matcher(value).matches()) throw notFound();
        return Long.parseLong(value);
    }

    private static ApiException notFound() { return new ApiException(404, "공지를 찾을 수 없어요."); }
}

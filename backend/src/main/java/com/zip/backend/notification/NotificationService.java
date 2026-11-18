package com.zip.backend.notification;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 알림 (frontend/API.md 6장). 서버가 아는 일이 생기면 받는 사람에게 한 줄을 만들어요:
 * 내 글 댓글 · 내 댓글 답글 · 운영자 댓글 · 운영자가 지우거나 숨긴 글 · 댓글 · 경고 · 문의 답변.
 * 일정 · 쓰레기 배출 · 월세 알림은 아직 프론트가 직접 계산해요 (일정이 서버에 없어서).
 */
@Service
public class NotificationService {
    /** 알림 화면에 보일 최대 개수 */
    static final int LIST_MAX = 100;
    static final int IDS_MAX = 200;
    private static final Set<String> STATUSES = Set.of("all", "unread", "read");
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");

    /** 알림 종류 (notifications.noti_type) */
    public static final String COMMUNITY = "COMMUNITY";
    public static final String SYSTEM = "SYSTEM";

    private final NotificationRepository repository;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public record ReadInput(List<String> ids) {}

    public Map<String, Object> list(long userId, String status) {
        var filter = status == null || status.isBlank() ? "all" : status;
        if (!STATUSES.contains(filter)) throw new ApiException(400, "status 는 all, unread, read 중 하나예요.");
        var now = clock.instant();
        var read = filter.equals("all") ? null : filter.equals("read");
        var items = repository.list(userId, read, now, LIST_MAX).stream().map(NotificationService::noti).toList();
        return Map.of("items", items, "unreadCount", repository.unreadCount(userId, now));
    }

    /** 읽음: ids 가 비면 전부 */
    @Transactional
    public void markRead(long userId, ReadInput input) {
        repository.markRead(userId, ids(input == null ? null : input.ids(), true), clock.instant());
    }

    /** 읽은 알림 지우기 (DELETE ?ids=1,2) */
    @Transactional
    public void deleteRead(long userId, String ids) {
        var list = ids == null || ids.isBlank() ? List.<String>of() : List.of(ids.split(",", -1));
        repository.deleteRead(userId, ids(list, false), clock.instant());
    }

    /**
     * 알림 하나 만들기 (다른 기능이 불러요). 받는 사람 = 한 사람이면 만들지 않고, 받는 사람이 알림을 껐으면 만들지 않아요.
     * link: 눌렀을 때 열 화면(community · support), refId: 글 · 문의 번호
     */
    public void send(long userId, Long actorId, String type, String title, String body, String link, Long refId) {
        if (actorId != null && actorId == userId) return;
        if (!repository.wantsNotifications(userId)) return;
        repository.insert(userId, type, cut(title, 100), body == null ? null : cut(body, 200), link, refId,
            clock.instant().truncatedTo(ChronoUnit.SECONDS)); // MySQL DATETIME 반올림 대비 (미래 알림처럼 안 보이게)
    }

    /** 글 · 댓글 미리보기용으로 줄바꿈을 빼고 짧게 */
    public static String preview(String text, int max) {
        if (text == null) return "";
        var line = text.replaceAll("\\s+", " ").strip();
        return line.length() <= max ? line : line.substring(0, max - 1) + "…";
    }

    private static List<Long> ids(List<String> raw, boolean emptyMeansAll) {
        if (raw == null || raw.isEmpty()) {
            if (emptyMeansAll) return List.of();
            throw new ApiException(400, "지울 알림을 골라 주세요.");
        }
        if (raw.size() > IDS_MAX) throw new ApiException(400, "한 번에 " + IDS_MAX + "개까지 보낼 수 있어요.");
        var parsed = new ArrayList<Long>();
        for (var value : raw) {
            var v = value == null ? "" : value.strip();
            if (!ID.matcher(v).matches()) throw new ApiException(400, "알림 번호를 확인해 주세요.");
            parsed.add(Long.parseLong(v));
        }
        return parsed;
    }

    private static String cut(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static Map<String, Object> noti(NotificationRepository.NotiRow n) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(n.id()));
        result.put("type", n.type());
        result.put("title", n.title());
        result.put("body", n.body());
        result.put("link", n.link());
        result.put("refId", n.refId() == null ? null : Long.toString(n.refId()));
        result.put("notifyAt", n.notifyAt().toString());
        result.put("read", n.read());
        return result;
    }
}

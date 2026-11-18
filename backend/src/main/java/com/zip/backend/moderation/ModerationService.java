package com.zip.backend.moderation;

import com.zip.backend.common.ApiException;
import com.zip.backend.notification.NotificationService;
import java.time.Clock;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 관리 · 경고 · 정지 (frontend/API.md 11장). 관리자 API 는 보안 설정에서 ADMIN 만 통과해요.
 * 경고 = WARNING(기록만), 1 · 3 · 5 · 10일 정지 = SUSPEND, 영구 정지 = BAN. 정지를 걸면 users.status = SUSPENDED 이고
 * 정지 중인 회원은 로그인 · 모든 요청이 403 이에요(AuthRepository.suspended). 해제 · 만료돼도 횟수와 이력은 남아요.
 */
@Service
public class ModerationService {
    static final int PAGE_SIZE = 50;
    static final int BULK_MAX = 100;
    private static final Set<Integer> SUSPEND_DAYS = Set.of(1, 3, 5, 10);
    private static final Set<String> SORTS = Set.of("activity", "bans", "warns", "joined");
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");

    private final ModerationRepository repository;
    private final NotificationService notifications;
    private final Clock clock;

    public ModerationService(ModerationRepository repository, NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.notifications = notifications;
        this.clock = clock;
    }

    public Map<String, Object> stats() {
        var s = repository.stats(clock.instant());
        return Map.of("members", s[0], "suspended", s[1], "totalBans", s[2], "totalWarns", s[3], "posts", s[4], "comments", s[5]);
    }

    public Map<String, Object> members(String q, String status, Integer minBans, Integer minWarns, String sort, int page) {
        var keyword = q == null || q.isBlank() ? null : q.trim();
        if (keyword != null && keyword.length() > 30) throw new ApiException(400, "검색어는 30자 이내로 입력해 주세요.");
        var state = status == null || status.isBlank() ? null : status;
        if (state != null && !Set.of("ACTIVE", "SUSPENDED").contains(state)) throw new ApiException(400, "status 는 ACTIVE 또는 SUSPENDED 예요.");
        var order = sort == null || sort.isBlank() ? "activity" : sort;
        if (!SORTS.contains(order)) throw new ApiException(400, "sort 는 activity, bans, warns, joined 중 하나예요.");
        int bans = minBans == null ? 0 : minBans, warns = minWarns == null ? 0 : minWarns;
        if (bans < 0 || warns < 0 || bans > 1000 || warns > 1000 || page < 0 || page > 10_000) throw new ApiException(400, "조건을 확인해 주세요.");
        var rows = repository.members(clock.instant(), keyword, state, bans, warns, order, PAGE_SIZE + 1, page * PAGE_SIZE);
        return Map.of("items", rows.stream().limit(PAGE_SIZE).map(ModerationService::member).toList(), "hasNext", rows.size() > PAGE_SIZE);
    }

    public List<Map<String, Object>> sanctions(String memberId) {
        long id = memberId(memberId);
        repository.role(id).orElseThrow(() -> new ApiException(404, "회원을 찾을 수 없어요."));
        return repository.sanctions(id).stream().map(s -> {
            var result = new LinkedHashMap<String, Object>();
            result.put("id", Long.toString(s.id()));
            result.put("type", s.type());
            result.put("days", days(s));
            result.put("reason", s.reason() == null ? "" : s.reason());
            result.put("startsAt", s.startsAt().toString());
            result.put("endsAt", s.endsAt() == null ? null : s.endsAt().toString());
            result.put("revokedAt", s.revokedAt() == null ? null : s.revokedAt().toString());
            result.put("revokeReason", s.revokeReason());
            result.put("by", s.byNickname());
            return (Map<String, Object>) result;
        }).toList();
    }

    /** 경고 · 정지 걸기 → 바뀐 회원 */
    @Transactional
    public Map<String, Object> sanction(long adminId, String memberId, SanctionInput input) {
        long id = memberId(memberId);
        apply(adminId, id, valid(input));
        return member(repository.member(id, clock.instant()).orElseThrow());
    }

    /** 여러 명 한꺼번에 (하나라도 안 되면 아무것도 안 걸림) */
    @Transactional
    public void bulk(long adminId, BulkInput input) {
        if (input == null || input.memberIds() == null || input.memberIds().isEmpty()) throw new ApiException(400, "회원을 골라 주세요.");
        if (input.memberIds().size() > BULK_MAX) throw new ApiException(400, "한 번에 " + BULK_MAX + "명까지 조치할 수 있어요.");
        var valid = valid(new SanctionInput(input.type(), input.days(), input.reason()));
        var ids = new LinkedHashSet<Long>();
        for (var value : input.memberIds()) ids.add(memberId(value));
        for (long id : ids) apply(adminId, id, valid);
    }

    /** 정지 해제 (기록 · 횟수는 남기고 해제 시각 · 사유만) → 바뀐 회원 */
    @Transactional
    public Map<String, Object> unban(long adminId, String memberId, String reason) {
        long id = memberId(memberId);
        repository.role(id).orElseThrow(() -> new ApiException(404, "회원을 찾을 수 없어요."));
        repository.lockUser(id);
        var why = reason == null || reason.isBlank() ? null : reason.strip();
        if (why != null && (why.length() > 200 || CONTROL.matcher(why).find())) throw new ApiException(400, "해제 사유는 200자 이내로 입력해 주세요.");
        var now = clock.instant();
        if (repository.revokeActive(id, adminId, why, now) == 0) throw new ApiException(400, "지금 정지 중인 회원이 아니에요.");
        repository.setStatus(id, "ACTIVE");
        return member(repository.member(id, now).orElseThrow());
    }

    /** 내가 받은 경고 · 정지 (내 정보의 내역 창). 처리한 운영자 · 해제 사유는 빼요 */
    public List<Map<String, Object>> mySanctions(long userId) {
        return repository.sanctions(userId).stream().map(s -> {
            var result = new LinkedHashMap<String, Object>();
            result.put("id", Long.toString(s.id()));
            result.put("type", s.type());
            result.put("days", days(s));
            result.put("reason", s.reason() == null ? "" : s.reason());
            result.put("at", s.startsAt().toString());
            result.put("revoked", s.revokedAt() != null);
            return (Map<String, Object>) result;
        }).toList();
    }

    /** 내 경고 확인 (경고 안내 창의 "확인했어요") */
    @Transactional
    public void markWarningsSeen(long userId, List<String> ids) {
        if (ids == null || ids.isEmpty()) return;
        if (ids.size() > 100) throw new ApiException(400, "한 번에 100개까지 보낼 수 있어요.");
        var parsed = new ArrayList<Long>();
        for (var value : ids) {
            if (value == null || !ID.matcher(value).matches()) throw new ApiException(400, "경고 번호를 확인해 주세요.");
            parsed.add(Long.parseLong(value));
        }
        repository.markWarningsSeen(userId, parsed, clock.instant());
    }

    public record SanctionInput(String type, Integer days, String reason) {}
    public record BulkInput(List<String> memberIds, String type, Integer days, String reason) {}
    private record Valid(String type, Integer days, String reason) {}

    private static Valid valid(SanctionInput input) {
        if (input == null || input.type() == null) throw new ApiException(400, "조치 종류(type)를 골라 주세요.");
        var type = input.type();
        if (!Set.of("WARNING", "SUSPEND", "BAN").contains(type)) throw new ApiException(400, "type 은 WARNING, SUSPEND, BAN 중 하나예요.");
        if (type.equals("SUSPEND") && (input.days() == null || !SUSPEND_DAYS.contains(input.days()))) {
            throw new ApiException(400, "정지 기간은 1 · 3 · 5 · 10일 중 하나예요.");
        }
        var reason = input.reason() == null ? "" : input.reason().strip();
        if (reason.isEmpty() || reason.length() > 200 || CONTROL.matcher(reason).find()) throw new ApiException(400, "사유는 200자 이내로 입력해 주세요.");
        return new Valid(type, type.equals("SUSPEND") ? input.days() : null, reason);
    }

    private void apply(long adminId, long userId, Valid valid) {
        var role = repository.role(userId).orElseThrow(() -> new ApiException(404, "회원을 찾을 수 없어요."));
        if ("ADMIN".equals(role) || userId == adminId) throw new ApiException(400, "관리자에게는 조치를 걸 수 없어요.");
        repository.lockUser(userId);
        // MySQL DATETIME 은 초 아래를 반올림해서, 그대로 넣으면 시작 시각이 최대 0.5초 미래가 돼 "아직 정지 전"으로 보임 → 초 단위로 내림
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        var ends = valid.days() == null ? null : now.plus(Duration.ofDays(valid.days()));
        repository.insertSanction(userId, valid.type(), valid.reason(), now, ends, adminId);
        if (!valid.type().equals("WARNING")) repository.setStatus(userId, "SUSPENDED");
        // 경고는 알림에도 남김 (정지는 로그인 자체가 막히고 로그인 화면에서 안내)
        else notifications.send(userId, adminId, NotificationService.SYSTEM, "운영 정책 경고를 받았어요", "사유: " + valid.reason(), null, null);
    }

    /** 기간 정지의 날 수 (경고 · 영구 정지는 null) */
    private static Long days(ModerationRepository.SanctionRow s) {
        return s.type().equals("SUSPEND") && s.endsAt() != null
            ? Math.max(1, Math.round(Duration.between(s.startsAt(), s.endsAt()).toHours() / 24.0)) : null;
    }

    private static long memberId(String value) {
        if (value == null || !ID.matcher(value).matches()) throw new ApiException(404, "회원을 찾을 수 없어요.");
        return Long.parseLong(value);
    }

    private static Map<String, Object> member(ModerationRepository.MemberRow m) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(m.id()));
        result.put("nickname", m.nickname());
        result.put("username", m.username());
        result.put("provider", m.provider()); // 가입 방식. 소셜 가입(아이디 없음)이면 화면이 "카카오 로그인" 등으로 표시한다.
        result.put("joinedAt", m.joinedAt() == null ? null : m.joinedAt().toString().substring(0, 10));
        result.put("posts", m.posts());
        result.put("comments", m.comments());
        result.put("warns", m.warns());
        result.put("bans", m.bans());
        result.put("status", m.suspended() ? "SUSPENDED" : "ACTIVE");
        result.put("until", m.until() == null ? null : m.until().toString());
        result.put("permanent", m.permanent());
        return result;
    }
}

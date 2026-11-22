package com.zip.backend.notification;

import com.zip.backend.common.Sql;
import java.math.BigDecimal;
import java.sql.Time;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 생활 알림 (일정 · 월세). 알림 목록을 볼 때 그 회원의 앞으로 며칠 치를 만들어 둬요 (frontend/API.md 6장).
 * <ul>
 *   <li>일정: 오늘 ~ 3일 뒤 일정(완료한 것 빼고, 기념일 · 매년 반복 포함). 3일 전 오전 9시부터 보여요</li>
 *   <li>월세: 월세 계약(또는 계약 정보 없음) + 월세가 있으면 납부일 3일 전 오전 9시</li>
 * </ul>
 * 쓰레기 배출 알림은 TrashReminderService 가 배출일 아침 7시에 따로 만들어요 (여기서는 건드리지 않음).
 * 한 번 만든 알림은 (종류, 관련 번호, link) 로 알아봐서 다시 만들지 않아요 — 읽거나 지운 알림도 되살아나지 않아요.
 * link 는 눌렀을 때 열 화면 + 날짜 ("calendar:2026-11-24", "budget:2026-11-25") 예요.
 * 일정을 지우거나 · 완료하거나 · 날짜를 바꾸면, 아직 안 읽은 그 알림은 지우고(또는 제목 · 내용을 고치고) 새 날짜로 다시 만들어요.
 */
@Service
public class LifeNotificationService {
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    /** 며칠 앞까지 알려 줄지 */
    static final int AHEAD_DAYS = 3;
    static final LocalTime NOTIFY_AT = LocalTime.of(9, 0);
    static final String EVENT = "EVENT", RENT = "RENT";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN);

    private final JdbcTemplate jdbc;
    private final NotificationRepository notifications;
    private final Clock clock;

    public LifeNotificationService(JdbcTemplate jdbc, NotificationRepository notifications, Clock clock) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** 만들어 둘 알림 한 줄. key = 종류 · 관련 번호 · link */
    record Want(String type, Long refId, String link, String title, String body, Instant notifyAt) {
        String key() { return key(type, refId, link); }
        static String key(String type, Long refId, String link) { return type + "|" + refId + "|" + link; }
    }

    /** 알림 목록을 보기 전에 불러요. 같은 회원의 동시 요청은 한 줄로 세워서 두 번 만들지 않아요 */
    @Transactional
    public void sync(long userId) {
        jdbc.queryForList(Sql.LOCK_USER, Long.class, userId);
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS); // MySQL DATETIME 반올림 대비
        var today = LocalDate.ofInstant(now, ZONE);
        var wanted = new LinkedHashMap<String, Want>();
        if (notifications.wantsNotifications(userId)) {
            for (var w : events(userId, today, now)) wanted.putIfAbsent(w.key(), w);
            for (var w : rent(userId, today, now)) wanted.putIfAbsent(w.key(), w);
        }

        var existing = notifications.lifeRows(userId, List.of(EVENT, RENT));
        var have = new HashSet<String>();
        var stale = new ArrayList<Long>();
        for (var row : existing) {
            var key = Want.key(row.type(), row.refId(), row.link());
            have.add(key);
            if (row.read() || row.deleted()) continue; // 읽거나 지운 알림은 그대로 둠
            var want = wanted.get(key);
            if (want == null) {
                // 아직 지나지 않은 알림인데 더는 해당 없음 (일정 삭제 · 완료 · 날짜 변경, 월세 변경, 알림 끔)
                var on = dayOf(row.link());
                if (on != null && !on.isBefore(today)) stale.add(row.id());
            } else if (!Objects.equals(want.title(), row.title()) || !Objects.equals(want.body(), row.body())) {
                notifications.updateText(row.id(), want.title(), want.body());
            }
        }
        notifications.deleteIds(userId, stale);
        for (var w : wanted.values()) {
            if (!have.contains(w.key())) notifications.insertAt(userId, w.type(), w.title(), w.body(), w.link(), w.refId(), w.notifyAt(), now);
        }
    }

    /** 일정: 오늘 ~ 3일 뒤 (매년 반복 기념일은 올해 · 내년 날짜로) */
    private List<Want> events(long userId, LocalDate today, Instant now) {
        var end = today.plusDays(AHEAD_DAYS);
        var out = new ArrayList<Want>();
        jdbc.query("""
            SELECT id, title, event_date, event_time, is_done, is_anniversary, repeat_yearly FROM events
            WHERE user_id = ? AND ((event_date BETWEEN ? AND ?) OR (is_anniversary = TRUE AND repeat_yearly = TRUE))
            """, rs -> {
            var date = rs.getDate("event_date").toLocalDate();
            boolean anniv = rs.getBoolean("is_anniversary"), yearly = rs.getBoolean("repeat_yearly");
            if (!anniv && rs.getBoolean("is_done")) return;
            Time time = rs.getTime("event_time");
            var dates = yearly ? List.of(yearDate(date, today.getYear()), yearDate(date, today.getYear() + 1)) : List.of(date);
            for (var on : dates) {
                if (on.isBefore(today) || on.isAfter(end) || on.isBefore(date)) continue;
                var when = anniv ? "기념일" : time == null ? "종일" : time.toLocalTime().toString().substring(0, 5);
                out.add(new Want(EVENT, rs.getLong("id"), "calendar:" + on, rs.getString("title"), DAY.format(on) + " · " + when, notifyAt(on.minusDays(AHEAD_DAYS), now)));
            }
        }, userId, java.sql.Date.valueOf(today), java.sql.Date.valueOf(end));
        return out;
    }

    /** 월세: 납부일이 오늘 ~ 3일 뒤면 (납부일 3일 전 오전 9시). 전세 계약이면 없음 */
    private List<Want> rent(long userId, LocalDate today, Instant now) {
        var settings = jdbc.queryForList("SELECT rent_amount, rent_day FROM user_settings WHERE user_id = ?", userId);
        if (settings.isEmpty()) return List.of();
        var amount = (BigDecimal) settings.get(0).get("rent_amount");
        int day = ((Number) settings.get(0).get("rent_day")).intValue();
        if (amount == null || amount.signum() <= 0 || day < 1) return List.of();
        // 월세가 있을 때만 계약 유형을 봄 (계약 정보가 없으면 월세로 봐요 — 화면과 같음)
        var kind = jdbc.queryForList("SELECT contract_kind FROM home_contracts WHERE user_id = ?", String.class, userId);
        if (!kind.isEmpty() && !"monthly".equals(kind.get(0))) return List.of();
        var out = new ArrayList<Want>();
        var end = today.plusDays(AHEAD_DAYS);
        for (var month = YearMonth.from(today); !month.atDay(1).isAfter(end); month = month.plusMonths(1)) {
            var on = month.atDay(Math.min(day, month.lengthOfMonth()));
            if (on.isBefore(today) || on.isAfter(end)) continue;
            var won = amount.stripTrailingZeros().toPlainString();
            out.add(new Want(RENT, null, "budget:" + on, on.equals(today) ? "오늘은 월세 납부일이에요" : "월세 납부일이 다가와요",
                DAY.format(on) + " · " + won + "만원", notifyAt(on.minusDays(AHEAD_DAYS), now)));
        }
        return out;
    }

    /** 그날 오전 9시 (이미 지났으면 지금) */
    private static Instant notifyAt(LocalDate day, Instant now) {
        var at = day.atTime(NOTIFY_AT).atZone(ZONE).toInstant();
        return at.isBefore(now) ? now : at;
    }

    /** 2월 29일 기념일은 평년엔 2월 28일 (화면과 같음) */
    private static LocalDate yearDate(LocalDate base, int year) {
        return base.getMonthValue() == 2 && base.getDayOfMonth() == 29 && !java.time.Year.isLeap(year) ? LocalDate.of(year, 2, 28) : base.withYear(year);
    }

    /** "calendar:2026-11-24" → 2026-11-24 */
    private static LocalDate dayOf(String link) {
        if (link == null) return null;
        int i = link.indexOf(':');
        try { return i < 0 ? null : LocalDate.parse(link.substring(i + 1)); } catch (RuntimeException e) { return null; }
    }
}

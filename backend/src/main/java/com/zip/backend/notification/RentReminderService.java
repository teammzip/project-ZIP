package com.zip.backend.notification;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillRepository;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 월별 가계부의 미납 월세에 대해 납부 3일 전부터 당일까지 알림을 한 번 저장한다. */
@Service
public class RentReminderService {
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private static final int DAYS_BEFORE = 3;

    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final BillRepository bills;
    private final NotificationRepository notifications;

    public RentReminderService(JdbcTemplate jdbc, AuthRepository auth, BillRepository bills, NotificationRepository notifications) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.bills = bills;
        this.notifications = notifications;
    }

    record Candidate(long user, YearMonth month) {}
    private record ScheduledRent(Candidate candidate, LocalDate dueDate, String zone) {}

    List<Candidate> candidates(Instant now) {
        var utcDate = LocalDate.ofInstant(now, ZoneOffset.UTC);
        // UTC 날짜 앞뒤 하루를 포함해 후보를 좁힌 뒤 실제 납부 시간대로 확인한다.
        return jdbc.query("""
            SELECT r.user_id, r.period_ym, r.due_date, c.billing_time_zone FROM rent_payments r
            JOIN home_contracts c ON c.user_id = r.user_id AND c.contract_kind = 'monthly'
            JOIN user_settings s ON s.user_id = r.user_id AND s.noti_on = TRUE
            WHERE r.paid_at IS NULL AND r.amount > 0 AND r.due_date BETWEEN ? AND ?
              AND (s.move_in_ym IS NULL OR r.period_ym >= s.move_in_ym)
              AND (s.contract_end_ym IS NULL OR r.period_ym <= s.contract_end_ym)
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = r.user_id AND n.noti_type = 'RENT'
                  AND
            """ + NotificationRepository.RENT_PERIOD_MATCH + ")", (rs, row) -> new ScheduledRent(
                new Candidate(rs.getLong("user_id"), YearMonth.parse(rs.getString("period_ym"))),
                rs.getDate("due_date").toLocalDate(), rs.getString("billing_time_zone")),
            Date.valueOf(utcDate.minusDays(1)), Date.valueOf(utcDate.plusDays(DAYS_BEFORE + 1))).stream()
            .filter(rent -> inWindow(rent.candidate().month(), rent.dueDate(), rent.zone(), now))
            .map(ScheduledRent::candidate).toList();
    }

    @Transactional
    public boolean sendDue(long user, YearMonth month, Instant now) {
        // 납부 완료, 계약 수정, 알림 설정 변경과 같은 회원 잠금을 사용한다.
        auth.lockUser(user);
        var home = bills.housing(user);
        if (home == null || !"monthly".equals(home.kind()) || !notifications.wantsNotifications(user)) return false;
        if ((home.moveIn() != null && month.toString().compareTo(home.moveIn()) < 0)
            || (home.end() != null && month.toString().compareTo(home.end()) > 0)) return false;

        var rent = bills.rent(user, month);
        if (rent == null || rent.paidAt() != null || rent.amount() <= 0 || rent.dueDate() == null
            || !inWindow(month, rent.dueDate(), bills.savedZone(user), now)) return false;

        long ref = month.getYear() * 100L + month.getMonthValue();
        if (notifications.hasRentReminder(user, month)) return false;
        var body = String.format(Locale.KOREA, "납부 기한 %s · %,d원", rent.dueDate(), rent.amount());
        notifications.insert(user, "RENT", "월세 납부 안내", body, "budget", ref, now.truncatedTo(ChronoUnit.SECONDS));
        return true;
    }

    private boolean inWindow(YearMonth month, LocalDate dueDate, String zone, Instant now) {
        var today = LocalDate.ofInstant(now, zone == null ? KOREA : ZoneId.of(zone));
        return month.equals(YearMonth.from(today)) && !dueDate.isBefore(today) && !dueDate.isAfter(today.plusDays(DAYS_BEFORE));
    }
}

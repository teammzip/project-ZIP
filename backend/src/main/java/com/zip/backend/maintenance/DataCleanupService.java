package com.zip.backend.maintenance;

import com.zip.backend.notification.TrashReminderService;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 계속 쌓이기만 하는 표를 정리한다 (DataCleanupScheduler 가 6시간마다 부름). 지워도 동작이 바뀌지 않는 행만 지운다.
 * <ul>
 *   <li>로그인 세션(auth_sessions): 만료됐거나 로그아웃한 지 하루 지난 것. 서버는 세션 행이 없으면 그 토큰을 무효로 봄</li>
 *   <li>이메일 인증(email_verifications): 요청한 지 하루 지난 것. 인증번호 3분 · 인증 완료 값 30분 · 요청 제한 1시간보다 김</li>
 *   <li>알림(notifications): 알릴 시각이 보관 기간(기본 90일) 지난 것. 일정 · 월세 · 쓰레기 알림의 중복 방지는 최근 날짜만 봄.
 *       단 쓰레기 "배출 정보가 없어요" 안내는 (회원, 동네)마다 한 번만 보내는 기록이라 지우지 않음 (지우면 다시 감)</li>
 * </ul>
 */
@Service
public class DataCleanupService {
    /** 만료 · 로그아웃 세션과 이메일 인증을 남겨 두는 기간 (여유를 두고 지움) */
    static final Duration GRACE = Duration.ofDays(1);

    private final JdbcTemplate jdbc;
    private final int notificationDays;

    public DataCleanupService(JdbcTemplate jdbc, @Value("${zip.cleanup.notification-days:90}") int notificationDays) {
        this.jdbc = jdbc;
        this.notificationDays = notificationDays;
    }

    /** 지운 행 수 (표마다) */
    public record Result(int sessions, int emailVerifications, int notifications) {
        public int total() { return sessions + emailVerifications + notifications; }
    }

    /** now 기준으로 정리. 여러 번 불러도 같음 (테스트는 시각을 직접 넘김) */
    public Result cleanup(Instant now) {
        var graceLimit = Timestamp.from(now.minus(GRACE));
        int sessions = jdbc.update("DELETE FROM auth_sessions WHERE expires_at < ? OR revoked_at < ?", graceLimit, graceLimit);
        int verifications = jdbc.update("DELETE FROM email_verifications WHERE requested_at < ?", graceLimit);
        int notifications = jdbc.update("""
            DELETE FROM notifications WHERE notify_at < ? AND NOT (noti_type = 'TRASH' AND title = ?)
            """, Timestamp.from(now.minus(Duration.ofDays(notificationDays))), TrashReminderService.NO_DATA_TITLE);
        return new Result(sessions, verifications, notifications);
    }
}

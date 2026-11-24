package com.zip.backend.maintenance;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.zip.backend.notification.TrashReminderService;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

/** 오래된 데이터 정리: 지울 것(하루 지난 만료 · 로그아웃 세션, 하루 지난 이메일 인증, 90일 지난 알림)만 지우고 나머지는 남김 */
@SpringBootTest
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class DataCleanupTests {
    @Autowired DataCleanupService service;
    @Autowired JdbcTemplate jdbc;

    private static final Instant NOW = Instant.parse("2026-11-24T03:00:00Z");
    private static Timestamp ago(Duration duration) { return Timestamp.from(NOW.minus(duration)); }
    private static Timestamp later(Duration duration) { return Timestamp.from(NOW.plus(duration)); }

    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'clean01', 'x', '정리')");
        // 세션: 이틀 전 만료(지움) · 이틀 전 로그아웃(지움) · 1시간 전 만료(아직 남김) · 유효(남김)
        jdbc.update("INSERT INTO auth_sessions (user_id, refresh_token_hash, created_at, expires_at, revoked_at) VALUES (1, 'a', ?, ?, NULL)", ago(Duration.ofDays(9)), ago(Duration.ofDays(2)));
        jdbc.update("INSERT INTO auth_sessions (user_id, refresh_token_hash, created_at, expires_at, revoked_at) VALUES (1, 'b', ?, ?, ?)", ago(Duration.ofDays(3)), later(Duration.ofDays(4)), ago(Duration.ofDays(2)));
        jdbc.update("INSERT INTO auth_sessions (user_id, refresh_token_hash, created_at, expires_at, revoked_at) VALUES (1, 'c', ?, ?, NULL)", ago(Duration.ofHours(13)), ago(Duration.ofHours(1)));
        jdbc.update("INSERT INTO auth_sessions (user_id, refresh_token_hash, created_at, expires_at, revoked_at) VALUES (1, 'd', ?, ?, NULL)", ago(Duration.ofHours(1)), later(Duration.ofDays(7)));
        // 이메일 인증: 이틀 전 요청(지움) · 1시간 전 요청(남김 — 1시간 요청 제한에 쓰임)
        jdbc.update("INSERT INTO email_verifications (purpose, email, code_hash, requested_at, expires_at) VALUES ('SIGNUP', 'old@zip.com', 'h1', ?, ?)", ago(Duration.ofDays(2)), ago(Duration.ofDays(2)));
        jdbc.update("INSERT INTO email_verifications (purpose, email, code_hash, requested_at, expires_at) VALUES ('SIGNUP', 'new@zip.com', 'h2', ?, ?)", ago(Duration.ofHours(1)), ago(Duration.ofMinutes(57)));
        // 알림: 100일 전 댓글 알림(지움) · 100일 전 "배출 정보 없음" 안내(남김 — 한 번만 보내는 기록) · 10일 전(남김)
        jdbc.update("INSERT INTO notifications (user_id, noti_type, title, notify_at) VALUES (1, 'COMMUNITY', '오래된 댓글', ?)", ago(Duration.ofDays(100)));
        jdbc.update("INSERT INTO notifications (user_id, noti_type, title, ref_id, notify_at) VALUES (1, 'TRASH', ?, 3, ?)", TrashReminderService.NO_DATA_TITLE, ago(Duration.ofDays(100)));
        jdbc.update("INSERT INTO notifications (user_id, noti_type, title, notify_at) VALUES (1, 'TRASH', '오늘은 쓰레기 배출일이에요', ?)", ago(Duration.ofDays(10)));
    }

    @Test void removesOnlyStaleRowsAndIsRepeatable() {
        var result = service.cleanup(NOW);
        assertEquals(2, result.sessions());
        assertEquals(1, result.emailVerifications());
        assertEquals(1, result.notifications());
        assertEquals(List.of("c", "d"), jdbc.queryForList("SELECT refresh_token_hash FROM auth_sessions ORDER BY refresh_token_hash", String.class));
        assertEquals(List.of("new@zip.com"), jdbc.queryForList("SELECT email FROM email_verifications", String.class));
        assertEquals(List.of(TrashReminderService.NO_DATA_TITLE, "오늘은 쓰레기 배출일이에요"),
            jdbc.queryForList("SELECT title FROM notifications ORDER BY id", String.class));
        // 다시 돌려도 더 지울 것이 없음
        assertEquals(0, service.cleanup(NOW).total());
    }
}

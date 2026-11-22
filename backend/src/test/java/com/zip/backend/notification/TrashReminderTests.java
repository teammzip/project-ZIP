package com.zip.backend.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

/** 쓰레기 배출일 0시(자정) 알림: 집 주소 → 동네 → 오늘 배출표가 있으면 하루 한 번, 전날 밤 · 배출 없는 날 · 알림 끔 · 주소로 동네를 못 찾으면 없음 */
@SpringBootTest
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class TrashReminderTests {
    @Autowired TrashReminderService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.zip.backend.auth.AuthRepository auth;

    /** 2026-11-23 은 월요일 (한국 시간) */
    private static java.time.Instant seoul(String dateTime) {
        return LocalDateTime.parse(dateTime).atZone(TrashReminderService.ZONE).toInstant();
    }

    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'mapo01', 'x', '마포주민'), (2, 'busan01', 'x', '부산주민'), (3, 'mapo02', 'x', '알림끔')");
        jdbc.update("INSERT INTO user_settings (user_id, noti_on, home_address) VALUES (1, TRUE, '서울특별시 마포구 월드컵북로 396 101호'), (2, TRUE, '부산 어딘가'), (3, FALSE, '서울 마포구 합정동')");
        // 마포구: 월요일 생활쓰레기 · 음식물 18:00, 수요일 재활용 20:00 (한 장소)
        jdbc.update("""
            INSERT INTO trash_schedules (region_id, place, general_days, general_time, food_days, food_time, recycle_days, recycle_time) VALUES
              (2, '내 집 앞', '월', '18:00:00', '월', '18:00:00', '수', '20:00:00')""");
    }

    private List<String> bodies(long userId) {
        return jdbc.queryForList("SELECT body FROM notifications WHERE user_id = ? AND noti_type = 'TRASH' ORDER BY id", String.class, userId);
    }

    @Test void sendsOnceAtMidnightOnTrashDay() {
        assertEquals(0, service.sendDue(seoul("2026-11-22T23:59:00"))); // 전날(일요일) 밤: 아직 월요일 알림 아님
        assertEquals(1, service.sendDue(seoul("2026-11-23T00:00:00"))); // 월요일 0시
        assertEquals(0, service.sendDue(seoul("2026-11-23T00:01:00"))); // 같은 날 두 번 안 만듦
        assertEquals(List.of("생활쓰레기 · 음식물 · 18:00부터 · 내 집 앞"), bodies(1));
        assertEquals(TrashReminderService.TITLE, jdbc.queryForObject("SELECT title FROM notifications WHERE user_id = 1", String.class));
        assertEquals(LocalDateTime.parse("2026-11-23T00:00:00"),
            jdbc.queryForObject("SELECT notify_at FROM notifications WHERE user_id = 1", java.sql.Timestamp.class).toInstant().atZone(TrashReminderService.ZONE).toLocalDateTime());
        // 동네를 못 찾는 주소 · 알림을 끈 회원은 없음
        assertEquals(List.of(), bodies(2));
        assertEquals(List.of(), bodies(3));
    }

    @Test void noTrashDayNoReminderAndLateStartStillUsesMidnight() {
        assertEquals(0, service.sendDue(seoul("2026-11-24T08:00:00"))); // 화요일: 배출 없음
        assertEquals(1, service.sendDue(seoul("2026-11-25T09:30:00"))); // 수요일: 서버가 늦게 켜져도 그날 안에 (알릴 시각은 0시)
        assertEquals(List.of("재활용 · 20:00부터 · 내 집 앞"), bodies(1));
        assertEquals(LocalDateTime.parse("2026-11-25T00:00:00"),
            jdbc.queryForObject("SELECT notify_at FROM notifications WHERE user_id = 1", java.sql.Timestamp.class).toInstant().atZone(TrashReminderService.ZONE).toLocalDateTime());
    }

    @Test void addressRegisteredLaterTheSameDayStillGetsReminder() {
        jdbc.update("UPDATE user_settings SET home_address = NULL WHERE user_id = 1");
        assertEquals(0, service.sendDue(seoul("2026-11-23T00:00:00")));
        jdbc.update("UPDATE user_settings SET home_address = '서울 마포구 망원동' WHERE user_id = 1");
        assertEquals(1, service.sendDue(seoul("2026-11-23T10:00:00")));
    }

    @Test void reminderHourSettingStillDelaysUntilThatHour() {
        // zip.trash.reminder-hour 를 바꾸면(예: 7) 그 시각 전에는 안 만들고, 알릴 시각도 그 시각
        var seven = new TrashReminderService(jdbc, auth, 7);
        assertEquals(0, seven.sendDue(seoul("2026-11-23T06:59:00")));
        assertEquals(1, seven.sendDue(seoul("2026-11-23T07:00:00")));
        assertEquals(LocalDateTime.parse("2026-11-23T07:00:00"),
            jdbc.queryForObject("SELECT notify_at FROM notifications WHERE user_id = 1", java.sql.Timestamp.class).toInstant().atZone(TrashReminderService.ZONE).toLocalDateTime());
    }

    @Test void bodyShowsTimesPerTypeAndHidesMidnightAndManyPlaces() {
        var general = new TrashReminderService.TypeSummary("GENERAL", LocalTime.of(18, 0), 1, "집 앞");
        var recycleLate = new TrashReminderService.TypeSummary("RECYCLE", LocalTime.of(20, 0), 1, "집 앞");
        var foodMidnight = new TrashReminderService.TypeSummary("FOOD", LocalTime.MIDNIGHT, 1, "집 앞");
        var manyPlaces = new TrashReminderService.TypeSummary("GENERAL", LocalTime.of(18, 0), 840, "1급녹동자동차정비소");
        assertEquals("생활쓰레기 18:00 · 재활용 20:00부터 · 집 앞", TrashReminderService.body(List.of(general, recycleLate)));
        assertEquals("음식물 · 집 앞", TrashReminderService.body(List.of(foodMidnight)));
        assertEquals("생활쓰레기 · 18:00부터 · 배출장소는 사는 곳마다 달라요", TrashReminderService.body(List.of(manyPlaces)));
    }
}

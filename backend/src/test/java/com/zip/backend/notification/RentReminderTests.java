package com.zip.backend.notification;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

@SpringBootTest
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/home-info-fixture.sql"})
class RentReminderTests {
    private static final YearMonth MONTH = YearMonth.of(2027, 2);
    private static final Instant SEOUL_THREE_DAYS_BEFORE = Instant.parse("2027-02-24T15:00:00Z");

    @Autowired JdbcTemplate jdbc;
    @Autowired RentReminderService service;
    @Autowired NotificationRepository notifications;

    @BeforeEach void seed() {
        jdbc.update("INSERT INTO users(id,nickname) VALUES (1,'월세회원')");
        jdbc.update("""
            INSERT INTO user_settings(user_id,rent_amount,rent_day,move_in_ym,contract_end_ym)
            VALUES (1,55,31,'2027-01','2027-12')
            """);
        jdbc.update("INSERT INTO home_contracts(user_id,contract_kind) VALUES (1,'monthly')");
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2027-02',560003,'2027-02-28')");
    }

    @Test void usesSnapshotAndSavedBillingZone() {
        jdbc.update("UPDATE home_contracts SET billing_time_zone='America/Los_Angeles'");
        assertTrue(service.candidates(SEOUL_THREE_DAYS_BEFORE).isEmpty());
        assertFalse(service.sendDue(1, MONTH, SEOUL_THREE_DAYS_BEFORE));

        var now = Instant.parse("2027-02-25T08:00:00Z");
        assertEquals(List.of(new RentReminderService.Candidate(1, MONTH)), service.candidates(now));
        assertTrue(service.sendDue(1, MONTH, now));
        var saved = notifications.list(1, null, now, 10).get(0);
        assertEquals("RENT", saved.type());
        assertEquals("납부 기한 2027-02-28 · 560,003원", saved.body());
        assertEquals("budget", saved.link());
        assertEquals(202702L, saved.refId());
        assertTrue(service.candidates(now).isEmpty());
    }

    @Test void skipsPaidDisabledAndOutOfTermRows() {
        var now = SEOUL_THREE_DAYS_BEFORE;
        jdbc.update("UPDATE rent_payments SET paid_at='2027-02-24 06:00:00'");
        assertIneligible(now);
        jdbc.update("UPDATE rent_payments SET paid_at=NULL");
        jdbc.update("UPDATE user_settings SET noti_on=FALSE");
        assertIneligible(now);
        jdbc.update("UPDATE user_settings SET noti_on=TRUE, contract_end_ym='2027-01'");
        assertIneligible(now);
        jdbc.update("UPDATE user_settings SET contract_end_ym=NULL");
        jdbc.update("UPDATE home_contracts SET contract_kind='jeonse'");
        assertIneligible(now);
        jdbc.update("UPDATE home_contracts SET contract_kind='monthly'");
        assertIneligible(now.minusSeconds(1));
        assertIneligible(Instant.parse("2027-02-28T15:00:00Z"));
    }

    @Test void concurrentRunsAndDeletionKeepOneNotificationPerMonth() throws Exception {
        var now = Instant.parse("2027-02-28T03:00:00Z");
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> service.sendDue(1, MONTH, now));
            var second = executor.submit(() -> service.sendDue(1, MONTH, now));
            assertNotEquals(first.get(), second.get());
        } finally {
            executor.shutdownNow();
        }
        var first = notifications.list(1, null, now, 10).get(0);
        notifications.markRead(1, List.of(first.id()), now);
        notifications.deleteRead(1, List.of(first.id()), now);
        assertIneligible(now);
        assertTrue(notifications.list(1, null, now, 10).isEmpty());

        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,'2027-03',550000,'2027-03-01')");
        assertTrue(service.sendDue(1, MONTH.plusMonths(1), Instant.parse("2027-02-28T15:00:00Z")));
    }

    @Test void existingDevReminderCountsAgainstTheSameMonthEvenAfterDeletion() {
        var now = Instant.parse("2027-02-28T03:00:00Z");
        notifications.insert(1, "RENT", "기존 월세 알림", null, "budget:2027-02-27", null, now);
        assertIneligible(now);
        var old = notifications.list(1, null, now, 10).get(0);
        notifications.markRead(1, List.of(old.id()), now);
        notifications.deleteRead(1, List.of(old.id()), now);
        assertIneligible(now);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE noti_type='RENT'", Integer.class));
    }

    private void assertIneligible(Instant now) {
        assertTrue(service.candidates(now).isEmpty());
        assertFalse(service.sendDue(1, MONTH, now));
    }
}

package com.zip.backend.notification;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "zip.rent.reminder.enabled", havingValue = "true", matchIfMissing = true)
public class RentReminderScheduler {
    private static final Logger log = LoggerFactory.getLogger(RentReminderScheduler.class);
    private final RentReminderService service;
    private final Clock clock;

    public RentReminderScheduler(RentReminderService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "30000", fixedDelayString = "60000")
    public void sendRentReminders() {
        var now = clock.instant();
        for (var candidate : service.candidates(now)) {
            try {
                service.sendDue(candidate.user(), candidate.month(), clock.instant());
            } catch (RuntimeException error) {
                log.warn("월세 알림 생성 실패 (회원 {}, {})", candidate.user(), error.getClass().getSimpleName());
            }
        }
    }
}

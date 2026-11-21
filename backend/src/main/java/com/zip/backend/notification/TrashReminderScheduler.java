package com.zip.backend.notification;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** 쓰레기 배출일 아침 알림을 매분 확인 (7시 전에는 아무것도 안 함). 끄기: zip.trash.reminder.enabled=false (테스트) */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "zip.trash.reminder.enabled", havingValue = "true", matchIfMissing = true)
public class TrashReminderScheduler {
    private static final Logger log = LoggerFactory.getLogger(TrashReminderScheduler.class);
    private final TrashReminderService service;
    private final Clock clock;

    public TrashReminderScheduler(TrashReminderService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "30000", fixedDelayString = "60000")
    public void sendTodayReminders() {
        try {
            int sent = service.sendDue(clock.instant());
            if (sent > 0) log.info("쓰레기 배출 알림 {}건 생성", sent);
        } catch (RuntimeException error) {
            log.warn("쓰레기 배출 알림 생성 실패 ({})", error.getClass().getSimpleName());
        }
    }
}

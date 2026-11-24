package com.zip.backend.maintenance;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** 오래된 세션 · 이메일 인증 · 알림 정리 (서버 시작 2분 뒤, 그다음 6시간마다). 끄기: zip.cleanup.enabled=false (테스트) */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "zip.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class DataCleanupScheduler {
    private static final Logger log = LoggerFactory.getLogger(DataCleanupScheduler.class);
    private final DataCleanupService service;
    private final Clock clock;

    public DataCleanupScheduler(DataCleanupService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(initialDelayString = "120000", fixedDelayString = "21600000")
    public void cleanup() {
        try {
            var result = service.cleanup(clock.instant());
            if (result.total() > 0) {
                log.info("오래된 데이터 정리: 세션 {}건 · 이메일 인증 {}건 · 알림 {}건", result.sessions(), result.emailVerifications(), result.notifications());
            }
        } catch (RuntimeException error) {
            log.warn("오래된 데이터 정리 실패 ({})", error.getClass().getSimpleName());
        }
    }
}

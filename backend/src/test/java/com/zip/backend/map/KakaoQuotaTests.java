package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

/** 카카오 무료 쿼터 지키기: 캐시 · 사람당 1분 한도 · 하루 한도 · 카카오 429 */
class KakaoQuotaTests {
    private static final List<KakaoLocalClient.Document> DOCS = List.of(
        new KakaoLocalClient.Document("1", "편의점", "가정,생활 > 편의점", "CS2", null, "서울 강남구", null, "127.03", "37.50"));

    /** 손으로 움직이는 시계 */
    private static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-15T03:00:00Z"); // 한국 시간 낮 12시
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final TestClock clock = new TestClock();
    private final AtomicInteger calls = new AtomicInteger();

    private List<KakaoLocalClient.Document> kakao() { calls.incrementAndGet(); return DOCS; }

    @Test void sameSearchIsServedFromCacheForTenMinutes() {
        var quota = new KakaoQuota(clock, 30, 100);
        quota.call(1, "a", this::kakao);
        quota.call(2, "a", this::kakao);
        assertEquals(1, calls.get());
        clock.now = clock.now.plus(KakaoQuota.CACHE_TTL);
        quota.call(1, "a", this::kakao);
        assertEquals(2, calls.get());
    }

    @Test void eachUserIsLimitedPerMinuteButCacheStillWorks() {
        var quota = new KakaoQuota(clock, 2, 100);
        quota.call(1, "a", this::kakao);
        quota.call(1, "b", this::kakao);
        var blocked = assertThrows(KakaoQuota.Unavailable.class, () -> quota.call(1, "c", this::kakao));
        assertEquals("user-limit", blocked.code());
        assertEquals(DOCS, quota.call(1, "a", this::kakao));
        quota.call(2, "c", this::kakao); // 다른 사람은 괜찮음
        clock.now = clock.now.plus(Duration.ofMinutes(1));
        quota.call(1, "d", this::kakao);
        assertEquals(4, calls.get());
    }

    @Test void dailyLimitStopsUntilMidnightInKorea() {
        var quota = new KakaoQuota(clock, 30, 2);
        quota.call(1, "a", this::kakao);
        quota.call(2, "b", this::kakao);
        assertEquals("daily-limit", assertThrows(KakaoQuota.Unavailable.class, () -> quota.call(3, "c", this::kakao)).code());
        clock.now = Instant.parse("2026-11-15T15:00:00Z"); // 한국 시간 11월 16일 0시
        quota.call(3, "c", this::kakao);
        assertEquals(3, calls.get());
    }

    @Test void kakaoTooManyRequestsBlocksTheRestOfTheDayAndErrorsAreNotCached() {
        var quota = new KakaoQuota(clock, 30, 100);
        var error = assertThrows(KakaoQuota.Unavailable.class, () -> quota.call(1, "a", () -> {
            throw new ResourceAccessException("timeout");
        }));
        assertEquals("error", error.code());
        assertEquals(DOCS, quota.call(1, "a", this::kakao));
        var limit = assertThrows(KakaoQuota.Unavailable.class, () -> quota.call(1, "b", () -> {
            throw HttpClientErrorException.create(HttpStatus.TOO_MANY_REQUESTS, "limit", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);
        }));
        assertEquals("daily-limit", limit.code());
        assertEquals("daily-limit", assertThrows(KakaoQuota.Unavailable.class, () -> quota.call(2, "c", this::kakao)).code());
        assertEquals(DOCS, quota.call(2, "a", this::kakao)); // 캐시는 계속 씀
    }
}

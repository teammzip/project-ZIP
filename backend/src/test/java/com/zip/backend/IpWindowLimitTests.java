package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.zip.backend.common.IpWindowLimit;
import com.zip.backend.common.IpWindowLimit.Result;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** IP 별 "짧은 시간 N번 · 하루 M번" 메모리 제한 */
class IpWindowLimitTests {
    final Instant start = Instant.parse("2026-11-25T03:00:00Z");

    @Test void shortWindowThenDayLimitAndIpsAreCountedSeparately() {
        var limit = new IpWindowLimit(Duration.ofMinutes(10), 2, 3);
        assertEquals(Result.OK, limit.acquire("1.1.1.1", start));
        assertEquals(Result.OK, limit.acquire("1.1.1.1", start.plusSeconds(10)));
        assertEquals(Result.SHORT_LIMIT, limit.acquire("1.1.1.1", start.plusSeconds(20)));
        assertEquals(Result.OK, limit.acquire("2.2.2.2", start.plusSeconds(20)));
        // 10분이 지나면 짧은 제한은 풀리지만 하루 3번에서 멈춤
        assertEquals(Result.OK, limit.acquire("1.1.1.1", start.plus(Duration.ofMinutes(11))));
        assertEquals(Result.DAY_LIMIT, limit.acquire("1.1.1.1", start.plus(Duration.ofMinutes(30))));
        // 막힌 요청은 기록하지 않아서, 하루가 지나면 다시 허락
        assertEquals(Result.OK, limit.acquire("1.1.1.1", start.plus(Duration.ofHours(24)).plusSeconds(1)));
    }

    @Test void missingIpIsCountedAsOneBucketAndBadSettingsFailAtStartup() {
        var limit = new IpWindowLimit(Duration.ofMinutes(10), 1, 1);
        assertEquals(Result.OK, limit.acquire(null, start));
        assertEquals(Result.DAY_LIMIT, limit.acquire("", start));
        assertThrows(IllegalArgumentException.class, () -> new IpWindowLimit(Duration.ofMinutes(10), 5, 2));
        assertThrows(IllegalArgumentException.class, () -> new IpWindowLimit(Duration.ZERO, 1, 1));
        assertThrows(IllegalArgumentException.class, () -> new IpWindowLimit(Duration.ofDays(2), 1, 1));
    }
}

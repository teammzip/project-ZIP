package com.zip.backend.map;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

/**
 * 카카오 로컬 API 호출을 무료 쿼터 안에서만 쓰도록 막는 곳.
 * - 같은 검색(같은 말 · 비슷한 위치)은 10분 동안 메모리에서 다시 씀. 카카오 결과는 DB 에 저장하지 않음 (카카오 운영 정책: 장소 정보 장기 저장 제한)
 * - 한 사람당 1분에 {@code zip.kakao.per-user-per-minute}번, 서버 전체 하루 {@code zip.kakao.daily-limit}번까지 (한국 시간 자정에 초기화)
 * - 카카오가 한도 초과(429)를 알리면 그날은 더 부르지 않음. 유료 추가 사용은 켜지 않는 것을 전제로 함
 */
@Component
public class KakaoQuota {
    /** 카카오를 부를 수 없을 때. code 는 응답 헤더 X-Place-Notice 로 프론트에 전달 (user-limit · daily-limit · error) */
    public static class Unavailable extends RuntimeException {
        private final String code;
        Unavailable(String code) { super(code, null, false, false); this.code = code; }
        public String code() { return code; }
    }

    private record Cached(Instant at, List<KakaoLocalClient.Document> documents) {}

    static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final int CACHE_MAX = 2_000;
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private static final Logger log = LoggerFactory.getLogger(KakaoQuota.class);

    private final Clock clock;
    private final int perUserPerMinute;
    private final int dailyLimit;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();
    private final Map<Long, Deque<Instant>> userCalls = new ConcurrentHashMap<>();
    private LocalDate day;
    private int usedToday;
    private boolean exhaustedToday;

    public KakaoQuota(Clock clock, @Value("${zip.kakao.per-user-per-minute:30}") int perUserPerMinute,
        @Value("${zip.kakao.daily-limit:30000}") int dailyLimit) {
        this.clock = clock;
        this.perUserPerMinute = perUserPerMinute;
        this.dailyLimit = dailyLimit;
    }

    /** 캐시에 있으면 그대로, 없으면 한도를 확인하고 카카오를 불러 캐시에 넣음 */
    public List<KakaoLocalClient.Document> call(long userId, String key, Supplier<List<KakaoLocalClient.Document>> kakao) {
        var now = clock.instant();
        var hit = cache.get(key);
        if (hit != null && hit.at().plus(CACHE_TTL).isAfter(now)) return hit.documents();
        acquire(userId, now);
        List<KakaoLocalClient.Document> documents;
        try {
            documents = List.copyOf(kakao.get());
        } catch (HttpClientErrorException.TooManyRequests error) {
            synchronized (this) { exhaustedToday = true; }
            log.warn("카카오 로컬 API 한도 초과");
            throw new Unavailable("daily-limit");
        } catch (RestClientException error) {
            log.warn("카카오 로컬 API 실패: {}", error.getClass().getSimpleName());
            throw new Unavailable("error");
        }
        if (cache.size() >= CACHE_MAX) cache.entrySet().removeIf(e -> !e.getValue().at().plus(CACHE_TTL).isAfter(now));
        if (cache.size() >= CACHE_MAX) cache.clear();
        cache.put(key, new Cached(now, documents));
        return documents;
    }

    private void acquire(long userId, Instant now) {
        synchronized (this) {
            var today = LocalDate.ofInstant(now, KOREA);
            if (!today.equals(day)) {
                day = today;
                usedToday = 0;
                exhaustedToday = false;
            }
            if (exhaustedToday || usedToday >= dailyLimit) throw new Unavailable("daily-limit");
        }
        var calls = userCalls.computeIfAbsent(userId, id -> new ArrayDeque<>());
        synchronized (calls) {
            while (!calls.isEmpty() && !calls.peekFirst().plus(Duration.ofMinutes(1)).isAfter(now)) calls.pollFirst();
            if (calls.size() >= perUserPerMinute) throw new Unavailable("user-limit");
            calls.addLast(now);
        }
        synchronized (this) {
            if (usedToday >= dailyLimit) throw new Unavailable("daily-limit");
            usedToday++;
        }
    }
}

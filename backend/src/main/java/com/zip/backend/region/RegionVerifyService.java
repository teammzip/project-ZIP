package com.zip.backend.region;

import com.zip.backend.common.ApiException;
import com.zip.backend.map.KakaoLocalClient;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;

/**
 * 동네 인증 (frontend/API.md 2장 "동네 인증"): 휴대폰 위치(GPS) → 카카오 좌표 → 행정구역 → 그 구 · 군을 내 동네(users.region_id)로,
 * 인증 시각(region_verified_at)을 저장. 인증은 30일 유지되고, 동네를 바꾸면 초기화돼요(설정 · 주소 변경 쪽에서).
 * 커뮤니티 글쓰기 · 댓글 · 공감은 인증한 지 30일 안이어야 해요(CommunityService).
 */
@Service
public class RegionVerifyService {
    public static final Duration VALID = Duration.ofDays(30);
    /** 한 사람이 한 시간에 인증을 시도할 수 있는 횟수 (카카오 호출 아끼기) */
    static final int PER_USER_PER_HOUR = 10;
    private static final Duration LIMIT_WINDOW = Duration.ofHours(1);
    /** 시도 기록이 이만큼 쌓이면 한 시간 지난 사람들 기록을 지워요 (메모리가 계속 늘지 않게) */
    private static final int LIMIT_SWEEP_SIZE = 1_000;
    private static final Logger log = LoggerFactory.getLogger(RegionVerifyService.class);

    private final KakaoLocalClient kakao;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final Map<Long, ArrayDeque<Instant>> attempts = new ConcurrentHashMap<>();

    public RegionVerifyService(KakaoLocalClient kakao, JdbcTemplate jdbc, PlatformTransactionManager transactions, Clock clock) {
        this.kakao = kakao;
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactions);
        this.clock = clock;
    }

    public record VerifyInput(Double lat, Double lon) {}

    /** 내 동네(없으면 null)와 인증 시각(동네가 있고 인증한 지 30일 안일 때만, 아니면 null) */
    public record Status(Long regionId, Instant verifiedAt) {}

    public Status status(long userId) {
        var now = clock.instant();
        return jdbc.query("SELECT region_id, region_verified_at FROM users WHERE id = ?", (rs, row) -> {
            long region = rs.getLong(1);
            Long regionId = rs.wasNull() ? null : region;
            Timestamp at = rs.getTimestamp(2);
            boolean valid = regionId != null && at != null && at.toInstant().plus(VALID).isAfter(now);
            return new Status(regionId, valid ? at.toInstant() : null);
        }, userId).stream().findFirst().orElse(new Status(null, null));
    }

    /** 인증한 지 30일 안이면 그 시각, 아니면 비어 있음 */
    public Optional<Instant> verifiedAt(long userId) {
        return Optional.ofNullable(status(userId).verifiedAt());
    }

    /** 카카오 호출은 DB 연결을 잡지 않은 채로 하고, 동네 저장만 트랜잭션으로 묶어요 */
    public Map<String, Object> verify(long userId, VerifyInput input) {
        if (input == null || input.lat() == null || input.lon() == null || !Double.isFinite(input.lat()) || !Double.isFinite(input.lon())) {
            throw new ApiException(400, "위치(lat · lon)를 보내 주세요.");
        }
        double lat = input.lat(), lon = input.lon();
        // 대한민국 범위 밖이면 행정구역을 찾을 수 없어요
        if (lat < 33 || lat > 39 || lon < 124 || lon > 132) throw new ApiException(400, "대한민국 안의 위치에서만 동네 인증을 할 수 있어요.");
        if (!kakao.enabled()) throw new ApiException(503, "지금은 동네 인증을 할 수 없어요. 잠시 후 다시 시도해 주세요.");
        limit(userId);

        List<KakaoLocalClient.RegionDocument> docs;
        try {
            docs = kakao.coordToRegion(lat, lon);
        } catch (RestClientException error) {
            log.warn("카카오 좌표 → 행정구역 실패: {}", error.getMessage());
            throw new ApiException(503, "동네 이름을 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
        // 행정동(H)을 먼저, 없으면 법정동(B)
        var doc = docs.stream().filter(d -> "H".equals(d.region_type())).findFirst().or(() -> docs.stream().findFirst())
            .filter(d -> notBlank(d.region_1depth_name()))
            .orElseThrow(() -> new ApiException(400, "이 위치의 동네 이름을 찾지 못했어요."));
        String sido = cut(doc.region_1depth_name().strip());
        // 세종특별자치시처럼 시 · 군 · 구가 없는 곳은 카카오가 2단계를 비워 보냄 → 시 · 도 이름을 시 · 군 · 구 자리에도 씀 (db/migrations/20261121_07_regions_nationwide.sql 과 같은 규칙)
        // 구가 있는 시는 카카오가 "성남시 분당구"처럼 보냄 → 앞의 시 이름만 씀. 동네 목록(regions.ts) · 쓰레기 배출표가 시 단위라서
        String gu = notBlank(doc.region_2depth_name()) ? cut(doc.region_2depth_name().strip().split("\\s+")[0]) : sido;

        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS); // MySQL DATETIME 반올림 대비
        long guId = transaction.execute(status -> {
            long id = findOrCreate(findOrCreate(null, sido, 1), gu, 2);
            jdbc.update("UPDATE users SET region_id = ?, region_verified_at = ? WHERE id = ?", id, Timestamp.from(now), userId);
            return id;
        });

        var result = new LinkedHashMap<String, Object>();
        result.put("region", Map.of("id", Long.toString(guId), "name", gu, "fullName", sido + " " + gu));
        result.put("dong", doc.region_3depth_name() == null ? "" : doc.region_3depth_name().strip());
        result.put("verifiedAt", now.toString());
        result.put("expiresAt", now.plus(VALID).toString());
        return result;
    }

    /** 카카오가 알려 준 시 · 도 / 구 · 군이 동네 표(regions)에 없으면 만들어요 (전국 어디서나 인증되게) */
    private long findOrCreate(Long parentId, String name, int level) {
        var found = parentId == null
            ? jdbc.queryForList("SELECT id FROM regions WHERE parent_id IS NULL AND name = ? ORDER BY id LIMIT 1", Long.class, name)
            : jdbc.queryForList("SELECT id FROM regions WHERE parent_id = ? AND name = ? ORDER BY id LIMIT 1", Long.class, parentId, name);
        if (!found.isEmpty()) return found.get(0);
        try {
            jdbc.update("INSERT INTO regions (parent_id, name, level) VALUES (?, ?, ?)", parentId, name, level);
        } catch (org.springframework.dao.DuplicateKeyException sameTime) {
            // 다른 사람이 같은 동네를 방금 만듦
        }
        return findOrCreate(parentId, name, level);
    }

    /** 테스트용: 시도 횟수 기록 비우기 */
    void resetLimits() { attempts.clear(); }

    /** 한 사람 한 시간 10번. compute 는 같은 사람에 대해 한 번에 하나씩만 돌아요 */
    private void limit(long userId) {
        var now = clock.instant();
        var allowed = new boolean[1];
        attempts.compute(userId, (id, recent) -> {
            var list = recent == null ? new ArrayDeque<Instant>() : recent;
            dropOld(list, now);
            allowed[0] = list.size() < PER_USER_PER_HOUR;
            if (allowed[0]) list.addLast(now);
            return list;
        });
        if (attempts.size() > LIMIT_SWEEP_SIZE) {
            for (var id : attempts.keySet()) attempts.computeIfPresent(id, (key, list) -> dropOld(list, now).isEmpty() ? null : list);
        }
        if (!allowed[0]) throw new ApiException(429, "동네 인증을 너무 자주 했어요. 한 시간 뒤에 다시 시도해 주세요.");
    }

    private static ArrayDeque<Instant> dropOld(ArrayDeque<Instant> list, Instant now) {
        while (!list.isEmpty() && !list.peekFirst().plus(LIMIT_WINDOW).isAfter(now)) list.pollFirst();
        return list;
    }

    private static boolean notBlank(String value) { return value != null && !value.isBlank(); }

    private static String cut(String value) { return value.length() <= 30 ? value : value.substring(0, 30); }
}

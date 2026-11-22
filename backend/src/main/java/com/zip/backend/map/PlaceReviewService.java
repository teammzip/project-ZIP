package com.zip.backend.map;

import com.zip.backend.common.ApiException;
import com.zip.backend.notification.NotificationService;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 장소 리뷰: 우리 ZIP 회원이 쓴 별점 · 한 줄 리뷰는 우리 서버에만 저장해요 (카카오로 보내지 않음).
 * DB 장소("12")는 place_reviews, 카카오 검색 장소("kakao:123")는 kakao_place_reviews (카카오 장소 id · 이름만, 주소 · 좌표 없음).
 * 한 사람당 한 장소에 하나, 내 리뷰는 고치거나 지울 수 있고, 다른 사람 리뷰는 신고할 수 있어요 (관리자가 지우거나 기각). */
@Service
public class PlaceReviewService {
    static final String PLACE = "PLACE";
    static final String KAKAO = "KAKAO";
    static final int SUMMARY_MAX = 100;
    private static final Pattern KAKAO_PLACE_ID = Pattern.compile("[0-9]{1,50}");
    private static final Pattern NAME_CONTROL = Pattern.compile("\\p{Cntrl}");
    private static final Pattern TEXT_CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Set<String> REASONS = Set.of("ABUSE", "FALSE_INFO", "PRIVACY", "AD_ILLEGAL", "COPYRIGHT", "OTHER");
    private static final Set<String> STATUSES = Set.of("RECEIVED", "HIDDEN", "DISMISSED");
    private static final Set<String> RESOLUTIONS = Set.of("HIDDEN", "DISMISSED");

    private final PlaceReviewRepository repository;
    private final NotificationService notifications;
    private final Clock clock;

    public PlaceReviewService(PlaceReviewRepository repository, NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** 리뷰 쓰기 · 고치기 내용: 별점 1~5, 내용 300자(선택), 카카오 장소면 이름(60자) */
    public record ReviewInput(Integer rating, String body, String name) {}

    public record ReportInput(String reason, String detail) {}

    // ---------- 회원 ----------

    /** 이 장소의 리뷰 (최신순). reportedByMe = 내가 이미 신고한 리뷰 */
    public List<Map<String, Object>> reviews(long userId, String placeId) {
        var target = existingTarget(placeId);
        var reported = Set.copyOf(repository.reportedByMe(userId, target));
        return repository.reviews(target).stream().map(r -> {
            var item = new LinkedHashMap<String, Object>();
            item.put("id", Long.toString(r.id()));
            item.put("rating", r.rating());
            item.put("body", r.body() == null ? "" : r.body());
            item.put("author", Map.of("id", Long.toString(r.authorId()), "nickname", r.authorNickname()));
            item.put("createdAt", r.createdAt().toString());
            item.put("reportedByMe", reported.contains(r.id()));
            return (Map<String, Object>) item;
        }).toList();
    }

    @Transactional
    public void addReview(long userId, String placeId, ReviewInput input) {
        var target = existingTarget(placeId);
        var rating = rating(input);
        var body = body(input);
        var name = target.isKakao() ? kakaoName(input) : null;
        try {
            repository.addReview(target, userId, name, rating, body);
        } catch (DuplicateKeyException duplicate) {
            throw new ApiException(409, "이미 이 장소에 리뷰를 썼어요. 내 리뷰를 고쳐 주세요.");
        }
    }

    /** 내 리뷰 고치기 (별점 · 내용) */
    @Transactional
    public void updateMyReview(long userId, String placeId, ReviewInput input) {
        var target = existingTarget(placeId);
        if (repository.updateMyReview(target, userId, rating(input), body(input)) == 0) throw new ApiException(404, "이 장소에 쓴 내 리뷰가 없어요.");
    }

    @Transactional
    public void deleteMyReview(long userId, String placeId) {
        var target = existingTarget(placeId);
        if (repository.deleteMyReview(target, userId) == 0) throw new ApiException(404, "이 장소에 쓴 내 리뷰가 없어요.");
    }

    /** 지도 목록용 별점 요약. ids = "12,kakao:123,…" (100개까지). 리뷰 없는 곳은 빠져요 */
    public List<Map<String, Object>> summaries(String ids) {
        var placeIds = new LinkedHashSet<Long>();
        var kakaoIds = new LinkedHashSet<String>();
        var parts = ids == null || ids.isBlank() ? new String[0] : ids.split(",");
        if (parts.length > SUMMARY_MAX) throw new ApiException(400, "장소는 한 번에 " + SUMMARY_MAX + "곳까지 물어볼 수 있어요.");
        for (var raw : parts) {
            var id = raw.strip();
            if (id.startsWith(MapService.KAKAO_ID)) {
                var kakao = id.substring(MapService.KAKAO_ID.length());
                if (KAKAO_PLACE_ID.matcher(kakao).matches()) kakaoIds.add(kakao);
            } else {
                try {
                    long value = Long.parseLong(id);
                    if (value > 0) placeIds.add(value);
                } catch (NumberFormatException ignored) {
                    // 형식이 틀린 id 는 건너뜀
                }
            }
        }
        var found = repository.summaries(placeIds, kakaoIds);
        var result = new ArrayList<Map<String, Object>>();
        found.forEach((key, s) -> result.add(Map.of("id", key, "rating", s.rating(), "count", s.count())));
        return result;
    }

    /** 내가 쓴 리뷰 모아 보기 (최신순) */
    public List<Map<String, Object>> myReviews(long userId) {
        return repository.myReviews(userId).stream().map(r -> Map.<String, Object>of(
            "id", Long.toString(r.id()), "placeId", r.placeKey(), "placeName", r.placeName(), "rating", r.rating(),
            "body", r.body() == null ? "" : r.body(), "createdAt", r.createdAt().toString())).toList();
    }

    /** 다른 사람 리뷰 신고 (사유는 커뮤니티 신고와 같음). 같은 리뷰는 한 번만 */
    @Transactional
    public void report(long userId, String placeId, String reviewId, ReportInput input) {
        var target = existingTarget(placeId);
        long id = positiveId(reviewId, "리뷰를");
        if (input == null || input.reason() == null || !REASONS.contains(input.reason())) throw new ApiException(400, "신고 사유를 골라 주세요.");
        var detail = input.detail() == null ? "" : input.detail().strip();
        if (detail.length() > 200 || TEXT_CONTROL.matcher(detail).find()) throw new ApiException(400, "자세한 내용은 200자 이내로 입력해 주세요.");
        if (input.reason().equals("OTHER") && detail.isEmpty()) throw new ApiException(400, "기타 사유는 자세한 내용을 적어 주세요.");
        // 스냅샷은 실제 리뷰에서 복사 (클라이언트 값을 믿지 않음)
        var review = repository.reviewForReport(target, id).orElseThrow(() -> new ApiException(404, "리뷰를 찾을 수 없어요."));
        if (review.authorId() == userId) throw new ApiException(400, "내가 쓴 리뷰는 신고할 수 없어요.");
        try {
            repository.insertReport(userId, target, id, cut(review.placeName(), 60), input.reason(), detail.isEmpty() ? null : detail,
                cut(review.authorNickname(), 12), cut(review.body(), 300), review.rating());
        } catch (DuplicateKeyException duplicate) {
            throw new ApiException(409, "이미 신고한 리뷰예요.");
        }
    }

    // ---------- 관리자 (/api/admin/**) ----------

    /** 관리자 리뷰 신고 목록. status 가 없으면 전부 */
    public List<Map<String, Object>> adminReports(String status) {
        var filter = status == null || status.isBlank() ? null : status;
        if (filter != null && !STATUSES.contains(filter)) throw new ApiException(400, "status 는 RECEIVED, HIDDEN, DISMISSED 중 하나예요.");
        return repository.adminReports(filter).stream().map(r -> {
            var item = new LinkedHashMap<String, Object>();
            item.put("id", Long.toString(r.id()));
            item.put("reviewKind", r.kind());
            item.put("reviewId", Long.toString(r.reviewId()));
            item.put("placeId", r.placeKey());
            item.put("placeName", r.placeName());
            var review = new LinkedHashMap<String, Object>();
            review.put("author", r.author() == null ? "" : r.author());
            review.put("text", r.text() == null ? "" : r.text());
            review.put("rating", r.rating());
            review.put("deleted", r.gone());
            item.put("review", review);
            item.put("reason", r.reason());
            item.put("detail", r.detail() == null ? "" : r.detail());
            item.put("reporter", Map.of("id", Long.toString(r.reporterId()), "nickname", r.reporterNickname()));
            item.put("status", r.status());
            item.put("createdAt", r.createdAt().toString());
            return (Map<String, Object>) item;
        }).toList();
    }

    /** 신고 처리 = 그 리뷰에 들어온 접수 중 신고 전부. HIDDEN 이면 리뷰를 지우고 쓴 사람에게 알림, DISMISSED 는 문제없음 */
    @Transactional
    public void adminResolve(long adminId, String reportId, String status) {
        if (status == null || !RESOLUTIONS.contains(status)) throw new ApiException(400, "status 는 HIDDEN 또는 DISMISSED 예요.");
        var ref = repository.reportRef(positiveId(reportId, "신고를")).orElseThrow(() -> new ApiException(404, "신고를 찾을 수 없어요."));
        if (status.equals("HIDDEN")) {
            repository.storedReview(ref.kind(), ref.reviewId()).ifPresent(review -> {
                repository.deleteReview(ref.kind(), ref.reviewId(), review.placeId());
                notifications.send(review.authorId(), adminId, NotificationService.SYSTEM, "신고가 확인돼 내 장소 리뷰가 삭제됐어요",
                    "「" + review.placeName() + "」 " + NotificationService.preview(review.body() == null ? "" : review.body(), 40), null, null);
            });
        }
        repository.resolveReports(ref.kind(), ref.reviewId(), status, adminId, clock.instant());
    }

    // ---------- 검사 ----------

    /** "12" → DB 장소(있어야 함), "kakao:123" → 카카오 장소. 형식이 틀리거나 없는 장소면 404 */
    private PlaceReviewRepository.Target existingTarget(String placeId) {
        if (placeId != null && placeId.startsWith(MapService.KAKAO_ID)) {
            var id = placeId.substring(MapService.KAKAO_ID.length());
            if (!KAKAO_PLACE_ID.matcher(id).matches()) throw new ApiException(404, "장소를 찾을 수 없어요.");
            return PlaceReviewRepository.Target.kakao(id);
        }
        long id = positiveId(placeId, "장소를");
        if (repository.placeName(id).isEmpty()) throw new ApiException(404, "장소를 찾을 수 없어요.");
        return PlaceReviewRepository.Target.place(id);
    }

    private static long positiveId(String value, String what) {
        try {
            long id = Long.parseLong(value);
            if (id > 0) return id;
        } catch (NumberFormatException | NullPointerException error) {
            // 아래에서 404
        }
        throw new ApiException(404, what + " 찾을 수 없어요.");
    }

    private static int rating(ReviewInput input) {
        if (input == null || input.rating() == null || input.rating() < 1 || input.rating() > 5) throw new ApiException(400, "별점은 1~5점으로 골라 주세요.");
        return input.rating();
    }

    private static String body(ReviewInput input) {
        var body = input.body() == null ? "" : input.body().strip();
        if (body.length() > 300) throw new ApiException(400, "리뷰는 300자 이내로 써 주세요.");
        if (TEXT_CONTROL.matcher(body).find()) throw new ApiException(400, "리뷰 내용을 확인해 주세요.");
        return body.isEmpty() ? null : body;
    }

    private static String kakaoName(ReviewInput input) {
        var name = input.name() == null ? "" : input.name().strip();
        if (name.isEmpty() || name.length() > 60 || NAME_CONTROL.matcher(name).find()) throw new ApiException(400, "장소 이름(name)을 확인해 주세요.");
        return name;
    }

    private static String cut(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}

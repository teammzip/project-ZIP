package com.zip.backend.map;

import com.zip.backend.common.ApiException;
import com.zip.backend.files.ProfileFileService;
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
    private static final Pattern NAME_CONTROL = Pattern.compile("\\p{Cntrl}");
    private static final Pattern TEXT_CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Set<String> REASONS = Set.of("ABUSE", "FALSE_INFO", "PRIVACY", "AD_ILLEGAL", "COPYRIGHT", "OTHER");
    private static final Set<String> STATUSES = Set.of("RECEIVED", "HIDDEN", "DISMISSED");
    private static final Set<String> RESOLUTIONS = Set.of("HIDDEN", "DISMISSED");

    static final int PHOTO_MAX = 5;

    private final PlaceReviewRepository repository;
    private final NotificationService notifications;
    private final ProfileFileService files;
    private final Clock clock;

    public PlaceReviewService(PlaceReviewRepository repository, NotificationService notifications, ProfileFileService files, Clock clock) {
        this.repository = repository;
        this.notifications = notifications;
        this.files = files;
        this.clock = clock;
    }

    /** 리뷰 쓰기 · 고치기 내용: 별점 1~5, 내용 300자(선택), 카카오 장소면 이름(60자), 사진 파일 id(POST /api/files 로 먼저 올림, 5장까지) */
    public record ReviewInput(Integer rating, String body, String name, List<String> photoIds) {}

    public record ReportInput(String reason, String detail) {}

    // ---------- 회원 ----------

    public List<PlaceReviewRepository.MyReview> myReviews(long userId) {
        return repository.myReviews(userId);
    }

    /** 이 장소의 리뷰 (최신순). 작성자 프로필 · 후기 수 · 별점 평균, 사진, reportedByMe = 내가 이미 신고한 리뷰 */
    public List<Map<String, Object>> reviews(long userId, String placeId) {
        var target = existingTarget(placeId);
        var reported = Set.copyOf(repository.reportedByMe(userId, target));
        var rows = repository.reviews(target);
        var authorIds = rows.stream().map(PlaceReviewRepository.ReviewRow::authorId).distinct().toList();
        var stats = repository.authorStats(authorIds);
        var looks = repository.authorLooks(authorIds);
        var photos = repository.photos(target.kind(), rows.stream().map(PlaceReviewRepository.ReviewRow::id).toList());
        return rows.stream().map(r -> {
            var stat = stats.getOrDefault(r.authorId(), new PlaceReviewRepository.AuthorStat(0, 0));
            var look = looks.get(r.authorId());
            var author = new LinkedHashMap<String, Object>();
            author.put("id", Long.toString(r.authorId()));
            author.put("nickname", r.authorNickname());
            author.put("avatarUrl", look == null ? null : look.avatarUrl());
            author.put("avatarEmoji", look == null ? null : look.avatarEmoji());
            author.put("avatarColor", look == null ? null : look.avatarColor());
            author.put("reviewCount", stat.count());
            author.put("ratingAvg", stat.rating());
            var item = new LinkedHashMap<String, Object>();
            item.put("id", Long.toString(r.id()));
            item.put("rating", r.rating());
            item.put("body", r.body() == null ? "" : r.body());
            item.put("photos", photos.getOrDefault(r.id(), List.of()).stream()
                .map(p -> Map.of("id", Long.toString(p.fileId()), "url", p.url())).toList());
            item.put("author", author);
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
        var photoIds = validPhotos(userId, input.photoIds(), target.kind(), null);
        long reviewId;
        try {
            reviewId = repository.addReview(target, userId, name, rating, body);
        } catch (DuplicateKeyException duplicate) {
            throw new ApiException(409, "이미 이 장소에 리뷰를 썼어요. 내 리뷰를 고쳐 주세요.");
        }
        repository.replacePhotos(target.kind(), reviewId, photoIds);
    }

    /** 내 리뷰 고치기 (별점 · 내용 · 사진). 빠진 사진 파일은 지워요 */
    @Transactional
    public void updateMyReview(long userId, String placeId, ReviewInput input) {
        var target = existingTarget(placeId);
        var rating = rating(input);
        var body = body(input);
        long reviewId = repository.myReviewId(target, userId).orElseThrow(() -> new ApiException(404, "이 장소에 쓴 내 리뷰가 없어요."));
        var photoIds = validPhotos(userId, input.photoIds(), target.kind(), reviewId);
        repository.updateMyReview(target, userId, rating, body);
        removeFiles(repository.replacePhotos(target.kind(), reviewId, photoIds));
    }

    /** 내 리뷰 지우기 (사진 파일도) */
    @Transactional
    public void deleteMyReview(long userId, String placeId) {
        var target = existingTarget(placeId);
        long reviewId = repository.myReviewId(target, userId).orElseThrow(() -> new ApiException(404, "이 장소에 쓴 내 리뷰가 없어요."));
        removeFiles(repository.replacePhotos(target.kind(), reviewId, List.of()));
        repository.deleteMyReview(target, userId);
    }

    /** 사진: 5장까지 · 내가 올린 파일 · 사진 형식 · 다른 리뷰 · 글 · 프로필에 쓰이지 않은 파일 */
    private List<Long> validPhotos(long userId, List<String> raw, String kind, Long reviewId) {
        if (raw == null || raw.isEmpty()) return List.of();
        if (raw.size() > PHOTO_MAX) throw new ApiException(400, "사진은 " + PHOTO_MAX + "장까지 붙일 수 있어요.");
        var ids = new LinkedHashSet<Long>();
        for (var value : raw) ids.add(positiveId(value, "사진을"));
        if (ids.size() != raw.size()) throw new ApiException(400, "같은 사진을 두 번 붙일 수 없어요.");
        var found = repository.files(ids);
        for (long fileId : ids) {
            var file = found.stream().filter(f -> f.id() == fileId).findFirst()
                .filter(f -> f.userId() == userId && !f.deleted())
                .orElseThrow(() -> new ApiException(400, "내가 올린 사진만 붙일 수 있어요."));
            if (file.type() == null || !file.type().startsWith("image/")) throw new ApiException(400, "사진만 붙일 수 있어요.");
        }
        if (repository.filesInUse(ids, kind, reviewId)) throw new ApiException(400, "다른 곳에 쓰인 사진은 붙일 수 없어요. 다시 올려 주세요.");
        return List.copyOf(ids);
    }

    /** 빠진 사진: 지운 것으로 표시하고 실제 파일은 커밋 뒤 삭제 */
    private void removeFiles(List<Long> fileIds) {
        files.deleteAfterCommit(repository.markFilesDeleted(fileIds, clock.instant()));
    }

    /** 지도 목록용 별점 요약. ids = "12,kakao:123,…" (100개까지). 리뷰 없는 곳은 빠져요 */
    public List<Map<String, Object>> summaries(String ids) {
        var placeIds = new LinkedHashSet<Long>();
        var kakaoIds = new LinkedHashSet<String>();
        var parts = ids == null || ids.isBlank() ? new String[0] : ids.split(",");
        if (parts.length > SUMMARY_MAX) throw new ApiException(400, "장소는 한 번에 " + SUMMARY_MAX + "곳까지 물어볼 수 있어요.");
        for (var raw : parts) {
            var id = raw.strip();
            var kakaoId = KakaoPlaceId.fromKey(id);
            if (kakaoId != null) {
                kakaoIds.add(kakaoId);
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
                removeFiles(repository.replacePhotos(ref.kind(), ref.reviewId(), List.of()));
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
        var kakaoId = KakaoPlaceId.fromKey(placeId);
        if (kakaoId != null) return PlaceReviewRepository.Target.kakao(kakaoId);
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

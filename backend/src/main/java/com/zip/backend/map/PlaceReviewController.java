package com.zip.backend.map;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 장소 리뷰 API (backend/openapi.yaml "지도" 태그). 모두 로그인 후 요청. 장소 id = DB 장소 "12" 또는 카카오 장소 "kakao:123" */
@RestController
public class PlaceReviewController {
    private final PlaceReviewService reviews;

    public PlaceReviewController(PlaceReviewService reviews) { this.reviews = reviews; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    @GetMapping("/api/places/{id}/reviews")
    public List<Map<String, Object>> reviews(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { return reviews.reviews(userId(jwt), id); }

    @PostMapping("/api/places/{id}/reviews")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) PlaceReviewService.ReviewInput input) {
        reviews.addReview(userId(jwt), id, input);
    }

    @PutMapping("/api/places/{id}/reviews/mine")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) PlaceReviewService.ReviewInput input) {
        reviews.updateMyReview(userId(jwt), id, input);
    }

    @DeleteMapping("/api/places/{id}/reviews/mine")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { reviews.deleteMyReview(userId(jwt), id); }

    @PostMapping("/api/places/{id}/reviews/{reviewId}/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String reviewId,
        @RequestBody(required = false) PlaceReviewService.ReportInput input) {
        reviews.report(userId(jwt), id, reviewId, input);
    }

    /** 지도 목록의 별점: ids=12,kakao:123 (100곳까지) → [{ id, rating, count }] (리뷰 없는 곳은 빠짐) */
    @GetMapping("/api/places/review-summary")
    public List<Map<String, Object>> summary(@RequestParam(required = false) String ids) { return reviews.summaries(ids); }

    // ---------- 관리자 ----------

    public record Resolution(String status) {}

    @GetMapping("/api/admin/place-review-reports")
    public List<Map<String, Object>> adminReports(@RequestParam(required = false) String status) { return reviews.adminReports(status); }

    /** 신고 처리: HIDDEN = 리뷰 삭제, DISMISSED = 문제없음 (그 리뷰의 접수 중 신고 전부) */
    @PatchMapping("/api/admin/place-review-reports/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolve(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) Resolution body) {
        reviews.adminResolve(userId(jwt), id, body == null ? null : body.status());
    }
}

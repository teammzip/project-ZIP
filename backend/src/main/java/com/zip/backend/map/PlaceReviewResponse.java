package com.zip.backend.map;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 장소 리뷰 한 개 (GET /api/places/{id}/reviews, 최신순).
 * reportedByMe = 보는 사람이 이미 신고한 리뷰. 사진이 없으면 photos 는 빈 목록, 내용이 없으면 body 는 "".
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record PlaceReviewResponse(
    String id,
    int rating,
    String body,
    List<Photo> photos,
    Author author,
    String createdAt,
    boolean reportedByMe
) {
    public record Photo(String id, String url) {}

    /** 작성자 프로필과 그 사람의 전체 후기 수 · 별점 평균. 프로필을 꾸미지 않았으면 avatar* 는 null */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Author(String id, String nickname, String avatarUrl, String avatarEmoji, String avatarColor,
        int reviewCount, double ratingAvg) {}

    /** 지도 목록용 별점 요약 (GET /api/places/review-summary). 리뷰 없는 장소는 목록에서 빠짐 */
    public record Summary(String id, double rating, int count) {}

    /** 관리자 리뷰 신고 목록 한 줄 (GET /api/admin/place-review-reports). review 는 신고 당시 내용 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminReport(String id, String reviewKind, String reviewId, String placeId, String placeName,
        ReviewSnapshot review, String reason, String detail, Reporter reporter, String status, String createdAt) {}

    /** 신고 당시 리뷰. 리뷰를 지운 뒤에도 남고 deleted 가 true. 별점을 알 수 없으면 null */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record ReviewSnapshot(String author, String text, Integer rating, boolean deleted) {}

    public record Reporter(String id, String nickname) {}
}

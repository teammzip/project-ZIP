package com.zip.backend.map;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 장소 리뷰 · 리뷰 신고 (place_reviews · kakao_place_reviews · place_review_reports).
 * 리뷰 표가 두 개라 "종류(kind)"로 구분해요: PLACE = DB 장소(place_reviews), KAKAO = 카카오 검색 장소(kakao_place_reviews) */
@Repository
public class PlaceReviewRepository {
    private final JdbcTemplate jdbc;

    public PlaceReviewRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** 리뷰가 붙는 곳. DB 장소면 placeId, 카카오 장소면 kakaoPlaceId */
    public record Target(String kind, Long placeId, String kakaoPlaceId) {
        static Target place(long id) { return new Target(PlaceReviewService.PLACE, id, null); }
        static Target kakao(String id) { return new Target(PlaceReviewService.KAKAO, null, id); }
        boolean isKakao() { return PlaceReviewService.KAKAO.equals(kind); }
        String key() { return isKakao() ? MapService.KAKAO_ID + kakaoPlaceId : Long.toString(placeId); }
        private String table() { return isKakao() ? "kakao_place_reviews" : "place_reviews"; }
        private String column() { return isKakao() ? "kakao_place_id" : "place_id"; }
        private Object value() { return isKakao() ? kakaoPlaceId : placeId; }
    }

    public record ReviewRow(long id, int rating, String body, long authorId, String authorNickname, Instant createdAt) {}

    private static ReviewRow review(ResultSet rs, int row) throws SQLException {
        return new ReviewRow(rs.getLong("id"), rs.getInt("rating"), rs.getString("body"),
            rs.getLong("author_id"), rs.getString("nickname"), rs.getTimestamp("created_at").toInstant());
    }

    /** DB 장소 이름 (없으면 빈 값) */
    public Optional<String> placeName(long placeId) {
        return jdbc.queryForList("SELECT name FROM places WHERE id = ?", String.class, placeId).stream().findFirst();
    }

    /** 이 장소의 리뷰, 최신순 */
    public List<ReviewRow> reviews(Target target) {
        return jdbc.query("SELECT r.id, r.rating, r.body, r.created_at, u.id AS author_id, u.nickname FROM " + target.table() + " r"
            + " JOIN users u ON u.id = r.user_id WHERE r." + target.column() + " = ? ORDER BY r.created_at DESC, r.id DESC",
            PlaceReviewRepository::review, target.value());
    }

    /** 내가 이 장소 리뷰 중 신고한 것 (리뷰 id) */
    public List<Long> reportedByMe(long userId, Target target) {
        return jdbc.queryForList("SELECT pr.review_id FROM place_review_reports pr JOIN " + target.table() + " r ON r.id = pr.review_id"
            + " WHERE pr.reporter_id = ? AND pr.review_kind = ? AND r." + target.column() + " = ?", Long.class, userId, target.kind(), target.value());
    }

    /** 리뷰 쓰기. 같은 사람이 같은 곳에 또 쓰면 DuplicateKeyException (uk_place_reviews_place_id_user_id · uk_kakao_place_reviews_place_user) */
    public void addReview(Target target, long userId, String placeName, int rating, String body) {
        if (target.isKakao()) {
            jdbc.update("INSERT INTO kakao_place_reviews (kakao_place_id, user_id, name, rating, body) VALUES (?, ?, ?, ?, ?)",
                target.kakaoPlaceId(), userId, placeName, rating, body);
        } else {
            jdbc.update("INSERT INTO place_reviews (place_id, user_id, rating, body) VALUES (?, ?, ?, ?)", target.placeId(), userId, rating, body);
        }
        refreshPlaceRating(target);
    }

    /** 내 리뷰 고치기. 고친 줄 수 (내 리뷰가 없으면 0) */
    public int updateMyReview(Target target, long userId, int rating, String body) {
        int updated = jdbc.update("UPDATE " + target.table() + " SET rating = ?, body = ? WHERE " + target.column() + " = ? AND user_id = ?",
            rating, body, target.value(), userId);
        if (updated > 0) refreshPlaceRating(target);
        return updated;
    }

    /** 내 리뷰 지우기. 지운 줄 수 */
    public int deleteMyReview(Target target, long userId) {
        int deleted = jdbc.update("DELETE FROM " + target.table() + " WHERE " + target.column() + " = ? AND user_id = ?", target.value(), userId);
        if (deleted > 0) refreshPlaceRating(target);
        return deleted;
    }

    /** DB 장소는 places.rating_avg · review_count 를 다시 계산 (카카오 장소는 장소 표가 없어 할 일 없음) */
    private void refreshPlaceRating(Target target) {
        if (target.isKakao()) return;
        jdbc.update("""
            UPDATE places SET
            rating_avg = (SELECT ROUND(AVG(rating), 1) FROM place_reviews WHERE place_id = ?),
            review_count = (SELECT COUNT(*) FROM place_reviews WHERE place_id = ?)
            WHERE id = ?
            """, target.placeId(), target.placeId(), target.placeId());
    }

    /** 목록용 별점 요약: 장소 키("12" · "kakao:123") → (평균, 수). 리뷰 없는 곳은 빠져요 */
    public record Summary(double rating, int count) {}

    public Map<String, Summary> summaries(Collection<Long> placeIds, Collection<String> kakaoPlaceIds) {
        var result = new HashMap<String, Summary>();
        if (!placeIds.isEmpty()) {
            jdbc.query("SELECT place_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM place_reviews WHERE place_id IN (" + marks(placeIds.size()) + ") GROUP BY place_id",
                rs -> { result.put(Long.toString(rs.getLong("place_id")), new Summary(round(rs.getDouble("avg_rating")), rs.getInt("cnt"))); },
                placeIds.toArray());
        }
        if (!kakaoPlaceIds.isEmpty()) {
            jdbc.query("SELECT kakao_place_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM kakao_place_reviews WHERE kakao_place_id IN (" + marks(kakaoPlaceIds.size()) + ") GROUP BY kakao_place_id",
                rs -> { result.put(MapService.KAKAO_ID + rs.getString("kakao_place_id"), new Summary(round(rs.getDouble("avg_rating")), rs.getInt("cnt"))); },
                kakaoPlaceIds.toArray());
        }
        return result;
    }

    private static String marks(int n) { return String.join(",", java.util.Collections.nCopies(n, "?")); }

    private static double round(double value) { return Math.round(value * 10) / 10.0; }

    /** 내가 쓴 리뷰 (두 표를 합쳐 최신순) */
    public record MyReviewRow(String placeKey, String placeName, long id, int rating, String body, Instant createdAt) {}

    public List<MyReviewRow> myReviews(long userId) {
        var rows = new ArrayList<MyReviewRow>();
        rows.addAll(jdbc.query("""
            SELECT r.id, r.place_id, p.name, r.rating, r.body, r.created_at FROM place_reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = ?
            """, (rs, row) -> new MyReviewRow(Long.toString(rs.getLong("place_id")), rs.getString("name"), rs.getLong("id"), rs.getInt("rating"),
                rs.getString("body"), rs.getTimestamp("created_at").toInstant()), userId));
        rows.addAll(jdbc.query("SELECT id, kakao_place_id, name, rating, body, created_at FROM kakao_place_reviews WHERE user_id = ?",
            (rs, row) -> new MyReviewRow(MapService.KAKAO_ID + rs.getString("kakao_place_id"), rs.getString("name"), rs.getLong("id"), rs.getInt("rating"),
                rs.getString("body"), rs.getTimestamp("created_at").toInstant()), userId));
        rows.sort((a, b) -> a.createdAt().equals(b.createdAt()) ? Long.compare(b.id(), a.id()) : b.createdAt().compareTo(a.createdAt()));
        return rows;
    }

    // ---------- 신고 ----------

    /** 신고할 리뷰 (이 장소의 리뷰일 때만): 작성자, 닉네임, 별점, 내용, 장소 이름 */
    public record ReviewForReport(long authorId, String authorNickname, int rating, String body, String placeName) {}

    public Optional<ReviewForReport> reviewForReport(Target target, long reviewId) {
        String sql = target.isKakao()
            ? "SELECT r.user_id, u.nickname, r.rating, r.body, r.name AS place_name FROM kakao_place_reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ? AND r.kakao_place_id = ?"
            : "SELECT r.user_id, u.nickname, r.rating, r.body, p.name AS place_name FROM place_reviews r JOIN users u ON u.id = r.user_id JOIN places p ON p.id = r.place_id WHERE r.id = ? AND r.place_id = ?";
        return jdbc.query(sql, (rs, row) -> new ReviewForReport(rs.getLong("user_id"), rs.getString("nickname"), rs.getInt("rating"),
            rs.getString("body"), rs.getString("place_name")), reviewId, target.value()).stream().findFirst();
    }

    /** 같은 사람이 같은 리뷰를 또 신고하면 DuplicateKeyException (uk_place_review_reports_reporter_target) */
    public void insertReport(long reporterId, Target target, long reviewId, String placeName, String reason, String detail,
        String authorSnapshot, String textSnapshot, int ratingSnapshot) {
        jdbc.update("""
            INSERT INTO place_review_reports (reporter_id, review_kind, review_id, place_key, place_name_snapshot, reason, detail,
              target_author_snapshot, target_text_snapshot, target_rating_snapshot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, reporterId, target.kind(), reviewId, target.key(), placeName, reason, detail, authorSnapshot, textSnapshot, ratingSnapshot);
    }

    public record AdminReportRow(long id, String kind, long reviewId, String placeKey, String placeName, String author, String text, Integer rating,
        boolean gone, String reason, String detail, long reporterId, String reporterNickname, String status, Instant createdAt) {}

    /** 관리자 리뷰 신고 목록 (status 가 null 이면 전부). gone = 리뷰가 지금 없음 (지워짐) */
    public List<AdminReportRow> adminReports(String status) {
        var sql = """
            SELECT r.id, r.review_kind, r.review_id, r.place_key, r.place_name_snapshot, r.target_author_snapshot, r.target_text_snapshot,
                   r.target_rating_snapshot, r.reason, r.detail, r.status, r.created_at, r.reporter_id, ru.nickname AS reporter_nickname,
                   CASE WHEN r.review_kind = 'PLACE' THEN (pr.id IS NULL) ELSE (kr.id IS NULL) END AS gone
            FROM place_review_reports r
            JOIN users ru ON ru.id = r.reporter_id
            LEFT JOIN place_reviews pr ON r.review_kind = 'PLACE' AND pr.id = r.review_id
            LEFT JOIN kakao_place_reviews kr ON r.review_kind = 'KAKAO' AND kr.id = r.review_id
            """ + (status == null ? "" : " WHERE r.status = ?") + " ORDER BY r.created_at DESC, r.id DESC LIMIT 500";
        org.springframework.jdbc.core.RowMapper<AdminReportRow> mapper = (rs, row) -> {
            int rating = rs.getInt("target_rating_snapshot");
            Integer ratingSnapshot = rs.wasNull() ? null : rating;
            return new AdminReportRow(rs.getLong("id"), rs.getString("review_kind"), rs.getLong("review_id"), rs.getString("place_key"),
                rs.getString("place_name_snapshot"), rs.getString("target_author_snapshot"), rs.getString("target_text_snapshot"), ratingSnapshot,
                rs.getBoolean("gone"), rs.getString("reason"), rs.getString("detail"), rs.getLong("reporter_id"), rs.getString("reporter_nickname"),
                rs.getString("status"), rs.getTimestamp("created_at").toInstant());
        };
        return status == null ? jdbc.query(sql, mapper) : jdbc.query(sql, mapper, status);
    }

    /** 신고 한 건이 가리키는 리뷰 (종류, 리뷰 id, 장소 키) */
    public record ReportRef(String kind, long reviewId, String placeKey) {}

    public Optional<ReportRef> reportRef(long reportId) {
        return jdbc.query("SELECT review_kind, review_id, place_key FROM place_review_reports WHERE id = ?",
            (rs, row) -> new ReportRef(rs.getString(1), rs.getLong(2), rs.getString(3)), reportId).stream().findFirst();
    }

    /** 리뷰 작성자 · 내용 · 장소 (지워졌으면 없음) */
    public record StoredReview(long authorId, String body, String placeName, Long placeId) {}

    public Optional<StoredReview> storedReview(String kind, long reviewId) {
        String sql = PlaceReviewService.KAKAO.equals(kind)
            ? "SELECT user_id, body, name, NULL AS place_id FROM kakao_place_reviews WHERE id = ?"
            : "SELECT r.user_id, r.body, p.name, r.place_id FROM place_reviews r JOIN places p ON p.id = r.place_id WHERE r.id = ?";
        return jdbc.query(sql, (rs, row) -> {
            long placeId = rs.getLong(4);
            return new StoredReview(rs.getLong(1), rs.getString(2), rs.getString(3), rs.wasNull() ? null : placeId);
        }, reviewId).stream().findFirst();
    }

    /** 운영자가 리뷰 지우기 (DB 장소면 평균 별점 다시 계산) */
    public void deleteReview(String kind, long reviewId, Long placeId) {
        if (PlaceReviewService.KAKAO.equals(kind)) {
            jdbc.update("DELETE FROM kakao_place_reviews WHERE id = ?", reviewId);
            return;
        }
        jdbc.update("DELETE FROM place_reviews WHERE id = ?", reviewId);
        if (placeId != null) refreshPlaceRating(Target.place(placeId));
    }

    /** 이 리뷰에 들어온 접수 중 신고 전부 처리. 바뀐 줄 수 */
    public int resolveReports(String kind, long reviewId, String status, long adminId, Instant now) {
        return jdbc.update("""
            UPDATE place_review_reports SET status = ?, handled_by = ?, handled_at = ?
            WHERE review_kind = ? AND review_id = ? AND status = 'RECEIVED'
            """, status, adminId, Timestamp.from(now), kind, reviewId);
    }
}

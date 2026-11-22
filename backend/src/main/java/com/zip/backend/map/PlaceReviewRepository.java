package com.zip.backend.map;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 장소 리뷰 · 리뷰 신고 (place_reviews · kakao_place_reviews · place_review_reports).
 * 리뷰 표가 두 개라 "종류(kind)"로 구분해요: PLACE = DB 장소(place_reviews), KAKAO = 카카오 검색 장소(kakao_place_reviews) */
@Repository
public class PlaceReviewRepository {
    private final JdbcTemplate jdbc;

    public PlaceReviewRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record MyReview(String id, String placeId, String placeName, int rating, String body, String createdAt) {}

    public List<MyReview> myReviews(long userId) {
        return jdbc.query("""
            SELECT r.id, CONCAT('', r.place_id) AS place_key, p.name, r.rating, COALESCE(r.body, '') AS body, r.created_at
            FROM place_reviews r JOIN places p ON p.id = r.place_id WHERE r.user_id = ?
            UNION ALL
            SELECT r.id, CONCAT('kakao:', r.kakao_place_id), r.name, r.rating, COALESCE(r.body, ''), r.created_at
            FROM kakao_place_reviews r WHERE r.user_id = ?
            ORDER BY created_at DESC, place_key, id DESC
            """, (rs, row) -> new MyReview(Long.toString(rs.getLong("id")), rs.getString("place_key"), rs.getString("name"),
                rs.getInt("rating"), rs.getString("body"), rs.getTimestamp("created_at").toInstant().toString()), userId, userId);
    }

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

    /** 리뷰 쓰기 → 새 리뷰 id. 같은 사람이 같은 곳에 또 쓰면 DuplicateKeyException (uk_place_reviews_place_id_user_id · uk_kakao_place_reviews_place_user) */
    public long addReview(Target target, long userId, String placeName, int rating, String body) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement ps;
            if (target.isKakao()) {
                ps = connection.prepareStatement("INSERT INTO kakao_place_reviews (kakao_place_id, user_id, name, rating, body) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
                ps.setString(1, target.kakaoPlaceId()); ps.setLong(2, userId); ps.setString(3, placeName); ps.setInt(4, rating); ps.setString(5, body);
            } else {
                ps = connection.prepareStatement("INSERT INTO place_reviews (place_id, user_id, rating, body) VALUES (?, ?, ?, ?)", new String[] {"id"});
                ps.setLong(1, target.placeId()); ps.setLong(2, userId); ps.setInt(3, rating); ps.setString(4, body);
            }
            return ps;
        }, keys);
        refreshPlaceRating(target);
        return keys.getKey().longValue();
    }

    /** 이 장소에 쓴 내 리뷰 id */
    public Optional<Long> myReviewId(Target target, long userId) {
        return jdbc.queryForList("SELECT id FROM " + target.table() + " WHERE " + target.column() + " = ? AND user_id = ?", Long.class, target.value(), userId)
            .stream().findFirst();
    }

    // ---------- 사진 (place_review_photos) ----------

    public record Photo(long fileId, String url) {}

    /** 리뷰들의 사진 (리뷰 id → 붙인 순서대로). 지운 파일은 빼요 */
    public Map<Long, List<Photo>> photos(String kind, Collection<Long> reviewIds) {
        if (reviewIds.isEmpty()) return Map.of();
        var result = new LinkedHashMap<Long, List<Photo>>();
        var args = new ArrayList<Object>(List.of(kind));
        args.addAll(reviewIds);
        jdbc.query("""
            SELECT p.review_id, f.id, f.storage_url FROM place_review_photos p JOIN uploaded_files f ON f.id = p.file_id
            WHERE p.review_kind = ? AND p.review_id IN (%s) AND f.deleted_at IS NULL ORDER BY p.review_id, p.sort_order
            """.formatted(marks(reviewIds.size())),
            rs -> { result.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(new Photo(rs.getLong(2), rs.getString(3))); },
            args.toArray());
        return result;
    }

    /** 사진으로 붙일 파일 (주인 · 형식 · 지움 검사용) */
    public record FileRow(long id, long userId, String type, boolean deleted) {}

    public List<FileRow> files(Collection<Long> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.query("SELECT id, user_id, mime_type, deleted_at FROM uploaded_files WHERE id IN (" + marks(ids.size()) + ") ORDER BY id FOR UPDATE",
            (rs, row) -> new FileRow(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getTimestamp(4) != null), ids.toArray());
    }

    /** 이 파일들이 다른 리뷰 · 커뮤니티 글 · 프로필 사진에 쓰이는지 (reviewId 는 지금 고치는 리뷰, 새 리뷰면 null) */
    public boolean filesInUse(Collection<Long> fileIds, String kind, Long reviewId) {
        if (fileIds.isEmpty()) return false;
        var m = marks(fileIds.size());
        var args = new ArrayList<Object>(fileIds);
        String otherReview = "";
        if (reviewId != null) {
            otherReview = " AND NOT (review_kind = ? AND review_id = ?)";
            args.add(kind);
            args.add(reviewId);
        }
        args.addAll(fileIds);
        args.addAll(fileIds);
        return jdbc.queryForObject("SELECT (SELECT COUNT(*) FROM place_review_photos WHERE file_id IN (" + m + ")" + otherReview + ")"
            + " + (SELECT COUNT(*) FROM post_attachments WHERE file_id IN (" + m + "))"
            + " + (SELECT COUNT(*) FROM user_profiles WHERE avatar_file_id IN (" + m + "))", Long.class, args.toArray()) > 0;
    }

    /** 리뷰 사진을 배열 순서대로 다시 씀 → 빠진 파일 id */
    public List<Long> replacePhotos(String kind, long reviewId, List<Long> fileIds) {
        var before = jdbc.queryForList("SELECT file_id FROM place_review_photos WHERE review_kind = ? AND review_id = ?", Long.class, kind, reviewId);
        jdbc.update("DELETE FROM place_review_photos WHERE review_kind = ? AND review_id = ?", kind, reviewId);
        var rows = new ArrayList<Object[]>();
        for (int i = 0; i < fileIds.size(); i++) rows.add(new Object[] {kind, reviewId, fileIds.get(i), i});
        if (!rows.isEmpty()) jdbc.batchUpdate("INSERT INTO place_review_photos (review_kind, review_id, file_id, sort_order) VALUES (?, ?, ?, ?)", rows);
        return before.stream().filter(id -> !fileIds.contains(id)).toList();
    }

    /** 빠진 사진 파일을 지운 것으로 표시하고 저장 주소를 돌려줌 (실제 파일은 커밋 뒤 삭제) */
    public List<String> markFilesDeleted(List<Long> fileIds, Instant now) {
        if (fileIds.isEmpty()) return List.of();
        var m = marks(fileIds.size());
        var urls = jdbc.queryForList("SELECT storage_url FROM uploaded_files WHERE id IN (" + m + ")", String.class, fileIds.toArray());
        var args = new ArrayList<Object>(List.of(Timestamp.from(now)));
        args.addAll(fileIds);
        jdbc.update("UPDATE uploaded_files SET deleted_at = ? WHERE id IN (" + m + ")", args.toArray());
        return urls;
    }

    // ---------- 작성자 정보 (후기 수 · 별점 평균 · 프로필 모양) ----------

    public record AuthorStat(int count, double rating) {}

    /** 작성자별 후기 수 · 별점 평균 (DB 장소 + 카카오 장소 리뷰 합쳐서) */
    public Map<Long, AuthorStat> authorStats(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        var sums = new HashMap<Long, long[]>();
        for (var table : List.of("place_reviews", "kakao_place_reviews")) {
            jdbc.query("SELECT user_id, COUNT(*), SUM(rating) FROM " + table + " WHERE user_id IN (" + marks(userIds.size()) + ") GROUP BY user_id",
                rs -> {
                    var sum = sums.computeIfAbsent(rs.getLong(1), k -> new long[2]);
                    sum[0] += rs.getLong(2);
                    sum[1] += rs.getLong(3);
                }, userIds.toArray());
        }
        var result = new HashMap<Long, AuthorStat>();
        sums.forEach((id, sum) -> result.put(id, new AuthorStat((int) sum[0], sum[0] == 0 ? 0 : round((double) sum[1] / sum[0]))));
        return result;
    }

    public record AuthorLook(String avatarUrl, String avatarEmoji, String avatarColor) {}

    /** 작성자 프로필 모양 (사진 · 캐릭터 · 색). 프로필이 없으면 빠져요 */
    public Map<Long, AuthorLook> authorLooks(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        var result = new HashMap<Long, AuthorLook>();
        jdbc.query("""
            SELECT p.user_id, f.storage_url, p.avatar_emoji, p.avatar_color FROM user_profiles p
            LEFT JOIN uploaded_files f ON f.id = p.avatar_file_id AND f.deleted_at IS NULL
            WHERE p.user_id IN (%s)
            """.formatted(marks(userIds.size())),
            rs -> { result.put(rs.getLong(1), new AuthorLook(rs.getString(2), rs.getString(3), rs.getString(4))); }, userIds.toArray());
        return result;
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

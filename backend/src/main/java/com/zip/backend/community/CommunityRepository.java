package com.zip.backend.community;

import com.zip.backend.common.Sql;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 커뮤니티 표: posts · comments · post_likes · post_attachments · reports (db/schema.sql 4장) */
@Repository
public class CommunityRepository {
    private final JdbcTemplate jdbc;

    public CommunityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record PostRow(long id, long userId, long regionId, String regionName, String category, String title, String body,
        int likes, int comments, boolean homeTip, String nickname, boolean liked, boolean reported, Instant createdAt, Instant updatedAt) {}

    public record CommentRow(long id, long postId, long userId, String nickname, String body, boolean reported, boolean staff, Long parentId, Instant createdAt) {}

    /** 댓글 목록 · 한 개 공통 (? = 보는 사람: 내가 신고했는지) */
    private static final String COMMENT_SQL = """
        SELECT c.id, c.post_id, c.user_id, u.nickname, u.role, c.body, c.created_at, c.parent_id,
               EXISTS (SELECT 1 FROM reports x WHERE x.target_type = 'COMMENT' AND x.target_id = c.id AND x.reporter_id = ?) AS reported
        FROM comments c JOIN users u ON u.id = c.user_id
        """;

    private static CommentRow comment(ResultSet rs, int row) throws SQLException {
        return new CommentRow(rs.getLong("id"), rs.getLong("post_id"), rs.getLong("user_id"), rs.getString("nickname"), rs.getString("body"),
            rs.getBoolean("reported"), "ADMIN".equals(rs.getString("role")), parentId(rs), instant(rs, "created_at"));
    }

    private static Long parentId(ResultSet rs) throws SQLException {
        long value = rs.getLong("parent_id");
        return rs.wasNull() ? null : value;
    }

    public record AttachmentRow(long postId, long fileId, String name, String type, long size, String url) {}

    public record FileRow(long id, long userId, String type, long size, boolean deleted) {}

    /** 글 목록 · 상세 공통: 글쓴이 닉네임, 동네 이름("서울특별시 마포구"), 내가 공감했는지 · 신고했는지 */
    private static final String POST_SQL = """
        SELECT p.id, p.user_id, p.region_id, r.name AS region_name, pr.name AS parent_name, p.category, p.title, p.body,
               p.like_count, p.comment_count, p.is_home_tip, p.created_at, p.updated_at, u.nickname,
               EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
               EXISTS (SELECT 1 FROM reports x WHERE x.target_type = 'POST' AND x.target_id = p.id AND x.reporter_id = ?) AS reported
        FROM posts p
        JOIN users u ON u.id = p.user_id
        JOIN regions r ON r.id = p.region_id
        LEFT JOIN regions pr ON pr.id = r.parent_id
        """;

    private static PostRow post(ResultSet rs, int row) throws SQLException {
        String parent = rs.getString("parent_name");
        String region = parent == null ? rs.getString("region_name") : parent + " " + rs.getString("region_name");
        return new PostRow(rs.getLong("id"), rs.getLong("user_id"), rs.getLong("region_id"), region, rs.getString("category"),
            rs.getString("title"), rs.getString("body"), rs.getInt("like_count"), rs.getInt("comment_count"),
            rs.getBoolean("is_home_tip"), rs.getString("nickname"), rs.getBoolean("liked"), rs.getBoolean("reported"),
            instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    public Optional<Long> userRegion(long userId) {
        return jdbc.query("SELECT region_id FROM users WHERE id = ?", (rs, row) -> {
            long id = rs.getLong(1);
            return rs.wasNull() ? null : id;
        }, userId).stream().filter(java.util.Objects::nonNull).findFirst();
    }

    /** 우리 동네 + 주변 동네 (region_neighbors) */
    public List<Long> regionWithNeighbors(long regionId) {
        var ids = new ArrayList<Long>(List.of(regionId));
        ids.addAll(jdbc.queryForList("SELECT neighbor_region_id FROM region_neighbors WHERE region_id = ?", Long.class, regionId));
        return ids;
    }

    /** 보이는 글 목록, 새 글부터. regions 가 null 이면 전체 동네. limit+1 개를 읽어 다음 쪽이 있는지 판단은 부르는 쪽에서 */
    public List<PostRow> posts(long viewerId, List<Long> regions, String category, String keyword, int limit, int offset) {
        var sql = new StringBuilder(POST_SQL).append(" WHERE p.status = 'VISIBLE'");
        var args = new ArrayList<Object>(List.of(viewerId, viewerId));
        if (regions != null) {
            sql.append(" AND p.region_id IN (").append(Sql.marks(regions)).append(")");
            args.addAll(regions);
        }
        if (category != null) {
            sql.append(" AND p.category = ?");
            args.add(category);
        }
        if (keyword != null) {
            sql.append(" AND (p.title LIKE ? ESCAPE '!' OR p.body LIKE ? ESCAPE '!')");
            var like = Sql.likeContains(keyword);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?");
        args.add(limit);
        args.add(offset);
        return jdbc.query(sql.toString(), CommunityRepository::post, args.toArray());
    }

    public List<PostRow> homeTips(long viewerId, int limit) {
        return jdbc.query(POST_SQL + " WHERE p.status = 'VISIBLE' AND p.is_home_tip = 1 ORDER BY p.created_at DESC, p.id DESC LIMIT ?",
            CommunityRepository::post, viewerId, viewerId, limit);
    }

    public Optional<PostRow> visiblePost(long viewerId, long postId) {
        return jdbc.query(POST_SQL + " WHERE p.id = ? AND p.status = 'VISIBLE'", CommunityRepository::post, viewerId, viewerId, postId)
            .stream().findFirst();
    }

    /** 수정 · 삭제 전에 글 줄을 잠금 (같은 글을 동시에 고칠 때) */
    public Optional<Long> lockVisiblePostOwner(long postId) {
        return jdbc.queryForList("SELECT user_id FROM posts WHERE id = ? AND status = 'VISIBLE' FOR UPDATE", Long.class, postId)
            .stream().findFirst();
    }

    /** 여러 글의 보이는 댓글을 한 번에 (글 번호 → 오래된 것부터) */
    public Map<Long, List<CommentRow>> comments(long viewerId, List<Long> postIds) {
        if (postIds.isEmpty()) return Map.of();
        var args = new ArrayList<Object>(List.of(viewerId));
        args.addAll(postIds);
        return jdbc.query(COMMENT_SQL + " WHERE c.post_id IN (" + Sql.marks(postIds) + ") AND c.status = 'VISIBLE' ORDER BY c.created_at, c.id",
                CommunityRepository::comment, args.toArray())
            .stream().collect(Collectors.groupingBy(CommentRow::postId, LinkedHashMap::new, Collectors.toList()));
    }

    public Optional<CommentRow> visibleComment(long viewerId, long commentId) {
        return jdbc.query(COMMENT_SQL + " JOIN posts p ON p.id = c.post_id WHERE c.id = ? AND c.status = 'VISIBLE' AND p.status = 'VISIBLE'",
            CommunityRepository::comment, viewerId, commentId).stream().findFirst();
    }

    /** 답글을 달 댓글: 보이는 댓글이면 그 글 번호와 그 댓글의 부모(없으면 null) */
    public record ReplyTarget(long postId, Long parentId) {}

    public Optional<ReplyTarget> replyTarget(long commentId) {
        return jdbc.query("SELECT post_id, parent_id FROM comments WHERE id = ? AND status = 'VISIBLE'",
            (rs, row) -> new ReplyTarget(rs.getLong("post_id"), parentId(rs)), commentId).stream().findFirst();
    }

    /** 여러 글의 첨부를 한 번에 (글 번호 → 붙인 순서대로) */
    public Map<Long, List<AttachmentRow>> attachments(List<Long> postIds) {
        if (postIds.isEmpty()) return Map.of();
        return jdbc.query("""
            SELECT a.post_id, f.id, f.original_name, f.mime_type, f.size_bytes, f.storage_url
            FROM post_attachments a JOIN uploaded_files f ON f.id = a.file_id
            WHERE a.post_id IN (%s) AND f.deleted_at IS NULL ORDER BY a.post_id, a.sort_order
            """.formatted(Sql.marks(postIds)),
            (rs, row) -> new AttachmentRow(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getLong(5), rs.getString(6)),
            postIds.toArray()).stream().collect(Collectors.groupingBy(AttachmentRow::postId, LinkedHashMap::new, Collectors.toList()));
    }

    /** 첨부로 쓸 파일 (주인 · 형식 · 크기 검사용) */
    public List<FileRow> files(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.query("SELECT id, user_id, mime_type, size_bytes, deleted_at FROM uploaded_files WHERE id IN (" + Sql.marks(ids) + ")",
            (rs, row) -> new FileRow(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getLong(4), rs.getTimestamp(5) != null),
            ids.toArray());
    }

    /** 이 파일들 중 하나라도 다른 글에 붙어 있거나(exceptPost 는 지금 고치는 글) 프로필 사진으로 쓰이는지 */
    public boolean filesInUse(List<Long> fileIds, Long exceptPost) {
        if (fileIds.isEmpty()) return false;
        var marks = Sql.marks(fileIds);
        var args = new ArrayList<Object>(fileIds);
        var otherPost = "";
        if (exceptPost != null) {
            otherPost = " AND post_id <> ?";
            args.add(exceptPost);
        }
        args.addAll(fileIds);
        return jdbc.queryForObject("SELECT (SELECT COUNT(*) FROM post_attachments WHERE file_id IN (" + marks + ")" + otherPost
            + ") + (SELECT COUNT(*) FROM user_profiles WHERE avatar_file_id IN (" + marks + "))", Long.class, args.toArray()) > 0;
    }

    public long insertPost(long userId, long regionId, String category, String title, String body) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO posts (user_id, region_id, category, title, body) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, userId); ps.setLong(2, regionId); ps.setString(3, category); ps.setString(4, title); ps.setString(5, body);
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void updatePost(long postId, String category, String title, String body) {
        jdbc.update("UPDATE posts SET category = ?, title = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", category, title, body, postId);
    }

    /** 지운 사람(작성자 본인 또는 운영자) · 운영자가 지운 사유(본인 삭제는 null)를 같이 남김 */
    public void deletePost(long postId, Instant now, long deletedBy, String reason) {
        jdbc.update("UPDATE posts SET status = 'DELETED', deleted_at = ?, deleted_by = ?, delete_reason = ? WHERE id = ?",
            Timestamp.from(now), deletedBy, reason, postId);
    }

    /** 첨부 연결을 배열 순서대로 다시 씀. 빠진 파일 id 를 돌려줌 */
    public List<Long> replaceAttachments(long postId, List<Long> fileIds) {
        var before = jdbc.queryForList("SELECT file_id FROM post_attachments WHERE post_id = ?", Long.class, postId);
        jdbc.update("DELETE FROM post_attachments WHERE post_id = ?", postId);
        var rows = new ArrayList<Object[]>();
        for (int i = 0; i < fileIds.size(); i++) rows.add(new Object[] {postId, fileIds.get(i), i});
        if (!rows.isEmpty()) jdbc.batchUpdate("INSERT INTO post_attachments (post_id, file_id, sort_order) VALUES (?, ?, ?)", rows);
        return before.stream().filter(id -> !fileIds.contains(id)).toList();
    }

    /** 빠진 첨부 파일을 지운 것으로 표시하고 저장 주소를 돌려줌 (실제 파일은 커밋 뒤 삭제) */
    public List<String> markFilesDeleted(List<Long> fileIds, Instant now) {
        if (fileIds.isEmpty()) return List.of();
        var marks = Sql.marks(fileIds);
        var urls = jdbc.queryForList("SELECT storage_url FROM uploaded_files WHERE id IN (" + marks + ")", String.class, fileIds.toArray());
        var args = new ArrayList<Object>(List.of(Timestamp.from(now)));
        args.addAll(fileIds);
        jdbc.update("UPDATE uploaded_files SET deleted_at = ? WHERE id IN (" + marks + ")", args.toArray());
        return urls;
    }

    /** 공감 (두 번 눌러도 한 번만) */
    public void addLike(long postId, long userId) {
        try {
            jdbc.update("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)", postId, userId);
        } catch (org.springframework.dao.DuplicateKeyException alreadyLiked) {
            return;
        }
        jdbc.update("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", postId);
    }

    public void removeLike(long postId, long userId) {
        int deleted = jdbc.update("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", postId, userId);
        if (deleted > 0) jdbc.update("UPDATE posts SET like_count = like_count - 1 WHERE id = ? AND like_count > 0", postId);
    }

    public int likeCount(long postId) {
        return jdbc.queryForObject("SELECT like_count FROM posts WHERE id = ?", Integer.class, postId);
    }

    public long insertComment(long postId, long userId, String body, Long parentId) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO comments (post_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, postId); ps.setLong(2, userId); ps.setString(3, body);
            if (parentId == null) ps.setNull(4, java.sql.Types.BIGINT); else ps.setLong(4, parentId);
            return ps;
        }, keys);
        jdbc.update("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?", postId);
        return keys.getKey().longValue();
    }

    /** 잠근 댓글의 주인과 글 번호 */
    public record CommentLock(long ownerId, long postId) {}

    /** 수정 · 삭제 전에 댓글 줄을 잠금 */
    public Optional<CommentLock> lockVisibleComment(long commentId) {
        return jdbc.query("""
            SELECT c.user_id, c.post_id FROM comments c JOIN posts p ON p.id = c.post_id
            WHERE c.id = ? AND c.status = 'VISIBLE' AND p.status = 'VISIBLE' FOR UPDATE
            """, (rs, row) -> new CommentLock(rs.getLong(1), rs.getLong(2)), commentId).stream().findFirst();
    }

    public void updateComment(long commentId, String body) {
        jdbc.update("UPDATE comments SET body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", body, commentId);
    }

    public void deleteComment(long commentId, long postId, Instant now, long deletedBy, String reason) {
        jdbc.update("UPDATE comments SET status = 'DELETED', deleted_at = ?, deleted_by = ?, delete_reason = ? WHERE id = ?",
            Timestamp.from(now), deletedBy, reason, commentId);
        jdbc.update("UPDATE posts SET comment_count = comment_count - 1 WHERE id = ? AND comment_count > 0", postId);
    }

    /** 신고 대상의 (작성자 id, 작성자 닉네임, 제목 또는 댓글 내용). 보이는 대상만 */
    public record ReportTarget(long authorId, String authorNickname, String text) {}

    public Optional<ReportTarget> reportTarget(String type, long targetId) {
        String sql = type.equals("POST")
            ? "SELECT p.user_id, u.nickname, p.title FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ? AND p.status = 'VISIBLE'"
            : """
              SELECT c.user_id, u.nickname, c.body FROM comments c JOIN users u ON u.id = c.user_id JOIN posts p ON p.id = c.post_id
              WHERE c.id = ? AND c.status = 'VISIBLE' AND p.status = 'VISIBLE'
              """;
        return jdbc.query(sql, (rs, row) -> new ReportTarget(rs.getLong(1), rs.getString(2), rs.getString(3)), targetId).stream().findFirst();
    }

    /** 같은 사람이 같은 대상을 이미 신고했으면 DuplicateKeyException (uk_reports_reporter_target) */
    public void insertReport(long reporterId, String type, long targetId, String reason, String detail, String authorSnapshot, String textSnapshot) {
        jdbc.update("""
            INSERT INTO reports (reporter_id, target_type, target_id, reason, detail, target_author_snapshot, target_text_snapshot)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, reporterId, type, targetId, reason, detail, authorSnapshot, textSnapshot);
    }

    // ---------- 관리자 (/api/admin/**) ----------

    public void setHomeTip(long postId, boolean on) {
        jdbc.update("UPDATE posts SET is_home_tip = ? WHERE id = ?", on, postId);
    }

    /** 신고 처리 상태 바꾸기 (대상 하나에 들어온 접수 중 신고 전부). 바뀐 줄 수 */
    public int resolveReports(String type, long targetId, String status, long adminId, Instant now) {
        return jdbc.update("""
            UPDATE reports SET status = ?, handled_by = ?, handled_at = ?
            WHERE target_type = ? AND target_id = ? AND status = 'RECEIVED'
            """, status, adminId, Timestamp.from(now), type, targetId);
    }

    /** 이 글의 보이는 댓글들에 들어온 접수 중 신고를 한꺼번에 (관리자가 글을 지울 때). 바뀐 줄 수 */
    public int resolveCommentReportsOfPost(long postId, String status, long adminId, Instant now) {
        return jdbc.update("""
            UPDATE reports SET status = ?, handled_by = ?, handled_at = ?
            WHERE target_type = 'COMMENT' AND status = 'RECEIVED'
              AND target_id IN (SELECT id FROM comments WHERE post_id = ? AND status = 'VISIBLE')
            """, status, adminId, Timestamp.from(now), postId);
    }

    /** 신고 대상 (종류 POST · COMMENT, 번호) */
    public record TargetRef(String type, long id) {}

    public Optional<TargetRef> reportTargetOf(long reportId) {
        return jdbc.query("SELECT target_type, target_id FROM reports WHERE id = ?", (rs, row) -> new TargetRef(rs.getString(1), rs.getLong(2)), reportId)
            .stream().findFirst();
    }

    /** 숨김: 글이면 HIDDEN, 댓글이면 HIDDEN + 댓글 수 줄이기 (이미 안 보이면 그대로) */
    public void hideTarget(String type, long targetId, long adminId, String reason) {
        if (type.equals("POST")) {
            jdbc.update("UPDATE posts SET status = 'HIDDEN', deleted_by = ?, delete_reason = ? WHERE id = ? AND status = 'VISIBLE'", adminId, reason, targetId);
            return;
        }
        var postIds = jdbc.queryForList("SELECT post_id FROM comments WHERE id = ? AND status = 'VISIBLE'", Long.class, targetId);
        if (postIds.isEmpty()) return;
        jdbc.update("UPDATE comments SET status = 'HIDDEN', deleted_by = ?, delete_reason = ? WHERE id = ?", adminId, reason, targetId);
        jdbc.update("UPDATE posts SET comment_count = comment_count - 1 WHERE id = ? AND comment_count > 0", postIds.get(0));
    }

    public record AdminReportRow(long id, String targetType, long targetId, Long postId, String targetAuthor, String targetText,
        boolean gone, String deleteReason, String reason, String detail, long reporterId, String reporterNickname, String status, Instant createdAt) {}

    /** 관리자 신고 목록 (status 가 null 이면 전부). postId = 글이면 그 글, 댓글이면 댓글이 달린 글. gone = 대상이 지금 안 보임 */
    public List<AdminReportRow> adminReports(String status) {
        var sql = """
            SELECT r.id, r.target_type, r.target_id, r.reason, r.detail, r.status, r.created_at,
                   r.target_author_snapshot, r.target_text_snapshot, r.reporter_id, ru.nickname AS reporter_nickname,
                   CASE WHEN r.target_type = 'POST' THEN r.target_id ELSE c.post_id END AS post_id,
                   CASE WHEN r.target_type = 'POST' THEN (p.status IS NULL OR p.status <> 'VISIBLE')
                        ELSE (c.status IS NULL OR c.status <> 'VISIBLE' OR cp.status <> 'VISIBLE') END AS gone,
                   CASE WHEN r.target_type = 'POST' THEN p.delete_reason ELSE COALESCE(c.delete_reason, cp.delete_reason) END AS delete_reason
            FROM reports r
            JOIN users ru ON ru.id = r.reporter_id
            LEFT JOIN posts p ON r.target_type = 'POST' AND p.id = r.target_id
            LEFT JOIN comments c ON r.target_type = 'COMMENT' AND c.id = r.target_id
            LEFT JOIN posts cp ON cp.id = c.post_id
            """ + (status == null ? "" : " WHERE r.status = ?") + " ORDER BY r.created_at DESC, r.id DESC LIMIT 500";
        RowMapper<AdminReportRow> mapper = (rs, row) -> {
            long postId = rs.getLong("post_id");
            Long post = rs.wasNull() ? null : postId;
            return new AdminReportRow(rs.getLong("id"), rs.getString("target_type"), rs.getLong("target_id"), post,
                rs.getString("target_author_snapshot"), rs.getString("target_text_snapshot"), rs.getBoolean("gone"), rs.getString("delete_reason"), rs.getString("reason"),
                rs.getString("detail"), rs.getLong("reporter_id"), rs.getString("reporter_nickname"), rs.getString("status"), instant(rs, "created_at"));
        };
        return status == null ? jdbc.query(sql, mapper) : jdbc.query(sql, mapper, status);
    }
}

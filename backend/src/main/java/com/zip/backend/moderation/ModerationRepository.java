package com.zip.backend.moderation;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import com.zip.backend.common.Sql;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 회원 관리 · 경고 · 정지 (users · user_sanctions · posts · comments). frontend/API.md 11장 */
@Repository
public class ModerationRepository {
    private final JdbcTemplate jdbc;

    public ModerationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** 회원 한 줄: 글 · 댓글 수(보이는 것), 경고 · 정지 횟수(해제 · 만료돼도 남음), 지금 정지 중인지 */
    // provider: 가입 방식(EMAIL/KAKAO/GOOGLE/NAVER). 소셜 가입은 아이디(username)가 없어서, 관리자 화면이 어디로 가입했는지 보여 주려고 추가했다.
    public record MemberRow(long id, String nickname, String username, String provider, Instant joinedAt, int posts, int comments, int warns, int bans,
        boolean suspended, Instant until, boolean permanent) {}

    public record SanctionRow(long id, String type, String reason, Instant startsAt, Instant endsAt, Instant createdAt,
        Instant revokedAt, String revokeReason, String byNickname) {}

    /** 지금 걸려 있는 정지 조건 (? = 지금, 두 번) */
    private static final String ACTIVE = Sql.ACTIVE_SUSPENSION;

    /** 경고 · 정지 횟수와 지금 정지 상태는 user_sanctions 를 한 번만 훑어 회원별로 모아요 (? = 지금, 여섯 번 → nowArgs) */
    private static final String MEMBER_SQL = """
        SELECT * FROM (
          SELECT u.id, u.nickname, u.login_id, u.signup_provider, u.created_at,
            (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.status = 'VISIBLE') AS post_count,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.status = 'VISIBLE') AS comment_count,
            COALESCE(t.warn_count, 0) AS warn_count, COALESCE(t.ban_count, 0) AS ban_count,
            COALESCE(t.active_count, 0) AS active_count, COALESCE(t.perm_count, 0) AS perm_count, t.active_until
          FROM users u
          LEFT JOIN (
            SELECT s.user_id,
              SUM(CASE WHEN s.sanction_type = 'WARNING' THEN 1 ELSE 0 END) AS warn_count,
              SUM(CASE WHEN s.sanction_type IN ('SUSPEND', 'BAN') THEN 1 ELSE 0 END) AS ban_count,
              SUM(CASE WHEN %1$s THEN 1 ELSE 0 END) AS active_count,
              SUM(CASE WHEN s.sanction_type = 'BAN' AND %1$s THEN 1 ELSE 0 END) AS perm_count,
              MAX(CASE WHEN %1$s THEN s.ends_at END) AS active_until
            FROM user_sanctions s GROUP BY s.user_id
          ) t ON t.user_id = u.id
          WHERE u.role <> 'ADMIN'
        ) m
        """.formatted(ACTIVE);

    /** MEMBER_SQL 의 "지금" 여섯 자리 */
    private static ArrayList<Object> nowArgs(Instant now) {
        var args = new ArrayList<Object>();
        for (int i = 0; i < 6; i++) args.add(Timestamp.from(now));
        return args;
    }

    private static MemberRow member(ResultSet rs, int row) throws SQLException {
        boolean permanent = rs.getInt("perm_count") > 0;
        Timestamp until = rs.getTimestamp("active_until");
        Timestamp joined = rs.getTimestamp("created_at");
        return new MemberRow(rs.getLong("id"), rs.getString("nickname"), rs.getString("login_id"), rs.getString("signup_provider"), joined == null ? null : joined.toInstant(),
            rs.getInt("post_count"), rs.getInt("comment_count"), rs.getInt("warn_count"), rs.getInt("ban_count"),
            rs.getInt("active_count") > 0, permanent || until == null ? null : until.toInstant(), permanent);
    }

    /** 회원 목록. status: null · ACTIVE · SUSPENDED, sort: activity · bans · warns · joined */
    public List<MemberRow> members(Instant now, String keyword, String status, int minBans, int minWarns, String sort, int limit, int offset) {
        var sql = new StringBuilder(MEMBER_SQL).append(" WHERE m.ban_count >= ? AND m.warn_count >= ?");
        var args = nowArgs(now);
        args.add(minBans);
        args.add(minWarns);
        if (keyword != null) {
            sql.append(" AND (m.nickname LIKE ? ESCAPE '!' OR m.login_id LIKE ? ESCAPE '!')");
            var like = Sql.likeContains(keyword);
            args.add(like);
            args.add(like);
        }
        if ("SUSPENDED".equals(status)) sql.append(" AND m.active_count > 0");
        if ("ACTIVE".equals(status)) sql.append(" AND m.active_count = 0");
        sql.append(switch (sort) {
            case "bans" -> " ORDER BY m.ban_count DESC, m.warn_count DESC, m.id";
            case "warns" -> " ORDER BY m.warn_count DESC, m.ban_count DESC, m.id";
            case "joined" -> " ORDER BY m.created_at DESC, m.id DESC";
            default -> " ORDER BY (m.post_count + m.comment_count) DESC, m.id";
        }).append(" LIMIT ? OFFSET ?");
        args.add(limit);
        args.add(offset);
        return jdbc.query(sql.toString(), ModerationRepository::member, args.toArray());
    }

    public Optional<MemberRow> member(long userId, Instant now) {
        var args = nowArgs(now);
        args.add(userId);
        return jdbc.query(MEMBER_SQL + " WHERE m.id = ?", ModerationRepository::member, args.toArray()).stream().findFirst();
    }

    /** [역할] (없으면 비어 있음) — 관리자에게는 조치를 걸 수 없음 */
    public Optional<String> role(long userId) {
        return jdbc.queryForList("SELECT role FROM users WHERE id = ?", String.class, userId).stream().findFirst();
    }

    public void lockUser(long userId) {
        jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, userId);
    }

    public void insertSanction(long userId, String type, String reason, Instant startsAt, Instant endsAt, long adminId) {
        jdbc.update("""
            INSERT INTO user_sanctions (user_id, sanction_type, reason, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?)
            """, userId, type, reason, Timestamp.from(startsAt), endsAt == null ? null : Timestamp.from(endsAt), adminId);
    }

    public void setStatus(long userId, String status) {
        jdbc.update("UPDATE users SET status = ? WHERE id = ?", status, userId);
    }

    /** 지금 걸린 정지를 모두 해제 (기록 · 횟수는 남김). 해제한 수 */
    public int revokeActive(long userId, long adminId, String reason, Instant now) {
        return jdbc.update("UPDATE user_sanctions s SET revoked_at = ?, revoked_by = ?, revoke_reason = ? WHERE s.user_id = ? AND " + ACTIVE,
            Timestamp.from(now), adminId, reason, userId, Timestamp.from(now), Timestamp.from(now));
    }

    public List<SanctionRow> sanctions(long userId) {
        return jdbc.query("""
            SELECT s.id, s.sanction_type, s.reason, s.starts_at, s.ends_at, s.created_at, s.revoked_at, s.revoke_reason, a.nickname AS by_nickname
            FROM user_sanctions s LEFT JOIN users a ON a.id = s.created_by
            WHERE s.user_id = ? ORDER BY s.starts_at DESC, s.id DESC
            """, (rs, row) -> new SanctionRow(rs.getLong("id"), rs.getString("sanction_type"), rs.getString("reason"),
                instant(rs, "starts_at"), instant(rs, "ends_at"), instant(rs, "created_at"), instant(rs, "revoked_at"),
                rs.getString("revoke_reason"), rs.getString("by_nickname")), userId);
    }

    /** 관리자 첫 화면 숫자: [회원, 정지 중, 정지 누적, 경고 누적, 글, 댓글] */
    public long[] stats(Instant now) {
        return jdbc.queryForObject("""
            SELECT (SELECT COUNT(*) FROM users WHERE role <> 'ADMIN'),
                   (SELECT COUNT(DISTINCT s.user_id) FROM user_sanctions s WHERE %s),
                   (SELECT COUNT(*) FROM user_sanctions WHERE sanction_type IN ('SUSPEND', 'BAN')),
                   (SELECT COUNT(*) FROM user_sanctions WHERE sanction_type = 'WARNING'),
                   (SELECT COUNT(*) FROM posts WHERE status = 'VISIBLE'),
                   (SELECT COUNT(*) FROM comments WHERE status = 'VISIBLE')
            """.formatted(ACTIVE), (rs, row) -> new long[] {rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6)},
            Timestamp.from(now), Timestamp.from(now));
    }

    /** 내 경고 확인 표시 (내 것 · 경고 · 아직 안 본 것만) */
    public int markWarningsSeen(long userId, List<Long> ids, Instant now) {
        if (ids.isEmpty()) return 0;
        var args = new ArrayList<Object>(List.of(Timestamp.from(now), userId));
        args.addAll(ids);
        return jdbc.update("UPDATE user_sanctions SET seen_at = ? WHERE user_id = ? AND sanction_type = 'WARNING' AND seen_at IS NULL AND id IN ("
            + Sql.marks(ids) + ")", args.toArray());
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}

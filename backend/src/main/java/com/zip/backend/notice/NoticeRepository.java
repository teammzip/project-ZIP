package com.zip.backend.notice;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 공지사항 (notices). frontend/API.md 14장 */
@Repository
public class NoticeRepository {
    private final JdbcTemplate jdbc;

    public NoticeRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record NoticeRow(long id, String title, String body, boolean pinned, boolean popup, String author, Instant createdAt, Instant updatedAt) {}

    private static final String SELECT = """
        SELECT n.id, n.title, n.body, n.is_pinned, n.is_popup, u.nickname, n.created_at, n.updated_at
        FROM notices n LEFT JOIN users u ON u.id = n.created_by""";

    private static NoticeRow row(ResultSet rs, int n) throws SQLException {
        return new NoticeRow(rs.getLong("id"), rs.getString("title"), rs.getString("body"), rs.getBoolean("is_pinned"), rs.getBoolean("is_popup"), rs.getString("nickname"),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    /** 고정 먼저, 그다음 새 것부터 */
    public List<NoticeRow> list(int limit) {
        return jdbc.query(SELECT + " ORDER BY n.is_pinned DESC, n.created_at DESC, n.id DESC LIMIT ?", NoticeRepository::row, limit);
    }

    /** 앱을 열면 팝업으로 보여 줄 공지 (새 것부터) */
    public List<NoticeRow> popups(int limit) {
        return jdbc.query(SELECT + " WHERE n.is_popup = TRUE ORDER BY n.created_at DESC, n.id DESC LIMIT ?", NoticeRepository::row, limit);
    }

    public Optional<NoticeRow> find(long id) {
        return jdbc.query(SELECT + " WHERE n.id = ?", NoticeRepository::row, id).stream().findFirst();
    }

    public long insert(long adminId, String title, String body, boolean pinned, boolean popup, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO notices (title, body, is_pinned, is_popup, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setString(1, title);
            ps.setString(2, body);
            ps.setBoolean(3, pinned);
            ps.setBoolean(4, popup);
            ps.setLong(5, adminId);
            ps.setTimestamp(6, Timestamp.from(now));
            ps.setTimestamp(7, Timestamp.from(now));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public int update(long id, String title, String body, boolean pinned, boolean popup, Instant now) {
        return jdbc.update("UPDATE notices SET title = ?, body = ?, is_pinned = ?, is_popup = ?, updated_at = ? WHERE id = ?", title, body, pinned, popup, Timestamp.from(now), id);
    }

    public int delete(long id) {
        return jdbc.update("DELETE FROM notices WHERE id = ?", id);
    }

    /** 새 공지 알림: 알림을 켠 일반 회원 모두에게 한 줄씩 (지운 공지는 알림을 눌러도 "없는 공지"로 보여요) */
    public int notifyAll(long noticeId, String title, String body, Instant now) {
        return jdbc.update("""
            INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at, created_at)
            SELECT u.id, 'SYSTEM', ?, ?, 'notice', ?, ?, ? FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
            WHERE u.role = 'USER' AND (s.noti_on IS NULL OR s.noti_on = TRUE)
            """, title, body, noticeId, Timestamp.from(now), Timestamp.from(now));
    }
}

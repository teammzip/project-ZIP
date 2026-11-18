package com.zip.backend.notification;

import com.zip.backend.common.Sql;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 알림 (notifications). 지운 알림은 deleted_at 을 두고 목록 · 안 읽은 수에서 빼요. frontend/API.md 6장 */
@Repository
public class NotificationRepository {
    private final JdbcTemplate jdbc;

    public NotificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record NotiRow(long id, String type, String title, String body, String link, Long refId, Instant notifyAt, boolean read) {}

    private static NotiRow row(ResultSet rs, int row) throws SQLException {
        long ref = rs.getLong("ref_id");
        Long refId = rs.wasNull() ? null : ref;
        return new NotiRow(rs.getLong("id"), rs.getString("noti_type"), rs.getString("title"), rs.getString("body"), rs.getString("link_view"),
            refId, rs.getTimestamp("notify_at").toInstant(), rs.getTimestamp("read_at") != null);
    }

    /** 보이는 알림 (지우지 않았고 알릴 시각이 지난 것), 새 것부터. read: null 이면 전부 */
    public List<NotiRow> list(long userId, Boolean read, Instant now, int limit) {
        var sql = new StringBuilder("""
            SELECT id, noti_type, title, body, link_view, ref_id, notify_at, read_at FROM notifications
            WHERE user_id = ? AND deleted_at IS NULL AND notify_at <= ?""");
        if (read != null) sql.append(read ? " AND read_at IS NOT NULL" : " AND read_at IS NULL");
        sql.append(" ORDER BY notify_at DESC, id DESC LIMIT ?");
        return jdbc.query(sql.toString(), NotificationRepository::row, userId, Timestamp.from(now), limit);
    }

    public int unreadCount(long userId, Instant now) {
        return jdbc.queryForObject("""
            SELECT COUNT(*) FROM notifications WHERE user_id = ? AND deleted_at IS NULL AND read_at IS NULL AND notify_at <= ?
            """, Integer.class, userId, Timestamp.from(now));
    }

    /** 읽음 표시 (내 것 · 안 읽은 것만). ids 가 비면 전부 */
    public int markRead(long userId, List<Long> ids, Instant now) {
        var args = new ArrayList<Object>(List.of(Timestamp.from(now), userId, Timestamp.from(now)));
        var only = "";
        if (!ids.isEmpty()) {
            only = " AND id IN (" + Sql.marks(ids) + ")";
            args.addAll(ids);
        }
        return jdbc.update("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND deleted_at IS NULL AND notify_at <= ?" + only,
            args.toArray());
    }

    /** 읽은 알림 지우기 (내 것 · 읽은 것만, 다시 안 보임) */
    public int deleteRead(long userId, List<Long> ids, Instant now) {
        if (ids.isEmpty()) return 0;
        var args = new ArrayList<Object>(List.of(Timestamp.from(now), userId));
        args.addAll(ids);
        return jdbc.update("UPDATE notifications SET deleted_at = ? WHERE user_id = ? AND read_at IS NOT NULL AND deleted_at IS NULL AND id IN ("
            + Sql.marks(ids) + ")", args.toArray());
    }

    /** 알림을 받는 회원인지 (설정에서 알림을 끄면 만들지 않음, 설정 줄이 없으면 켜짐) */
    public boolean wantsNotifications(long userId) {
        return jdbc.queryForList("SELECT noti_on FROM user_settings WHERE user_id = ?", Boolean.class, userId).stream()
            .allMatch(on -> on == null || on);
    }

    public void insert(long userId, String type, String title, String body, String link, Long refId, Instant at) {
        jdbc.update("""
            INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, userId, type, title, body, link, refId, Timestamp.from(at), Timestamp.from(at));
    }
}

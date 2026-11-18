package com.zip.backend.memo;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 메모 (memos) · 홈 메모 순서 (user_settings.home_memo_ids). JSON 칸은 JSON 글자로 넣고 읽어요. frontend/API.md 12장 */
@Repository
public class MemoRepository {
    private final JdbcTemplate jdbc;

    public MemoRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** items: JSON 배열 글자 */
    public record MemoRow(long id, String title, String body, String color, boolean pinned, boolean checklist, String items,
        Instant createdAt, Instant updatedAt) {}

    private static final String SELECT = "SELECT id, title, body, color, is_pinned, is_checklist, items, created_at, updated_at FROM memos";

    private static MemoRow row(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new MemoRow(rs.getLong("id"), rs.getString("title"), rs.getString("body"), rs.getString("color"),
            rs.getBoolean("is_pinned"), rs.getBoolean("is_checklist"), rs.getString("items"),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    /** 내 메모: 고정 먼저, 그다음 최근 수정 순. keyword 가 있으면 제목 · 글에서 찾음 */
    public List<MemoRow> list(long userId, String likeKeyword) {
        if (likeKeyword == null) {
            return jdbc.query(SELECT + " WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC, id DESC", MemoRepository::row, userId);
        }
        return jdbc.query(SELECT + " WHERE user_id = ? AND (title LIKE ? ESCAPE '!' OR body LIKE ? ESCAPE '!') ORDER BY is_pinned DESC, updated_at DESC, id DESC",
            MemoRepository::row, userId, likeKeyword, likeKeyword);
    }

    public Optional<MemoRow> find(long userId, long id) {
        return jdbc.query(SELECT + " WHERE id = ? AND user_id = ?", MemoRepository::row, id, userId).stream().findFirst();
    }

    public int count(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM memos WHERE user_id = ?", Integer.class, userId);
    }

    public long insert(long userId, MemoRow m) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("""
                INSERT INTO memos (user_id, title, body, color, is_pinned, is_checklist, items, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", new String[] {"id"});
            ps.setLong(1, userId); ps.setString(2, m.title()); ps.setString(3, m.body()); ps.setString(4, m.color());
            ps.setBoolean(5, m.pinned()); ps.setBoolean(6, m.checklist()); ps.setString(7, m.items());
            ps.setTimestamp(8, Timestamp.from(m.createdAt())); ps.setTimestamp(9, Timestamp.from(m.updatedAt()));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void update(long userId, MemoRow m) {
        jdbc.update("""
            UPDATE memos SET title = ?, body = ?, color = ?, is_pinned = ?, is_checklist = ?, items = ?, updated_at = ?
            WHERE id = ? AND user_id = ?""",
            m.title(), m.body(), m.color(), m.pinned(), m.checklist(), m.items(), Timestamp.from(m.updatedAt()), m.id(), userId);
    }

    public int delete(long userId, long id) {
        return jdbc.update("DELETE FROM memos WHERE id = ? AND user_id = ?", id, userId);
    }

    /** 내 메모 중 있는 번호만 */
    public List<Long> ownedIds(long userId, List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        var args = new java.util.ArrayList<Object>(List.of(userId));
        args.addAll(ids);
        return jdbc.queryForList("SELECT id FROM memos WHERE user_id = ? AND id IN (" + com.zip.backend.common.Sql.marks(ids) + ")", Long.class, args.toArray());
    }

    /** 홈 메모 순서 (JSON 배열 글자, 없으면 비어 있음 = 자동) */
    public Optional<String> homeMemoIds(long userId) {
        return jdbc.queryForList("SELECT home_memo_ids FROM user_settings WHERE user_id = ?", String.class, userId).stream()
            .filter(java.util.Objects::nonNull).findFirst();
    }

    /** json: JSON 배열 글자, null 이면 자동 */
    public void saveHomeMemoIds(long userId, String json) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM user_settings WHERE user_id = ?", Integer.class, userId) == 0) {
            jdbc.update("INSERT INTO user_settings (user_id) VALUES (?)", userId);
        }
        jdbc.update("UPDATE user_settings SET home_memo_ids = ? WHERE user_id = ?", json, userId);
    }
}

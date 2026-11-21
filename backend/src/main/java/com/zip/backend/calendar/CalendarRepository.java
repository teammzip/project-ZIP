package com.zip.backend.calendar;

import com.zip.backend.common.Sql;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 일정 (events) · 일정 카테고리 (event_categories) · 항목 버튼 (event_presets) · 쓰레기 배출표 (trash_schedules). frontend/API.md 3장 */
@Repository
public class CalendarRepository {
    private final JdbcTemplate jdbc;

    public CalendarRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // ---------- 카테고리 ----------

    public record CategoryRow(long id, String name, String ico, boolean system, int sortOrder) {}

    /** 처음 쓰는 회원이면 기본 카테고리 5개 + 미분류와 기본 항목을 만들어 줌 (이미 있으면 그대로). 트랜잭션 맨 처음에 불러요 */
    public void ensureDefaults(long userId) {
        jdbc.queryForList(com.zip.backend.common.Sql.LOCK_USER, Long.class, userId); // 두 화면 · 두 기기가 동시에 처음 열어도 한 벌만
        if (jdbc.queryForObject("SELECT COUNT(*) FROM event_categories WHERE user_id = ?", Integer.class, userId) > 0) return;
        var defaults = CalendarDefaults.CATEGORIES;
        for (int i = 0; i < defaults.size(); i++) {
            var c = defaults.get(i);
            long id = insertCategory(userId, c.name(), c.ico(), null, i);
            if (id == 0) continue; // 동시에 다른 요청이 만듦
            for (int j = 0; j < c.items().size(); j++) {
                try {
                    jdbc.update("INSERT INTO event_presets (user_id, category_id, title, is_custom, sort_order) VALUES (?, ?, ?, 0, ?)", userId, id, c.items().get(j), j);
                } catch (DuplicateKeyException sameTime) {
                    // 동시에 다른 요청이 만듦
                }
            }
        }
        insertCategory(userId, CalendarDefaults.UNCATEGORIZED, CalendarDefaults.UNCATEGORIZED_ICO, "UNCATEGORIZED", defaults.size());
    }

    /** 만든 번호, 같은 이름이 이미 있으면 0 */
    public long insertCategory(long userId, String name, String ico, String systemKey, int sortOrder) {
        var keys = new GeneratedKeyHolder();
        try {
            jdbc.update(connection -> {
                var ps = connection.prepareStatement(
                    "INSERT INTO event_categories (user_id, name, ico, system_key, sort_order) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
                ps.setLong(1, userId); ps.setString(2, name); ps.setString(3, ico); ps.setString(4, systemKey); ps.setInt(5, sortOrder);
                return ps;
            }, keys);
        } catch (DuplicateKeyException exists) {
            return 0;
        }
        return keys.getKey().longValue();
    }

    private static CategoryRow category(ResultSet rs, int row) throws SQLException {
        return new CategoryRow(rs.getLong("id"), rs.getString("name"), rs.getString("ico"), rs.getString("system_key") != null, rs.getInt("sort_order"));
    }

    /** 내 카테고리: 순서대로, 미분류는 늘 맨 끝 */
    public List<CategoryRow> categories(long userId) {
        return jdbc.query("""
            SELECT id, name, ico, system_key, sort_order FROM event_categories WHERE user_id = ?
            ORDER BY CASE WHEN system_key IS NULL THEN 0 ELSE 1 END, sort_order, id
            """, CalendarRepository::category, userId);
    }

    public Optional<CategoryRow> category(long userId, long id) {
        return jdbc.query("SELECT id, name, ico, system_key, sort_order FROM event_categories WHERE user_id = ? AND id = ?",
            CalendarRepository::category, userId, id).stream().findFirst();
    }

    public Optional<CategoryRow> categoryByName(long userId, String name) {
        return jdbc.query("SELECT id, name, ico, system_key, sort_order FROM event_categories WHERE user_id = ? AND name = ?",
            CalendarRepository::category, userId, name).stream().findFirst();
    }

    public long uncategorizedId(long userId) {
        return jdbc.queryForObject("SELECT id FROM event_categories WHERE user_id = ? AND system_key = 'UNCATEGORIZED'", Long.class, userId);
    }

    public int nextCategoryOrder(long userId) {
        return jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM event_categories WHERE user_id = ? AND system_key IS NULL", Integer.class, userId);
    }

    /** 바뀐 줄 수 (같은 이름이 있으면 DuplicateKeyException) */
    public int renameCategory(long userId, long id, String name) {
        return jdbc.update("UPDATE event_categories SET name = ? WHERE user_id = ? AND id = ? AND system_key IS NULL", name, userId, id);
    }

    /** 카테고리 삭제: 그 일정은 미분류로, 직접 만든 항목 버튼은 미분류로 옮기되 미분류에 같은 이름이 있으면 기존 버튼을 남기고 이것은 지움 */
    public void deleteCategory(long userId, long id, long uncategorized) {
        jdbc.update("UPDATE events SET category_id = ? WHERE user_id = ? AND category_id = ?", uncategorized, userId, id);
        // 기본 항목은 그 카테고리와 함께 없어지고, 직접 만든 항목만 미분류로 (화면 동작과 같음)
        jdbc.update("DELETE FROM event_presets WHERE user_id = ? AND category_id = ? AND is_custom = 0", userId, id);
        // MySQL 은 같은 표를 하위 질의로 읽으며 지우지 못해서(1093) 미분류에 이미 있는 이름을 먼저 읽어 둠
        var kept = jdbc.queryForList("SELECT title FROM event_presets WHERE user_id = ? AND category_id = ?", String.class, userId, uncategorized);
        if (!kept.isEmpty()) {
            var args = new ArrayList<Object>(List.of(userId, id));
            args.addAll(kept);
            jdbc.update("DELETE FROM event_presets WHERE user_id = ? AND category_id = ? AND title IN (" + Sql.marks(kept) + ")", args.toArray());
        }
        int next = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM event_presets WHERE category_id = ?", Integer.class, uncategorized);
        jdbc.update("UPDATE event_presets SET category_id = ?, sort_order = sort_order + ? WHERE user_id = ? AND category_id = ?", uncategorized, next, userId, id);
        jdbc.update("DELETE FROM event_categories WHERE user_id = ? AND id = ? AND system_key IS NULL", userId, id);
    }

    // ---------- 항목 버튼 ----------

    public record PresetRow(long id, long categoryId, String category, String title, boolean custom) {}

    private static PresetRow preset(ResultSet rs, int row) throws SQLException {
        return new PresetRow(rs.getLong("id"), rs.getLong("category_id"), rs.getString("category_name"), rs.getString("title"), rs.getBoolean("is_custom"));
    }

    private static final String PRESET_SQL = """
        SELECT p.id, p.category_id, c.name AS category_name, p.title, p.is_custom
        FROM event_presets p JOIN event_categories c ON c.id = p.category_id
        """;

    /** 내 항목 버튼 전부 (기본 · 직접 만든 것), 카테고리 · 순서대로 */
    public List<PresetRow> presets(long userId) {
        return jdbc.query(PRESET_SQL + " WHERE p.user_id = ? ORDER BY p.category_id, p.is_custom, p.sort_order, p.id", CalendarRepository::preset, userId);
    }

    public Optional<PresetRow> preset(long userId, long id) {
        return jdbc.query(PRESET_SQL + " WHERE p.user_id = ? AND p.id = ?", CalendarRepository::preset, userId, id).stream().findFirst();
    }

    public Optional<PresetRow> presetByTitle(long userId, long categoryId, String title) {
        return jdbc.query(PRESET_SQL + " WHERE p.user_id = ? AND p.category_id = ? AND p.title = ?", CalendarRepository::preset, userId, categoryId, title)
            .stream().findFirst();
    }

    public long insertPreset(long userId, long categoryId, String title) {
        int order = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM event_presets WHERE category_id = ?", Integer.class, categoryId);
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO event_presets (user_id, category_id, title, is_custom, sort_order) VALUES (?, ?, ?, 1, ?)", new String[] {"id"});
            ps.setLong(1, userId); ps.setLong(2, categoryId); ps.setString(3, title); ps.setInt(4, order);
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void updatePreset(long userId, long id, long categoryId, String title) {
        jdbc.update("UPDATE event_presets SET category_id = ?, title = ? WHERE user_id = ? AND id = ? AND is_custom = 1", categoryId, title, userId, id);
    }

    public int deletePreset(long userId, long id) {
        return jdbc.update("DELETE FROM event_presets WHERE user_id = ? AND id = ? AND is_custom = 1", userId, id);
    }

    // ---------- 일정 ----------

    public record EventRow(long id, LocalDate date, LocalTime time, String title, String category, boolean done, String source,
        boolean anniv, boolean yearly) {}

    private static final String EVENT_SQL = """
        SELECT e.id, e.event_date, e.event_time, e.title, c.name AS category_name, e.is_done, e.source, e.is_anniversary, e.repeat_yearly
        FROM events e LEFT JOIN event_categories c ON c.id = e.category_id
        """;

    private static EventRow event(ResultSet rs, int row) throws SQLException {
        Time time = rs.getTime("event_time");
        return new EventRow(rs.getLong("id"), rs.getDate("event_date").toLocalDate(), time == null ? null : time.toLocalTime(),
            rs.getString("title"), rs.getString("category_name"), rs.getBoolean("is_done"), rs.getString("source"),
            rs.getBoolean("is_anniversary"), rs.getBoolean("repeat_yearly"));
    }

    /** 내 일정. from · to 가 있으면 그 사이 (매년 반복 기념일은 날짜와 상관없이 늘 넣음 — 화면이 그해 날짜로 펼침) */
    public List<EventRow> events(long userId, LocalDate from, LocalDate to, int limit) {
        var sql = new StringBuilder(EVENT_SQL).append(" WHERE e.user_id = ?");
        var args = new ArrayList<Object>(List.of(userId));
        if (from != null) {
            sql.append(" AND (e.repeat_yearly = 1 OR e.event_date BETWEEN ? AND ?)");
            args.add(java.sql.Date.valueOf(from));
            args.add(java.sql.Date.valueOf(to));
        }
        sql.append(" ORDER BY e.event_date, e.event_time, e.id LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), CalendarRepository::event, args.toArray());
    }

    public List<EventRow> search(long userId, String keyword, int limit) {
        return jdbc.query(EVENT_SQL + " WHERE e.user_id = ? AND e.title LIKE ? ESCAPE '!' ORDER BY e.event_date DESC, e.id DESC LIMIT ?",
            CalendarRepository::event, userId, Sql.likeContains(keyword), limit);
    }

    public Optional<EventRow> event(long userId, long id) {
        return jdbc.query(EVENT_SQL + " WHERE e.user_id = ? AND e.id = ?", CalendarRepository::event, userId, id).stream().findFirst();
    }

    public int countEvents(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM events WHERE user_id = ?", Integer.class, userId);
    }

    /** 저장할 값 (categoryId null = 분류 없음) */
    public record EventValues(LocalDate date, LocalTime time, String title, Long categoryId, boolean done, String source, boolean anniv, boolean yearly) {}

    public long insertEvent(long userId, EventValues v, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("""
                INSERT INTO events (user_id, title, event_date, event_time, source, category_id, is_done, done_at, is_anniversary, repeat_yearly, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", new String[] {"id"});
            ps.setLong(1, userId); ps.setString(2, v.title()); ps.setDate(3, java.sql.Date.valueOf(v.date()));
            ps.setTime(4, v.time() == null ? null : Time.valueOf(v.time())); ps.setString(5, v.source());
            if (v.categoryId() == null) ps.setNull(6, java.sql.Types.BIGINT); else ps.setLong(6, v.categoryId());
            ps.setBoolean(7, v.done()); ps.setTimestamp(8, v.done() ? Timestamp.from(now) : null);
            ps.setBoolean(9, v.anniv()); ps.setBoolean(10, v.yearly());
            ps.setTimestamp(11, Timestamp.from(now)); ps.setTimestamp(12, Timestamp.from(now));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    /** 완료 시각은 완료로 바뀔 때만 새로 적고, 해제하면 지움 */
    public void updateEvent(long userId, long id, EventValues v, Instant now) {
        jdbc.update("""
            UPDATE events SET title = ?, event_date = ?, event_time = ?, category_id = ?, is_anniversary = ?, repeat_yearly = ?,
              done_at = CASE WHEN ? THEN COALESCE(done_at, ?) ELSE NULL END, is_done = ?, updated_at = ?
            WHERE user_id = ? AND id = ?""",
            v.title(), java.sql.Date.valueOf(v.date()), v.time() == null ? null : Time.valueOf(v.time()), v.categoryId(), v.anniv(), v.yearly(),
            v.done(), Timestamp.from(now), v.done(), Timestamp.from(now), userId, id);
    }

    public int deleteEvent(long userId, long id) {
        return jdbc.update("DELETE FROM events WHERE user_id = ? AND id = ?", userId, id);
    }

    // ---------- 쓰레기 배출표 ----------

    public record TrashRow(int weekday, String wasteType, String description) {}

    public List<TrashRow> trashSchedules(long regionId) {
        return jdbc.query("SELECT weekday, waste_type, description FROM trash_schedules WHERE region_id = ? ORDER BY weekday, waste_type",
            (rs, row) -> new TrashRow(rs.getInt(1), rs.getString(2), rs.getString(3)), regionId);
    }
}

package com.zip.backend.support;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 고객센터 문의 (support_inquiries, 문의 하나에 관리자 답변 하나). frontend/API.md 13장 */
@Repository
public class SupportRepository {
    private final JdbcTemplate jdbc;

    public SupportRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record InquiryRow(long id, long userId, String nickname, String category, String title, String content,
        Instant createdAt, String answer, Instant answeredAt) {}

    private static final String SELECT = """
        SELECT q.id, q.user_id, u.nickname, q.category, q.title, q.content, q.created_at, q.answer_content, q.answered_at
        FROM support_inquiries q JOIN users u ON u.id = q.user_id
        """;

    private static InquiryRow row(ResultSet rs, int row) throws SQLException {
        return new InquiryRow(rs.getLong("id"), rs.getLong("user_id"), rs.getString("nickname"), rs.getString("category"),
            rs.getString("title"), rs.getString("content"), instant(rs, "created_at"), rs.getString("answer_content"), instant(rs, "answered_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    /** 내 문의, 최근 것부터 */
    public List<InquiryRow> mine(long userId) {
        return jdbc.query(SELECT + " WHERE q.user_id = ? ORDER BY q.created_at DESC, q.id DESC", SupportRepository::row, userId);
    }

    /** 관리자: 전체 문의, 답변 대기부터 · 최근 것부터 (최대 limit 개) */
    public List<InquiryRow> all(int limit) {
        return jdbc.query(SELECT + " ORDER BY CASE WHEN q.answered_at IS NULL THEN 0 ELSE 1 END, q.created_at DESC, q.id DESC LIMIT ?",
            SupportRepository::row, limit);
    }

    public Optional<InquiryRow> find(long id) {
        return jdbc.query(SELECT + " WHERE q.id = ?", SupportRepository::row, id).stream().findFirst();
    }

    /** 이 회원이 since 뒤에 남긴 문의 수 (도배 막기) */
    public int countSince(long userId, Instant since) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM support_inquiries WHERE user_id = ? AND created_at >= ?",
            Integer.class, userId, Timestamp.from(since));
    }

    public long insert(long userId, String category, String title, String content, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO support_inquiries (user_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, userId); ps.setString(2, category); ps.setString(3, title); ps.setString(4, content); ps.setTimestamp(5, Timestamp.from(now));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    /** 답변 달기: 아직 답변이 없을 때만 (먼저 단 답변을 덮어쓰지 않음). 바뀐 줄 수 */
    public int answer(long id, long adminId, String content, Instant now) {
        return jdbc.update("""
            UPDATE support_inquiries SET answer_content = ?, answered_by = ?, answered_at = ?
            WHERE id = ? AND answered_at IS NULL
            """, content, adminId, Timestamp.from(now), id);
    }
}

package com.zip.backend.ai;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** ai_topics / ai_conversations / ai_messages (db/schema.sql). Every read of a conversation is scoped to its owner. */
@Repository
public class AiRepository {
    private final JdbcTemplate jdbc;

    public AiRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Conversation(long id, String title, String topic, String entryPoint, Instant updatedAt) {}

    public record Message(long id, String role, String content, String cardType, String cardData, Instant createdAt) {}

    private static final String CONVERSATION_SQL = """
        SELECT c.id, c.title, t.code AS topic, c.entry_point, c.updated_at
        FROM ai_conversations c LEFT JOIN ai_topics t ON t.id = c.topic_id
        """;

    private Conversation conversation(ResultSet rs, int row) throws SQLException {
        return new Conversation(rs.getLong("id"), rs.getString("title"), rs.getString("topic"),
            rs.getString("entry_point"), rs.getTimestamp("updated_at").toInstant());
    }

    private Message message(ResultSet rs, int row) throws SQLException {
        return new Message(rs.getLong("id"), rs.getString("role"), rs.getString("content"),
            rs.getString("card_type"), rs.getString("card_data"), rs.getTimestamp("created_at").toInstant());
    }

    public Long topicId(String code) {
        if (code == null || code.isBlank()) return null;
        return jdbc.queryForList("SELECT id FROM ai_topics WHERE code = ? AND is_active = 1", Long.class, code.strip())
            .stream().findFirst().orElse(null);
    }

    public long createConversation(long userId, Long topicId, String entryPoint, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO ai_conversations (user_id, topic_id, entry_point, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                new String[] {"id"});
            ps.setLong(1, userId);
            if (topicId == null) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, topicId);
            ps.setString(3, entryPoint);
            ps.setTimestamp(4, Timestamp.from(now));
            ps.setTimestamp(5, Timestamp.from(now));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public Optional<Conversation> find(long id, long userId) {
        return jdbc.query(CONVERSATION_SQL + " WHERE c.id = ? AND c.user_id = ?", this::conversation, id, userId).stream().findFirst();
    }

    /** Newest first. entryPoint may be null for all. */
    public List<Conversation> list(long userId, String entryPoint, int limit) {
        if (entryPoint == null) {
            return jdbc.query(CONVERSATION_SQL + " WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC LIMIT ?",
                this::conversation, userId, limit);
        }
        return jdbc.query(CONVERSATION_SQL + " WHERE c.user_id = ? AND c.entry_point = ? ORDER BY c.updated_at DESC, c.id DESC LIMIT ?",
            this::conversation, userId, entryPoint, limit);
    }

    public List<Message> messages(long conversationId) {
        return jdbc.query("SELECT id, role, content, card_type, card_data, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id",
            this::message, conversationId);
    }

    /** The last n messages, oldest first. */
    public List<Message> recent(long conversationId, int n) {
        var rows = new ArrayList<>(jdbc.query(
            "SELECT id, role, content, card_type, card_data, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
            this::message, conversationId, n));
        Collections.reverse(rows);
        return rows;
    }

    public long countMessages(long conversationId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages WHERE conversation_id = ?", Long.class, conversationId);
    }

    public Message addMessage(long conversationId, String role, String content, String cardType, String cardData, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO ai_messages (conversation_id, role, content, card_type, card_data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                new String[] {"id"});
            ps.setLong(1, conversationId);
            ps.setString(2, role);
            ps.setString(3, content);
            ps.setString(4, cardType);
            ps.setString(5, cardData);
            ps.setTimestamp(6, Timestamp.from(now));
            return ps;
        }, keys);
        return new Message(keys.getKey().longValue(), role, content, cardType, cardData, now);
    }

    /** Marks the conversation as just used; the title is set once, from the first question. */
    public void touch(long conversationId, String titleIfEmpty, Instant now) {
        jdbc.update("UPDATE ai_conversations SET updated_at = ?, title = COALESCE(title, ?) WHERE id = ?",
            Timestamp.from(now), titleIfEmpty, conversationId);
    }

    public void delete(long conversationId) {
        jdbc.update("DELETE FROM ai_conversations WHERE id = ?", conversationId);
    }

    public void deleteAll(long userId) {
        jdbc.update("DELETE FROM ai_conversations WHERE user_id = ?", userId);
    }
}

package com.zip.backend.auth.recovery;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL for find id and password reset (users, password_resets). */
@Repository
public class RecoveryRepository {
    private final JdbcTemplate jdbc;

    public RecoveryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** The login id of the email account with this nickname and email (null for social accounts). */
    public Optional<String> usernameByNicknameAndEmail(String nickname, String email) {
        return jdbc.queryForList("SELECT login_id FROM users WHERE nickname = ? AND email = ? AND login_id IS NOT NULL",
            String.class, nickname, email).stream().findFirst();
    }

    public boolean usernameMatchesEmail(long userId, String username, String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ? AND login_id = ? AND email = ? AND password_hash IS NOT NULL",
            Long.class, userId, username, email) > 0;
    }

    public void insertPasswordReset(long userId, String tokenHash, Instant now, Instant expires) {
        jdbc.update("INSERT INTO password_resets (user_id, method, token_hash, requested_at, expires_at) VALUES (?, 'EMAIL', ?, ?, ?)",
            userId, tokenHash, Timestamp.from(now), Timestamp.from(expires));
    }

    /** Spends a reset token (once) and returns its user id, or empty when unknown, used or expired. */
    public Optional<Long> spendPasswordReset(String tokenHash, Instant now) {
        var ids = jdbc.queryForList("SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? FOR UPDATE",
            Long.class, tokenHash, Timestamp.from(now));
        if (ids.isEmpty()) return Optional.empty();
        jdbc.update("UPDATE password_resets SET used_at = ? WHERE token_hash = ?", Timestamp.from(now), tokenHash);
        return Optional.of(ids.get(0));
    }
}

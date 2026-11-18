package com.zip.backend.auth.emailcheck;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** SQL for the email verification codes and tokens (email_verifications). */
@Repository
public class EmailCheckRepository {
    private final JdbcTemplate jdbc;

    public EmailCheckRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean emailTaken(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email) > 0;
    }

    public Optional<Long> userIdByEmail(String email) {
        return jdbc.queryForList("SELECT id FROM users WHERE email = ?", Long.class, email).stream().findFirst();
    }

    /** The newest code request for this email, whatever its purpose (for the resend wait). */
    public Instant lastVerificationRequest(String email) {
        var value = jdbc.queryForObject("SELECT MAX(requested_at) FROM email_verifications WHERE email = ?", Timestamp.class, email);
        return value == null ? null : value.toInstant();
    }

    public long verificationRequestsSince(String email, Instant since) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM email_verifications WHERE email = ? AND requested_at > ?",
            Long.class, email, Timestamp.from(since));
    }

    public long insertVerification(String purpose, String email, Long userId, String codeHash, Instant now, Instant expires) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("""
                INSERT INTO email_verifications (purpose, email, user_id, code_hash, requested_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, new String[] {"id"});
            ps.setString(1, purpose);
            ps.setString(2, email);
            if (userId == null) ps.setNull(3, java.sql.Types.BIGINT); else ps.setLong(3, userId);
            ps.setString(4, codeHash);
            ps.setTimestamp(5, Timestamp.from(now));
            ps.setTimestamp(6, Timestamp.from(expires));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void deleteVerification(long id) {
        jdbc.update("DELETE FROM email_verifications WHERE id = ?", id);
    }

    public record OpenVerification(long id, String codeHash, Instant expiresAt) {}

    /** The newest code that has not been verified yet. */
    public Optional<OpenVerification> openVerification(String email, String purpose) {
        return jdbc.query("""
            SELECT id, code_hash, expires_at FROM email_verifications
            WHERE email = ? AND purpose = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE
            """, (rs, row) -> new OpenVerification(rs.getLong(1), rs.getString(2), rs.getTimestamp(3).toInstant()), email, purpose)
            .stream().findFirst();
    }

    /** Counts one try. False when the limit is already reached. */
    public boolean countAttempt(long id, int max) {
        return jdbc.update("UPDATE email_verifications SET attempt_count = attempt_count + 1 WHERE id = ? AND verified_at IS NULL AND attempt_count < ?",
            id, max) == 1;
    }

    public boolean markVerified(long id, String tokenHash, Instant now) {
        return jdbc.update("UPDATE email_verifications SET verified_at = ?, verified_token_hash = ? WHERE id = ? AND verified_at IS NULL",
            Timestamp.from(now), tokenHash, id) == 1;
    }

    public record Spent(Long userId) {}

    /** Marks a verified token as used (once). Null when it is unknown, used, for another email/purpose, or too old. */
    public Spent spendVerification(String tokenHash, String email, String purpose, Instant now, Instant notBefore) {
        int changed = jdbc.update("""
            UPDATE email_verifications SET consumed_at = ?
            WHERE verified_token_hash = ? AND email = ? AND purpose = ? AND consumed_at IS NULL AND verified_at IS NOT NULL AND verified_at > ?
            """, Timestamp.from(now), tokenHash, email, purpose, Timestamp.from(notBefore));
        if (changed != 1) return null;
        var ids = jdbc.queryForList("SELECT user_id FROM email_verifications WHERE verified_token_hash = ?", Long.class, tokenHash);
        return new Spent(ids.isEmpty() ? null : ids.get(0));
    }
}

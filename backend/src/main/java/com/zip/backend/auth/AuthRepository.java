package com.zip.backend.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class AuthRepository {
    private final JdbcTemplate jdbc;

    public AuthRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Account(long id, String username, String passwordHash, String email,
        String nickname, String address, String provider, String role, String status,
        Instant lastLoginAt, String regionId, String regionName) {}

    private static final String ACCOUNT_SQL = """
        SELECT u.*, r.name AS region_name FROM users u
        LEFT JOIN regions r ON r.id = u.region_id
        """;

    private static Instant instant(ResultSet rs, String key) throws SQLException {
        var value = rs.getTimestamp(key);
        return value == null ? null : value.toInstant();
    }

    private Account account(ResultSet rs, int row) throws SQLException {
        return new Account(rs.getLong("id"), rs.getString("login_id"), rs.getString("password_hash"),
            rs.getString("email"), rs.getString("nickname"), rs.getString("address"),
            rs.getString("signup_provider"), rs.getString("role"), rs.getString("status"),
            instant(rs, "last_login_at"), rs.getString("region_id"), rs.getString("region_name"));
    }

    public Optional<Account> findForLogin(String loginId) {
        return jdbc.query(ACCOUNT_SQL + " WHERE u.login_id = ? OR u.email = ? FOR UPDATE",
            this::account, loginId, loginId).stream().findFirst();
    }

    public Optional<Account> findById(long userId) {
        return jdbc.query(ACCOUNT_SQL + " WHERE u.id = ?", this::account, userId).stream().findFirst();
    }

    public Optional<Account> findBySocial(String provider, String providerUserId) {
        return jdbc.query(ACCOUNT_SQL + """
            JOIN social_accounts s ON s.user_id = u.id
            WHERE s.provider = ? AND s.provider_user_id = ?
            """, this::account, provider, providerUserId).stream().findFirst();
    }

    public boolean emailTaken(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email) > 0;
    }

    /** Social sign-ups have no login id or password; terms and address are collected afterwards. */
    public long createSocialUser(String nickname, String email, String provider) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement(
                "INSERT INTO users (nickname, email, signup_provider) VALUES (?, ?, ?)", new String[] {"id"});
            ps.setString(1, nickname);
            ps.setString(2, email);
            ps.setString(3, provider);
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void linkSocial(long userId, String provider, String providerUserId) {
        jdbc.update("INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)",
            userId, provider, providerUserId);
    }

    public void lockUser(long userId) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, userId).isEmpty()) {
            throw new com.zip.backend.common.ApiException(401, "로그인 정보가 없어요.");
        }
    }

    public boolean suspended(Account user, Instant now) {
        // A suspended DB status is never silently ignored, even without a sanction row.
        return "SUSPENDED".equals(user.status()) || jdbc.queryForObject("""
            SELECT COUNT(*) FROM user_sanctions WHERE user_id = ?
            AND sanction_type IN ('SUSPEND', 'BAN') AND revoked_at IS NULL
            AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)
            """, Long.class, user.id(), Timestamp.from(now), Timestamp.from(now)) > 0;
    }

    public long createSession(long userId, String hash, boolean remember, Instant now, Instant expires) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("""
                INSERT INTO auth_sessions (user_id, refresh_token_hash, remember, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """, new String[] {"id"});
            ps.setLong(1, userId);
            ps.setString(2, hash);
            ps.setBoolean(3, remember);
            ps.setTimestamp(4, Timestamp.from(now));
            ps.setTimestamp(5, Timestamp.from(expires));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public boolean sessionActive(long sessionId, long userId, Instant now) {
        return jdbc.queryForObject("""
            SELECT COUNT(*) FROM auth_sessions WHERE id = ? AND user_id = ?
            AND revoked_at IS NULL AND expires_at > ?
            """, Long.class, sessionId, userId, Timestamp.from(now)) == 1;
    }

    public void recordLogin(long userId, Instant now) {
        jdbc.update("UPDATE users SET last_login_at = ? WHERE id = ?", Timestamp.from(now), userId);
    }

    public Instant agreedAt(long userId) {
        List<Instant> dates = jdbc.query("""
            SELECT MAX(a.agreed_at) AS agreed_at FROM user_term_agreements a
            JOIN terms_documents t ON t.id = a.terms_id WHERE a.user_id = ?
            HAVING COUNT(DISTINCT t.doc_type) = 3
            """, (rs, row) -> instant(rs, "agreed_at"), userId);
        return dates.isEmpty() ? null : dates.get(0);
    }

    public record CurrentTerm(long id, String docType, String version) {}

    /** The newest in-force document of each type (same rule as GET /api/terms). */
    public List<CurrentTerm> currentTerms(Instant now) {
        var at = Timestamp.from(now);
        return jdbc.query("""
            SELECT t.id, t.doc_type, t.version FROM terms_documents t WHERE t.effective_at <= ?
            AND NOT EXISTS (SELECT 1 FROM terms_documents newer WHERE newer.doc_type = t.doc_type
                AND newer.effective_at <= ? AND (newer.effective_at > t.effective_at
                    OR (newer.effective_at = t.effective_at AND newer.id > t.id)))
            """, (rs, row) -> new CurrentTerm(rs.getLong("id"), rs.getString("doc_type"), rs.getString("version")), at, at);
    }

    public void recordAgreement(long userId, long termsId, Instant now) {
        jdbc.update("INSERT INTO user_term_agreements (user_id, terms_id, agreed_at) VALUES (?, ?, ?)",
            userId, termsId, Timestamp.from(now));
    }

    public void saveConsent(long userId, String address, Instant now) {
        jdbc.update("UPDATE users SET address = ?, age_confirmed_at = ? WHERE id = ?", address, Timestamp.from(now), userId);
    }

    public void updateNickname(long userId, String nickname) {
        jdbc.update("UPDATE users SET nickname = ? WHERE id = ?", nickname, userId);
    }

    public void revokeSession(long sessionId, long userId, Instant now) {
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
            Timestamp.from(now), sessionId, userId);
    }

    public void changePassword(long userId, String hash, Instant now) {
        jdbc.update("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?",
            hash, Timestamp.from(now), userId);
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            Timestamp.from(now), userId);
    }
}

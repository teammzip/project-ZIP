package com.zip.backend.auth;

import com.zip.backend.common.Sql;
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

    public List<String> personalBirth(long userId) {
        return jdbc.query("SELECT birth_date FROM user_personal_info WHERE user_id = ?", (rs, row) -> {
            var birth = rs.getDate("birth_date");
            return birth == null ? "" : birth.toLocalDate().toString();
        }, userId);
    }

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
        boolean active = jdbc.queryForObject("SELECT COUNT(*) FROM user_sanctions s WHERE s.user_id = ? AND " + Sql.ACTIVE_SUSPENSION,
            Long.class, user.id(), Timestamp.from(now), Timestamp.from(now)) > 0;
        if (active) return true;
        if (!"SUSPENDED".equals(user.status())) return false;
        // A suspended DB status is never silently ignored, even without a sanction row. But when it came from
        // sanctions that have all ended or been revoked, the account is active again (frontend/API.md 11장).
        boolean hadSanction = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_sanctions WHERE user_id = ? AND sanction_type IN ('SUSPEND', 'BAN')", Long.class, user.id()) > 0;
        if (!hadSanction) return true;
        jdbc.update("UPDATE users SET status = 'ACTIVE' WHERE id = ? AND status = 'SUSPENDED'", user.id());
        return false;
    }

    /** 로그인 거절 안내용 정지: 끝나는 시각(영구면 null) · 사유 */
    public record Suspension(Instant endsAt, String reason) {}

    /** 지금 걸려 있는 정지 (영구 정지, 아니면 가장 늦게 끝나는 것) */
    public Optional<Suspension> activeSuspension(long userId, Instant now) {
        return jdbc.query("SELECT s.ends_at, s.reason FROM user_sanctions s WHERE s.user_id = ? AND " + Sql.ACTIVE_SUSPENSION
                + " ORDER BY CASE WHEN s.ends_at IS NULL THEN 1 ELSE 0 END DESC, s.ends_at DESC",
            (rs, row) -> new Suspension(rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant(), rs.getString(2)),
            userId, Timestamp.from(now), Timestamp.from(now)).stream().findFirst();
    }

    /** 내 정보의 조치 횟수 (해제 · 만료돼도 횟수는 남음) */
    public record SanctionCounts(long warns, long bans) {}

    public SanctionCounts sanctionCounts(long userId) {
        return jdbc.queryForObject("""
            SELECT COALESCE(SUM(CASE WHEN sanction_type = 'WARNING' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN sanction_type IN ('SUSPEND', 'BAN') THEN 1 ELSE 0 END), 0)
            FROM user_sanctions WHERE user_id = ?
            """, (rs, row) -> new SanctionCounts(rs.getLong(1), rs.getLong(2)), userId);
    }

    public record Warning(long id, String reason, Instant at) {}

    /** 아직 확인하지 않은 경고 (앱에 들어올 때 경고 안내 창) */
    public List<Warning> unseenWarnings(long userId) {
        return jdbc.query("""
            SELECT id, reason, starts_at FROM user_sanctions
            WHERE user_id = ? AND sanction_type = 'WARNING' AND seen_at IS NULL AND revoked_at IS NULL ORDER BY starts_at, id
            """, (rs, row) -> new Warning(rs.getLong(1), rs.getString(2), rs.getTimestamp(3).toInstant()), userId);
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

    public void updateNickname(long userId, String nickname) {
        jdbc.update("UPDATE users SET nickname = ? WHERE id = ?", nickname, userId);
    }

    public record Profile(String bio, String avatarFileId, String avatarUrl, String avatarEmoji, String avatarColor) {}

    public Profile profile(long userId) {
        return jdbc.query("""
            SELECT p.bio, f.id AS avatar_file_id, f.storage_url, p.avatar_emoji, p.avatar_color
            FROM user_profiles p LEFT JOIN uploaded_files f ON f.id = p.avatar_file_id
            AND f.user_id = p.user_id AND f.deleted_at IS NULL WHERE p.user_id = ?
            """, (rs, row) -> new Profile(rs.getString("bio"), rs.getString("avatar_file_id"),
                rs.getString("storage_url"), rs.getString("avatar_emoji"), rs.getString("avatar_color")), userId)
            .stream().findFirst().orElse(new Profile("", null, null, null, null));
    }

    public void updateProfile(long userId, ProfilePatch patch) {
        var previous = profile(userId);
        String fileId = patch.has("avatarFileId") ? patch.value("avatarFileId") : previous.avatarFileId();
        if (fileId != null && jdbc.queryForList("""
            SELECT id FROM uploaded_files WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            AND mime_type IN ('image/jpeg', 'image/png') FOR UPDATE
            """, Long.class, Long.parseLong(fileId), userId).isEmpty()) {
            throw new com.zip.backend.common.ApiException(404, "사용할 수 있는 본인 사진 파일이 없어요.");
        }
        String bio = patch.has("bio") ? patch.value("bio") : previous.bio();
        String emoji = patch.has("avatarEmoji") ? patch.value("avatarEmoji") : previous.avatarEmoji();
        String color = patch.has("avatarColor") ? patch.value("avatarColor") : previous.avatarColor();
        if (jdbc.queryForObject("SELECT COUNT(*) FROM user_profiles WHERE user_id = ?", Long.class, userId) == 0) {
            jdbc.update("INSERT INTO user_profiles (user_id, bio, avatar_file_id, avatar_emoji, avatar_color) VALUES (?, ?, ?, ?, ?)",
                userId, bio, fileId, emoji, color);
        } else {
            jdbc.update("UPDATE user_profiles SET bio = ?, avatar_file_id = ?, avatar_emoji = ?, avatar_color = ? WHERE user_id = ?",
                bio, fileId, emoji, color, userId);
        }
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

    public void updateAddress(long userId, String address) {
        jdbc.update("UPDATE users SET address = ? WHERE id = ?", address, userId);
    }

    /** All 구·군 with their 시·도 name, for matching an address to users.region_id. */
    public List<RegionMatcher.District> districts() {
        return jdbc.query("SELECT r.id, r.name, p.name AS parent_name FROM regions r JOIN regions p ON p.id = r.parent_id",
            (rs, row) -> new RegionMatcher.District(rs.getString("id"), rs.getString("name"), rs.getString("parent_name")));
    }

    /** A different neighborhood drops the old neighborhood verification. */
    public void updateRegion(long userId, String regionId) {
        jdbc.update("UPDATE users SET region_id = ?, region_verified_at = NULL WHERE id = ?",
            regionId == null ? null : Long.valueOf(regionId), userId);
    }

    public void revokeSession(long sessionId, long userId, Instant now) {
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
            Timestamp.from(now), sessionId, userId);
    }

    /** storage_url of every file the user uploaded (the physical files are removed after the account is deleted). */
    public List<String> uploadedFileUrls(long userId) {
        return jdbc.queryForList("SELECT storage_url FROM uploaded_files WHERE user_id = ?", String.class, userId);
    }

    /** Only the fact that an account was withdrawn is kept: the old id and the time, nothing personal. */
    public void recordWithdrawal(long userId, Instant now) {
        jdbc.update("INSERT INTO withdrawal_logs (former_user_id, withdrawn_at) VALUES (?, ?)", userId, Timestamp.from(now));
    }

    /** Foreign keys cascade, so this also removes sessions, social links, agreements, settings and the user's own data. */
    public void deleteUser(long userId) {
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }

    public void changePassword(long userId, String hash, Instant now) {
        jdbc.update("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?",
            hash, Timestamp.from(now), userId);
        jdbc.update("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            Timestamp.from(now), userId);
    }
}

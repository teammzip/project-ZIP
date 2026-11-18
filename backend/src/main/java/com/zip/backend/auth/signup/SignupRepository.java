package com.zip.backend.auth.signup;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** SQL for email verification and email sign-up (email_verifications, users). */
@Repository
public class SignupRepository {
    private final JdbcTemplate jdbc;

    public SignupRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean emailTaken(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email) > 0;
    }

    public boolean usernameTaken(String username) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE login_id = ?", Long.class, username) > 0;
    }

    public long createEmailUser(String username, String passwordHash, String nickname, String email, String address, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("""
                INSERT INTO users (login_id, password_hash, nickname, email, email_verified_at, address, age_confirmed_at, signup_provider)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'EMAIL')
                """, new String[] {"id"});
            ps.setString(1, username);
            ps.setString(2, passwordHash);
            ps.setString(3, nickname);
            ps.setString(4, email);
            ps.setTimestamp(5, Timestamp.from(now));
            ps.setString(6, address);
            ps.setTimestamp(7, Timestamp.from(now));
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }
}

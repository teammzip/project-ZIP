package com.zip.backend.auth;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthSessions {
    private static final Pattern REFRESH_TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");
    private final AuthRepository repository;
    private final TokenService tokens;
    private final Clock clock;
    private final Duration accessLifetime;
    private final Duration sessionLifetime;
    private final Duration rememberLifetime;

    public AuthSessions(AuthRepository repository, TokenService tokens, Clock clock,
        @Value("${zip.auth.access-seconds}") long accessSeconds,
        @Value("${zip.auth.session-seconds}") long sessionSeconds,
        @Value("${zip.auth.remember-session-seconds}") long rememberSeconds) {
        if (accessSeconds <= 0 || sessionSeconds <= accessSeconds || rememberSeconds < sessionSeconds) {
            throw new IllegalArgumentException("Invalid token or session lifetime");
        }
        this.repository = repository;
        this.tokens = tokens;
        this.clock = clock;
        accessLifetime = Duration.ofSeconds(accessSeconds);
        sessionLifetime = Duration.ofSeconds(sessionSeconds);
        rememberLifetime = Duration.ofSeconds(rememberSeconds);
    }

    public record Issued(long id, String accessToken, String refreshToken, Duration cookieLifetime) {}

    public record Login(Issued session, Map<String, Object> user) {
        public Map<String, Object> body() {
            return Map.of("accessToken", session.accessToken(), "user", user);
        }
    }

    @Transactional
    public Issued create(long userId, boolean remember, Instant now) {
        Instant issuedAt = now.truncatedTo(ChronoUnit.SECONDS);
        Instant expires = issuedAt.plus(remember ? rememberLifetime : sessionLifetime);
        String refresh = tokens.newRefreshToken();
        long id = repository.createSession(userId, TokenService.refreshHash(refresh), remember, issuedAt, expires);
        return issue(id, userId, refresh, expires, remember, issuedAt);
    }

    @Transactional
    public Issued refresh(long id, String refreshToken) {
        if (id <= 0 || refreshToken == null || !REFRESH_TOKEN.matcher(refreshToken).matches()) throw expired();
        Instant now = clock.instant();
        String hash = TokenService.refreshHash(refreshToken);
        var session = repository.findRefreshSession(id, hash, now).orElseThrow(AuthSessions::expired);
        var user = repository.findById(session.userId()).orElseThrow(AuthSessions::expired);
        if (repository.suspended(user, now)) throw new ApiException(403, "이용이 정지된 계정이에요.", "SUSPENDED");

        String next = tokens.newRefreshToken();
        if (!repository.rotateRefreshToken(id, hash, TokenService.refreshHash(next), now)) throw expired();
        return issue(id, session.userId(), next, session.expiresAt(), session.remember(), now);
    }

    private Issued issue(long id, long userId, String refresh, Instant expires, boolean remember, Instant now) {
        Instant accessExpiry = now.plus(accessLifetime);
        if (accessExpiry.isAfter(expires)) accessExpiry = expires;
        String access = tokens.issue(userId, id, now, accessExpiry);
        return new Issued(id, access, refresh, remember ? Duration.between(now, expires) : Duration.ofSeconds(-1));
    }

    private static ApiException expired() {
        return new ApiException(401, "로그인이 만료됐어요.");
    }
}

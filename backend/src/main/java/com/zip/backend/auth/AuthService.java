package com.zip.backend.auth;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AuthRepository repository;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    private final Clock clock;
    private final long accessSeconds;
    private final long rememberSeconds;
    private final String dummyHash;

    public AuthService(AuthRepository repository, PasswordEncoder passwords, TokenService tokens, Clock clock,
        @Value("${zip.auth.access-seconds}") long accessSeconds,
        @Value("${zip.auth.remember-access-seconds}") long rememberSeconds) {
        if (accessSeconds <= 0 || rememberSeconds < accessSeconds) throw new IllegalArgumentException("Invalid token lifetime");
        this.repository = repository;
        this.passwords = passwords;
        this.tokens = tokens;
        this.clock = clock;
        this.accessSeconds = accessSeconds;
        this.rememberSeconds = rememberSeconds;
        this.dummyHash = passwords.encode("unused-account-timing-pad");
    }

    @Transactional
    public Map<String, Object> login(AuthRequests.Login request) {
        var user = repository.findForLogin(request.loginId().trim().toLowerCase(Locale.ROOT)).orElse(null);
        String hash = user == null || user.passwordHash() == null ? dummyHash : user.passwordHash();
        boolean matches = passwords.matches(request.password(), hash);
        if (!matches || user == null || user.passwordHash() == null) {
            throw new ApiException(400, "아이디(이메일) 또는 비밀번호가 맞지 않아요.");
        }
        var now = clock.instant();
        if (repository.suspended(user, now)) throw new ApiException(403, "이용이 정지된 계정이에요.", "SUSPENDED");
        boolean remember = Boolean.TRUE.equals(request.remember());
        var expires = now.plus(Duration.ofSeconds(remember ? rememberSeconds : accessSeconds));
        long sessionId = repository.createSession(user.id(), tokens.sessionHash(), remember, now, expires);
        var response = Map.<String, Object>of("accessToken", tokens.issue(user.id(), sessionId, now, expires),
            "user", userResponse(user, user.lastLoginAt() == null));
        repository.recordLogin(user.id(), now);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(long userId) {
        return userResponse(repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요.")), false);
    }

    private Map<String, Object> userResponse(AuthRepository.Account user, boolean firstLogin) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(user.id()));
        if (user.username() != null) result.put("username", user.username());
        result.put("email", user.email() == null ? "" : user.email());
        result.put("nickname", user.nickname());
        result.put("address", user.address() == null ? "" : user.address());
        result.put("provider", user.provider().toLowerCase(Locale.ROOT));
        result.put("role", user.role());
        result.put("status", user.status());
        result.put("firstLogin", firstLogin);
        var agreedAt = repository.agreedAt(user.id());
        result.put("agreedAt", agreedAt == null ? null : agreedAt.toString());
        result.put("region", user.regionId() == null ? null : Map.of("id", user.regionId(), "name", user.regionName()));
        var profile = repository.profile(user.id());
        result.put("bio", profile.bio());
        result.put("avatarFileId", profile.avatarFileId());
        result.put("avatarUrl", profile.avatarUrl());
        result.put("avatarEmoji", profile.avatarEmoji());
        result.put("avatarColor", profile.avatarColor());
        return result;
    }

    @Transactional
    public void logout(long userId, long sessionId) {
        repository.revokeSession(sessionId, userId, clock.instant());
    }

    @Transactional
    public Map<String, Object> updateProfile(long userId, long sessionId, ProfilePatch patch) {
        repository.lockUser(userId);
        if (!repository.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        if (patch.has("nickname")) repository.updateNickname(userId, patch.value("nickname"));
        repository.updateProfile(userId, patch);
        return me(userId);
    }

    @Transactional
    public void changePassword(long userId, long sessionId, AuthRequests.ChangePassword request) {
        repository.lockUser(userId);
        if (!repository.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        var user = repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요."));
        if (user.passwordHash() == null || !passwords.matches(request.currentPassword(), user.passwordHash())) {
            throw new ApiException(400, "현재 비밀번호가 맞지 않아요.");
        }
        if (request.currentPassword().equals(request.newPassword())) throw new ApiException(400, "현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        repository.changePassword(userId, passwords.encode(request.newPassword()), clock.instant());
    }
}

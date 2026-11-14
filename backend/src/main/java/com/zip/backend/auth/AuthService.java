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
    private final com.zip.backend.files.ProfileFileService files;

    public AuthService(AuthRepository repository, PasswordEncoder passwords, TokenService tokens, Clock clock,
        com.zip.backend.files.ProfileFileService files,
        @Value("${zip.auth.access-seconds}") long accessSeconds,
        @Value("${zip.auth.remember-access-seconds}") long rememberSeconds) {
        if (accessSeconds <= 0 || rememberSeconds < accessSeconds) throw new IllegalArgumentException("Invalid token lifetime");
        this.repository = repository;
        this.passwords = passwords;
        this.tokens = tokens;
        this.clock = clock;
        this.files = files;
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

    /**
     * Finishes a social login (provider is the DB enum name, e.g. GOOGLE) and returns an access token.
     * A first-time social user is created without password or terms agreement, so /api/auth/me reports
     * agreedAt = null and the frontend shows its consent screen. An email already used by another
     * account is rejected instead of silently merged.
     */
    @Transactional
    public String socialLogin(String provider, String subject, String email, String name) {
        var now = clock.instant();
        var user = repository.findBySocial(provider, subject).orElse(null);
        if (user == null) {
            String mail = email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
            if (mail != null && repository.emailTaken(mail)) {
                throw new ApiException(409, "같은 이메일로 가입한 계정이 있어요. 아이디로 로그인해 주세요.", "EMAIL_EXISTS");
            }
            long id = repository.createSocialUser(nickname(name), mail, provider);
            repository.linkSocial(id, provider, subject);
            user = repository.findById(id).orElseThrow(() -> new ApiException(500, "계정을 만들지 못했어요."));
        }
        if (repository.suspended(user, now)) throw new ApiException(403, "이용이 정지된 계정이에요.", "SUSPENDED");
        var expires = now.plus(Duration.ofSeconds(accessSeconds));
        long sessionId = repository.createSession(user.id(), tokens.sessionHash(), false, now, expires);
        repository.recordLogin(user.id(), now);
        return tokens.issue(user.id(), sessionId, now, expires);
    }

    // users.nickname is NOT NULL and 2-12 characters.
    private static String nickname(String name) {
        String clean = name == null ? "" : name.strip();
        if (clean.codePointCount(0, clean.length()) < 2) return "ZIP 사용자";
        return clean.codePointCount(0, clean.length()) <= 12 ? clean
            : clean.substring(0, clean.offsetByCodePoints(0, 12));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(long userId) {
        return userResponse(repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요.")), false);
    }

    /**
     * PATCH /api/auth/me. Three shapes (frontend/API.md): a nickname change, an address change (after consent), or a
     * social user's first consent (address + all four agreements + the current termsVersion). Consent can only be
     * given once; a plain nickname or address change never asks for consent again.
     */
    @Transactional
    public Map<String, Object> updateMe(long userId, long sessionId, AuthRequests.UpdateMe request) {
        repository.lockUser(userId);
        var now = clock.instant();
        if (!repository.sessionActive(sessionId, userId, now)) throw new ApiException(401, "로그인이 만료됐어요.");
        var user = repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요."));
        // Agreement fields = the one-time first consent. An address alone (e.g. after neighborhood verification)
        // is a plain address change that a user who already consented may make at any time.
        boolean consent = request.agreeTerms() != null || request.agreePrivacy() != null
            || request.agreePolicy() != null || request.ageOver14() != null || request.termsVersion() != null;
        boolean addressOnly = !consent && request.address() != null;
        if (request.nickname() == null && !consent && !addressOnly) throw new ApiException(400, "바꿀 내용이 없어요.");

        String nickname = null;
        if (request.nickname() != null) {
            nickname = request.nickname().strip();
            int length = nickname.codePointCount(0, nickname.length());
            if (length < 2 || length > 12) throw new ApiException(400, "닉네임은 2~12자로 입력해 주세요.");
        }
        if (addressOnly) {
            if (repository.agreedAt(userId) == null) throw new ApiException(400, "먼저 약관에 동의해 주세요.");
            String address = request.address().strip();
            if (address.isEmpty()) throw new ApiException(400, "주소를 입력해 주세요.");
            if (address.length() > 200) throw new ApiException(400, "주소는 200자 이내로 입력해 주세요.");
            repository.updateAddress(userId, address);
        }
        if (consent) {
            if (repository.agreedAt(userId) != null) throw new ApiException(400, "이미 약관에 동의했어요.");
            String address = request.address() == null ? "" : request.address().strip();
            if (address.isEmpty()) throw new ApiException(400, "주소를 입력해 주세요.");
            if (address.length() > 200) throw new ApiException(400, "주소는 200자 이내로 입력해 주세요.");
            if (!Boolean.TRUE.equals(request.agreeTerms()) || !Boolean.TRUE.equals(request.agreePrivacy())
                || !Boolean.TRUE.equals(request.agreePolicy()) || !Boolean.TRUE.equals(request.ageOver14())) {
                throw new ApiException(400, "필수 약관에 모두 동의해 주세요.");
            }
            var terms = repository.currentTerms(now);
            boolean complete = terms.stream().map(AuthRepository.CurrentTerm::docType).distinct().count() == 3
                && terms.stream().allMatch(t -> t.version().equals(request.termsVersion()));
            if (!complete) throw new ApiException(400, "약관이 바뀌었어요. 화면을 새로고침해 주세요.", "TERMS_VERSION");
            repository.saveConsent(userId, address, now);
            for (var term : terms) repository.recordAgreement(userId, term.id(), now);
        }
        if (nickname != null) repository.updateNickname(userId, nickname);
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

    /**
     * DELETE /api/auth/me. Removes the account and, through cascading foreign keys, everything that belongs to it
     * (the same for email and social accounts: the social link goes too, so a later social login is a fresh sign-up).
     * Only a withdrawal_logs row (old id + time) remains; uploaded picture files are deleted after the commit.
     * Admin accounts cannot withdraw themselves so the service is never left without an operator.
     */
    @Transactional
    public void withdraw(long userId, long sessionId) {
        repository.lockUser(userId);
        var now = clock.instant();
        if (!repository.sessionActive(sessionId, userId, now)) throw new ApiException(401, "로그인이 만료됐어요.");
        var user = repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요."));
        if ("ADMIN".equals(user.role())) throw new ApiException(403, "관리자 계정은 탈퇴할 수 없어요.");
        var urls = repository.uploadedFileUrls(userId);
        repository.recordWithdrawal(userId, now);
        repository.deleteUser(userId);
        files.deleteAfterCommit(urls);
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

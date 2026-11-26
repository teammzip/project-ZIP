package com.zip.backend.auth;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.NullNode;
import tools.jackson.databind.node.StringNode;

@Service
public class AuthService {
    private final AuthRepository repository;
    private final PasswordEncoder passwords;
    private final AuthSessions sessions;
    private final Clock clock;
    private final String dummyHash;
    private final com.zip.backend.files.ProfileFileService files;
    private final com.zip.backend.region.RegionVerifyService regionVerify;
    private static final DateTimeFormatter LIFTS_AT = DateTimeFormatter.ofPattern("M월 d일 HH:mm").withZone(ZoneId.of("Asia/Seoul"));
    private static final Duration LOGIN_FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final int LOGIN_FAILURE_LIMIT = 5;

    private static class InvalidLogin extends ApiException {
        InvalidLogin(int failures) {
            super(400, "아이디(이메일) 또는 비밀번호가 맞지 않아요."
                + (failures > 0 ? " (누적 실패 " + failures + "/" + LOGIN_FAILURE_LIMIT + "회)" : ""));
        }
    }

    private static class LockedLogin extends ApiException {
        LockedLogin(Instant since) {
            super(423, "로그인이 잠겼어요. (누적 실패 " + LOGIN_FAILURE_LIMIT + "/" + LOGIN_FAILURE_LIMIT + "회) "
                + LIFTS_AT.format(since.plus(LOGIN_FAILURE_WINDOW))
                + " 이후 다시 시도하거나, 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정해 주세요.", "LOGIN_LOCKED");
        }
    }

    public AuthService(AuthRepository repository, PasswordEncoder passwords, AuthSessions sessions, Clock clock,
        com.zip.backend.files.ProfileFileService files, com.zip.backend.region.RegionVerifyService regionVerify) {
        this.repository = repository;
        this.passwords = passwords;
        this.sessions = sessions;
        this.clock = clock;
        this.files = files;
        this.regionVerify = regionVerify;
        this.dummyHash = passwords.encode("unused-account-timing-pad");
    }

    @Transactional(noRollbackFor = {InvalidLogin.class, LockedLogin.class})
    public AuthSessions.Login login(AuthRequests.Login request) {
        var user = repository.findForLogin(request.loginId().trim().toLowerCase(Locale.ROOT)).orElse(null);
        String hash = user == null || user.passwordHash() == null ? dummyHash : user.passwordHash();
        boolean matches = passwords.matches(request.password(), hash);
        if (user == null || user.passwordHash() == null) throw new InvalidLogin(0);
        var now = clock.instant();
        var since = user.loginFailureSince();
        boolean withinWindow = since != null && now.isBefore(since.plus(LOGIN_FAILURE_WINDOW));
        boolean locked = withinWindow && user.loginFailures() >= LOGIN_FAILURE_LIMIT;
        if (!matches) {
            if (locked) throw new LockedLogin(since);
            int failures = withinWindow ? user.loginFailures() + 1 : 1;
            boolean reachedLimit = failures == LOGIN_FAILURE_LIMIT;
            repository.recordLoginFailure(user.id(), failures, !withinWindow || reachedLimit ? now : since);
            if (reachedLimit) throw new LockedLogin(now);
            throw new InvalidLogin(failures);
        }
        if (repository.suspended(user, now)) throw suspendedError(user.id(), now);
        if (locked) throw new LockedLogin(since);
        if (user.loginFailures() > 0) repository.clearLoginFailures(user.id());
        var session = sessions.create(user.id(), Boolean.TRUE.equals(request.remember()), now);
        var response = new AuthSessions.Login(session, userResponse(user));
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
    public AuthSessions.Issued socialLogin(String provider, String subject, String email, String name) {
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
        if (repository.suspended(user, now)) throw suspendedError(user.id(), now);
        var session = sessions.create(user.id(), true, now);
        repository.recordLogin(user.id(), now);
        return session;
    }

    // users.nickname is NOT NULL and 2-12 characters.
    private static String nickname(String name) {
        String clean = name == null ? "" : name.strip();
        if (clean.codePointCount(0, clean.length()) < 2) return "ZIP 사용자";
        return clean.codePointCount(0, clean.length()) <= 12 ? clean
            : clean.substring(0, clean.offsetByCodePoints(0, 12));
    }

    @Transactional(readOnly = true)
    public UserResponse me(long userId) {
        return userResponse(repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요.")));
    }

    /**
     * PATCH /api/auth/me. Three shapes (frontend/API.md): a nickname change, an address change (after consent), or a
     * social user's first consent (address + all four agreements + the current termsVersion). Consent can only be
     * given once; a plain nickname or address change never asks for consent again.
     */
    @Transactional
    public UserResponse updateMe(long userId, long sessionId, AuthRequests.UpdateMe request) {
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
            // 주소는 선택 (가입 뒤 주거 설문에서 받음)
            String address = request.address() == null || request.address().isBlank() ? null : request.address().strip();
            if (address != null && address.length() > 200) throw new ApiException(400, "주소는 200자 이내로 입력해 주세요.");
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
        if (addressOnly || (consent && request.address() != null && !request.address().isBlank())) {
            // users.region_id follows the address' 구·군 (null when none is found), used by the map and community.
            String regionId = RegionMatcher.match(request.address(), repository.districts()).orElse(null);
            if (!java.util.Objects.equals(regionId, user.regionId())) repository.updateRegion(userId, regionId);
        }
        return userResponse(repository.findById(userId).orElseThrow(() -> new ApiException(401, "로그인 정보가 없어요.")));
    }

    /** 로그인 거절: 언제 풀리는지 · 사유를 같이 알려 줌 (예: 이용이 정지된 계정이에요. (11월 20일 18:00 해제) 사유: 욕설) */
    private ApiException suspendedError(long userId, Instant now) {
        var detail = new StringBuilder("이용이 정지된 계정이에요.");
        repository.activeSuspension(userId, now).ifPresent(s -> {
            detail.append(s.endsAt() == null ? " (영구 정지)" : " (" + LIFTS_AT.format(s.endsAt()) + " 해제)");
            if (s.reason() != null && !s.reason().isBlank()) detail.append(" 사유: ").append(s.reason());
        });
        return new ApiException(403, detail.toString(), "SUSPENDED");
    }

    private UserResponse userResponse(AuthRepository.Account user) {
        var personalBirth = repository.personalBirth(user.id());
        JsonNode birth = null;
        // No personal-info row omits the field. A row with no date reports an explicit null.
        if (!personalBirth.isEmpty()) {
            String date = personalBirth.get(0);
            birth = date.isEmpty() ? NullNode.getInstance() : StringNode.valueOf(date);
        }
        boolean firstLogin = "PENDING".equals(repository.housingSurveyStatus(user.id()));
        var agreedAt = repository.agreedAt(user.id());
        // 동네 전체 이름(fullName)은 다른 기기에서 인증한 회원의 날씨 · 지도 위치를 찾을 때 씀
        var region = user.regionId() == null ? null
            : new UserResponse.Region(user.regionId(), user.regionName(), repository.regionFullName(user.regionId()));
        var counts = repository.sanctionCounts(user.id());
        var warnings = repository.unseenWarnings(user.id()).stream()
            .map(w -> new UserResponse.Warning(Long.toString(w.id()), w.reason() == null ? "" : w.reason(), w.at().toString()))
            .toList();
        // 동네 인증 (30일 유지). 지났거나 동네가 바뀌었으면 null
        String regionVerifiedAt = regionVerify.verifiedAt(user.id()).map(Object::toString).orElse(null);
        var profile = repository.profile(user.id());
        return new UserResponse(Long.toString(user.id()), user.username(), user.email() == null ? "" : user.email(),
            user.nickname(), birth, user.address() == null ? "" : user.address(), user.provider().toLowerCase(Locale.ROOT),
            user.role(), user.status(), firstLogin, agreedAt == null ? null : agreedAt.toString(), region,
            counts.warns(), counts.bans(), warnings, regionVerifiedAt, profile.bio(), profile.avatarFileId(),
            profile.avatarUrl(), profile.avatarEmoji(), profile.avatarColor());
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
        var touchedPosts = repository.postsTouchedBy(userId);
        repository.recordWithdrawal(userId, now);
        repository.deleteUser(userId);
        repository.recountPosts(touchedPosts); // 지워진 공감 · 댓글만큼 남의 글 숫자도 맞춤
        files.deleteAfterCommit(urls);
    }

    @Transactional
    public UserResponse updateProfile(long userId, long sessionId, ProfilePatch patch) {
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

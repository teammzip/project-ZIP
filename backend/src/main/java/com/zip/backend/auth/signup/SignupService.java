package com.zip.backend.auth.signup;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.AuthService;
import com.zip.backend.auth.AuthSessions;
import com.zip.backend.auth.RegionMatcher;
import com.zip.backend.auth.emailcheck.EmailAuthService;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Email sign-up. The email is verified first by {@link EmailAuthService}. */
@Service
public class SignupService {
    private final SignupRepository signups;
    private final AuthRepository accounts;
    private final AuthService auth;
    private final EmailAuthService emailAuth;
    private final PasswordEncoder passwords;
    private final AuthSessions sessions;
    private final Clock clock;

    public SignupService(SignupRepository signups, AuthRepository accounts, AuthService auth, EmailAuthService emailAuth,
        PasswordEncoder passwords, AuthSessions sessions, Clock clock) {
        this.signups = signups;
        this.accounts = accounts;
        this.auth = auth;
        this.emailAuth = emailAuth;
        this.passwords = passwords;
        this.sessions = sessions;
        this.clock = clock;
    }

    /**
     * Email sign-up. The email must be verified first (token from POST /api/auth/email/verify, spent here once);
     * if anything below fails the whole transaction rolls back and the token stays usable.
     */
    @Transactional
    public AuthSessions.Login signup(SignupRequests.Signup request) {
        if (!Boolean.TRUE.equals(request.agreeTerms()) || !Boolean.TRUE.equals(request.agreePrivacy())
            || !Boolean.TRUE.equals(request.agreePolicy()) || !Boolean.TRUE.equals(request.ageOver14())) {
            throw new ApiException(400, "필수 약관에 모두 동의해 주세요.");
        }
        var now = clock.instant();
        var terms = accounts.currentTerms(now);
        boolean complete = terms.stream().map(AuthRepository.CurrentTerm::docType).distinct().count() == 3
            && terms.stream().allMatch(t -> t.version().equals(request.termsVersion()));
        if (!complete) throw new ApiException(400, "약관이 바뀌었어요. 화면을 새로고침해 주세요.", "TERMS_VERSION");
        String nickname = request.nickname().strip();
        int length = nickname.codePointCount(0, nickname.length());
        if (length < 2 || length > 12) throw new ApiException(400, "닉네임은 2~12자로 입력해 주세요.");
        String address = request.address().strip();
        if (address.isEmpty()) throw new ApiException(400, "주소를 입력해 주세요.");
        String email = EmailAuthService.normalize(request.email());

        emailAuth.consume(email, request.emailVerificationToken(), "SIGNUP");
        if (signups.usernameTaken(request.username())) throw new ApiException(409, "이미 사용 중인 아이디예요.", "USERNAME_EXISTS");
        if (signups.emailTaken(email)) throw new ApiException(409, "이미 가입된 이메일이에요.", "EMAIL_EXISTS");
        long id;
        try {
            id = signups.createEmailUser(request.username(), passwords.encode(request.password()), nickname, email, address, now);
        } catch (DuplicateKeyException raced) {
            throw new ApiException(409, "이미 사용 중인 아이디나 이메일이에요.", "USER_EXISTS");
        }
        for (var term : terms) accounts.recordAgreement(id, term.id(), now);
        String regionId = RegionMatcher.match(address, accounts.districts()).orElse(null);
        if (regionId != null) accounts.updateRegion(id, regionId);

        var session = sessions.create(id, true, now);
        var response = new AuthSessions.Login(session, auth.me(id));
        accounts.recordLogin(id, now);
        return response;
    }
}

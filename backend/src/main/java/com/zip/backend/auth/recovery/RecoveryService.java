package com.zip.backend.auth.recovery;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.emailcheck.EmailAuthService;
import com.zip.backend.common.ApiException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Find id and reset password for people who cannot log in. The email is verified first by {@link EmailAuthService}. */
@Service
public class RecoveryService {
    private final RecoveryRepository recovery;
    private final AuthRepository accounts;
    private final EmailAuthService emailAuth;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RecoveryService(RecoveryRepository recovery, AuthRepository accounts, EmailAuthService emailAuth,
        PasswordEncoder passwords, Clock clock) {
        this.recovery = recovery;
        this.accounts = accounts;
        this.emailAuth = emailAuth;
        this.passwords = passwords;
        this.clock = clock;
    }

    /** Find id: the nickname must belong to the verified email. The token is spent even when nothing matches. */
    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> findId(RecoveryRequests.FindId request) {
        String email = EmailAuthService.normalize(request.email());
        emailAuth.consume(email, request.emailVerificationToken(), "FIND_ID");
        String username = recovery.usernameByNicknameAndEmail(request.nickname().strip(), email)
            .orElseThrow(() -> new ApiException(404, "입력한 정보와 맞는 계정이 없어요.", "ACCOUNT_NOT_FOUND"));
        return Map.of("username", username);
    }

    /** Reset step 1: id + verified email match, so hand out a short-lived one-time reset token. */
    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> verifyPasswordReset(RecoveryRequests.PasswordResetVerify request) {
        String email = EmailAuthService.normalize(request.email());
        Long userId = emailAuth.consume(email, request.emailVerificationToken(), "RESET_PASSWORD");
        String username = request.username().strip().toLowerCase(Locale.ROOT);
        if (userId == null || !recovery.usernameMatchesEmail(userId, username, email)) {
            throw new ApiException(404, "입력한 정보와 맞는 계정이 없어요.", "ACCOUNT_NOT_FOUND");
        }
        var now = clock.instant();
        String token = EmailAuthService.randomToken(random);
        recovery.insertPasswordReset(userId, EmailAuthService.sha256(token), now, now.plus(Duration.ofMinutes(15)));
        return Map.of("resetToken", token);
    }

    /** Reset step 2: the new password. All sessions of that account are signed out. */
    @Transactional
    public void resetPassword(RecoveryRequests.PasswordReset request) {
        var now = clock.instant();
        long userId = recovery.spendPasswordReset(EmailAuthService.sha256(request.resetToken().strip()), now)
            .orElseThrow(() -> new ApiException(400, "재설정 시간이 지났거나 이미 썼어요. 처음부터 다시 해 주세요.", "RESET_EXPIRED"));
        accounts.changePassword(userId, passwords.encode(request.newPassword()), now);
    }
}

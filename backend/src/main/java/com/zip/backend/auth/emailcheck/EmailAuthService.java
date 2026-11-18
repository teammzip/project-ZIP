package com.zip.backend.auth.emailcheck;

import com.zip.backend.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Email verification (email_verifications): send a 6-digit code, check it, hand out a one-time token that
 * sign-up / find-id / password-reset then spend. Codes and tokens are stored only as hashes.
 */
@Service
public class EmailAuthService {
    static final Set<String> PURPOSES = Set.of("SIGNUP", "FIND_ID", "RESET_PASSWORD");
    // 이메일 형식 검사. 예전 정규식은 "a,b@c.com" 처럼 쉼표·꺾쇠·따옴표 등이 들어간 값도 통과시켜서,
    // 메일 헤더에 이상한 값이 들어가거나 여러 주소로 보내지는 것을 막으려고 허용 문자를 영문/숫자와 . _ % + - 로 좁혔다.
    private static final Pattern EMAIL =
        Pattern.compile("^[A-Za-z0-9._%+\\-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9\\-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}$");
    private static final Duration CODE_LIFE = Duration.ofMinutes(3);
    private static final Duration TOKEN_LIFE = Duration.ofMinutes(30);
    private static final Duration RESEND_WAIT = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;
    private static final int MAX_PER_HOUR = 10;

    private final EmailCheckRepository repository;
    private final MailService mail;
    private final Clock clock;
    private final byte[] pepper;
    private final SecureRandom random = new SecureRandom();

    public EmailAuthService(EmailCheckRepository repository, MailService mail, Clock clock,
        @Value("${zip.auth.jwt-secret}") String secret) {
        this.repository = repository;
        this.mail = mail;
        this.clock = clock;
        this.pepper = secret.getBytes(StandardCharsets.UTF_8);
    }

    public static String normalize(String email) {
        String value = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > 100 || !EMAIL.matcher(value).matches()) {
            throw new ApiException(400, "이메일 형식을 확인해 주세요.");
        }
        return value;
    }

    private static String purpose(String value) {
        if (value == null || !PURPOSES.contains(value)) throw new ApiException(400, "인증 목적을 확인해 주세요.");
        return value;
    }

    @Transactional
    public void send(String rawEmail, String rawPurpose) {
        String email = normalize(rawEmail);
        String purpose = purpose(rawPurpose);
        var now = clock.instant();
        Long userId = null;
        if ("SIGNUP".equals(purpose)) {
            if (repository.emailTaken(email)) throw new ApiException(409, "이미 가입된 이메일이에요.", "EMAIL_EXISTS");
        } else {
            userId = repository.userIdByEmail(email)
                .orElseThrow(() -> new ApiException(404, "이 이메일로 가입한 계정을 찾을 수 없어요.", "EMAIL_NOT_FOUND"));
        }
        var last = repository.lastVerificationRequest(email);
        if (last != null && last.plus(RESEND_WAIT).isAfter(now)) {
            throw new ApiException(429, "인증번호는 1분에 한 번만 받을 수 있어요. 잠시 뒤에 다시 눌러 주세요.", "EMAIL_TOO_FAST");
        }
        if (repository.verificationRequestsSince(email, now.minus(Duration.ofHours(1))) >= MAX_PER_HOUR) {
            throw new ApiException(429, "인증번호 요청이 너무 많아요. 한 시간 뒤에 다시 시도해 주세요.", "EMAIL_TOO_MANY");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        long id = repository.insertVerification(purpose, email, userId, hash(code), now, now.plus(CODE_LIFE));
        try {
            mail.send(email, "[ZIP] 이메일 인증번호", "ZIP 인증번호는 " + code + " 입니다.\n"
                + "3분 안에 화면에 입력해 주세요.\n\n본인이 요청하지 않았다면 이 메일은 무시해 주세요.");
        } catch (ApiException failed) {
            repository.deleteVerification(id);
            throw failed;
        }
    }

    /** Checks the code (every try counts, 5 at most) and returns the one-time verification token. */
    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> verify(String rawEmail, String rawCode, String rawPurpose) {
        String email = normalize(rawEmail);
        String purpose = purpose(rawPurpose);
        String code = rawCode == null ? "" : rawCode.strip();
        var now = clock.instant();
        var row = repository.openVerification(email, purpose)
            .orElseThrow(() -> new ApiException(400, "인증번호를 먼저 받아 주세요.", "CODE_MISSING"));
        if (!row.expiresAt().isAfter(now)) throw new ApiException(400, "인증번호 시간이 지났어요. 다시 받아 주세요.", "CODE_EXPIRED");
        if (!repository.countAttempt(row.id(), MAX_ATTEMPTS)) {
            throw new ApiException(429, "너무 많이 틀렸어요. 인증번호를 다시 받아 주세요.", "CODE_LOCKED");
        }
        boolean same = MessageDigest.isEqual(hash(code).getBytes(StandardCharsets.UTF_8), row.codeHash().getBytes(StandardCharsets.UTF_8));
        if (!same) throw new ApiException(400, "인증번호가 맞지 않아요.", "CODE_WRONG");
        String token = randomToken(random);
        if (!repository.markVerified(row.id(), sha256(token), now)) throw new ApiException(400, "인증번호를 다시 받아 주세요.", "CODE_EXPIRED");
        return Map.of("verificationToken", token);
    }

    /**
     * Spends the verification token (once). Call it inside the caller's transaction: if the caller then fails,
     * the token is not used up. Returns the verified user id (find-id / reset) or null (sign-up).
     */
    public Long consume(String rawEmail, String token, String purpose) {
        String email = normalize(rawEmail);
        if (token == null || token.isBlank()) throw new ApiException(400, "이메일 인증을 먼저 해 주세요.", "EMAIL_NOT_VERIFIED");
        var now = clock.instant();
        var row = repository.spendVerification(sha256(token.strip()), email, purpose, now, now.minus(TOKEN_LIFE));
        if (row == null) throw new ApiException(400, "이메일 인증이 만료됐거나 맞지 않아요. 인증을 다시 해 주세요.", "EMAIL_NOT_VERIFIED");
        return row.userId();
    }

    public static String randomToken(SecureRandom random) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hash(String code) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(code.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException(error);
        }
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}

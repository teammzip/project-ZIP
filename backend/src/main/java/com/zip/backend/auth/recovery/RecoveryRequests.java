package com.zip.backend.auth.recovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request bodies of find-id and password-reset (frontend/API.md). The emailVerificationToken comes from POST /api/auth/email/verify. */
public final class RecoveryRequests {
    private RecoveryRequests() {}

    public record FindId(@NotBlank @Size(max = 50) String nickname, @NotBlank @Size(max = 100) String email,
        @NotBlank @Size(max = 100) String emailVerificationToken) {}

    public record PasswordResetVerify(@NotBlank @Size(max = 50) String username, @NotBlank @Size(max = 100) String email,
        @NotBlank @Size(max = 100) String emailVerificationToken) {}

    public record PasswordReset(@NotBlank @Size(max = 100) String resetToken,
        @NotBlank @Size(min = 8, max = 16)
        @Pattern(regexp = "(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*", message = "비밀번호는 영문·숫자·특수문자를 모두 써 주세요.") String newPassword) {}
}

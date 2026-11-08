package com.zip.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthRequests {
    private AuthRequests() {}

    public record Login(
        @NotBlank @Size(max = 100) String loginId,
        @NotBlank @Size(max = 16) String password,
        Boolean remember) {}

    /** PATCH /api/auth/me: a nickname change, or a social user's first consent (address + 4 agreements + version). */
    public record UpdateMe(
        @Size(max = 50) String nickname,
        @Size(max = 200) String address,
        Boolean agreeTerms, Boolean agreePrivacy, Boolean agreePolicy, Boolean ageOver14,
        @Size(max = 20) String termsVersion) {}

    public record ChangePassword(
        @NotBlank @Size(max = 16) String currentPassword,
        @NotBlank @Size(min = 8, max = 16)
        @Pattern(regexp = "(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*") String newPassword) {}
}

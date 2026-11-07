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

    public record ChangePassword(
        @NotBlank @Size(max = 16) String currentPassword,
        @NotBlank @Size(min = 8, max = 16)
        @Pattern(regexp = "(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*") String newPassword) {}
}

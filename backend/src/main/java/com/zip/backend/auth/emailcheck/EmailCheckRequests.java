package com.zip.backend.auth.emailcheck;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request bodies of POST /api/auth/email/send and /email/verify (frontend/API.md). */
public final class EmailCheckRequests {
    private EmailCheckRequests() {}

    public record EmailSend(@NotBlank @Size(max = 100) String email, @NotBlank @Size(max = 20) String purpose) {}

    public record EmailVerify(@NotBlank @Size(max = 100) String email, @NotBlank @Size(max = 10) String code,
        @NotBlank @Size(max = 20) String purpose) {}
}

package com.zip.backend.auth.signup;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request bodies of the sign-up, email verification, find-id and password-reset endpoints (frontend/API.md). */
public final class SignupRequests {
    private SignupRequests() {}

    private static final String PASSWORD_RULE = "(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*";

    /** POST /api/auth/signup (frontend/API.md, 회원가입). The email must have been verified (emailVerificationToken). */
    public record Signup(
        @NotBlank @Pattern(regexp = "[a-z0-9]{6,16}", message = "아이디는 6~16자 영문 소문자·숫자예요.") String username,
        @NotBlank @Size(min = 8, max = 16) @Pattern(regexp = PASSWORD_RULE, message = "비밀번호는 영문·숫자·특수문자를 모두 써 주세요.") String password,
        @NotBlank @Size(min = 2, max = 12) String nickname,
        @NotBlank @Size(max = 100) String email,
        @NotBlank @Size(max = 100) String emailVerificationToken,
        @NotBlank @Size(max = 200) String address,
        Boolean agreeTerms, Boolean agreePrivacy, Boolean agreePolicy, Boolean ageOver14,
        @Size(max = 20) String termsVersion) {}
}

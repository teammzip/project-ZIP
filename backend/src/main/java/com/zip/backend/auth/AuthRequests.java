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
        @Size(max = 20) String termsVersion) {
        private static final java.util.Set<String> KEYS = java.util.Set.of("nickname", "address", "agreeTerms",
            "agreePrivacy", "agreePolicy", "ageOver14", "termsVersion");

        public static UpdateMe from(java.util.Map<String, Object> input) {
            if (!KEYS.containsAll(input.keySet())) throw new com.zip.backend.common.ApiException(400, "알 수 없는 항목이 있어요.");
            return new UpdateMe(text(input, "nickname"), text(input, "address"), flag(input, "agreeTerms"),
                flag(input, "agreePrivacy"), flag(input, "agreePolicy"), flag(input, "ageOver14"), text(input, "termsVersion"));
        }

        private static String text(java.util.Map<String, Object> input, String key) {
            Object value = input.get(key);
            if (value != null && !(value instanceof String)) throw new com.zip.backend.common.ApiException(400, key + "는 문자열이어야 해요.");
            return (String) value;
        }

        private static Boolean flag(java.util.Map<String, Object> input, String key) {
            Object value = input.get(key);
            if (value != null && !(value instanceof Boolean)) throw new com.zip.backend.common.ApiException(400, key + "는 true/false여야 해요.");
            return (Boolean) value;
        }
    }

    public record ChangePassword(
        @NotBlank @Size(max = 16) String currentPassword,
        @NotBlank @Size(min = 8, max = 16)
        @Pattern(regexp = "(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*") String newPassword) {}

}

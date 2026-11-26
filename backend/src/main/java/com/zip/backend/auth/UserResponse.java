package com.zip.backend.auth;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.NullNode;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record UserResponse(
    String id,
    @JsonInclude(JsonInclude.Include.NON_NULL) String username,
    String email,
    String nickname,
    @JsonInclude(JsonInclude.Include.NON_NULL) JsonNode birth,
    String address,
    String provider,
    String role,
    String status,
    boolean firstLogin,
    String agreedAt,
    Region region,
    long warnCount,
    long banCount,
    List<Warning> unseenWarnings,
    String regionVerifiedAt,
    String bio,
    String avatarFileId,
    String avatarUrl,
    String avatarEmoji,
    String avatarColor
) {
    /** name 은 구 이름("중구"), fullName 은 시 · 도를 붙인 이름("서울특별시 중구") */
    public record Region(String id, String name, String fullName) {}

    public record Warning(String id, String reason, String at) {}

    // Accounts with an active suspension are blocked before receiving this response.
    @JsonGetter("suspension")
    public NullNode suspension() {
        return NullNode.getInstance();
    }
}

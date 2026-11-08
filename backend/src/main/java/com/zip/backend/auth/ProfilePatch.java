package com.zip.backend.auth;

import com.zip.backend.common.ApiException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Missing fields preserve existing values; explicit null clears optional profile fields. */
public record ProfilePatch(Map<String, Object> fields) {
    private static final Set<String> ALLOWED = Set.of("nickname", "bio", "avatarFileId", "avatarEmoji", "avatarColor");

    public static ProfilePatch parse(Map<String, Object> input) {
        if (input.isEmpty() || !ALLOWED.containsAll(input.keySet())) {
            throw new ApiException(400, "닉네임·한 줄 소개·캐릭터·배경색·사진 필드만 수정할 수 있어요.");
        }
        var values = new LinkedHashMap<String, Object>();
        for (var entry : input.entrySet()) {
            String key = entry.getKey();
            Object raw = entry.getValue();
            if (raw != null && !(raw instanceof String)) throw new ApiException(400, key + "는 문자열이어야 해요.");
            String value = raw == null ? null : (String) raw;
            switch (key) {
                case "nickname" -> {
                    value = value == null ? null : value.strip();
                    if (value == null || value.length() < 2 || value.length() > 12) throw new ApiException(400, "닉네임은 2~12자로 입력해 주세요.");
                }
                case "bio" -> {
                    value = value == null ? "" : value.strip();
                    if (value.length() > 30) throw new ApiException(400, "한 줄 소개는 30자 이내로 입력해 주세요.");
                }
                case "avatarEmoji" -> {
                    if (value != null && value.length() > 20) throw new ApiException(400, "캐릭터는 20자 이내로 입력해 주세요.");
                    if ("".equals(value)) value = null;
                }
                case "avatarColor" -> {
                    if ("".equals(value)) value = null;
                    if (value != null && !value.matches("#[0-9a-fA-F]{6}")) throw new ApiException(400, "배경색은 #RRGGBB 형식이어야 해요.");
                }
                case "avatarFileId" -> {
                    try {
                        if (value != null && (!value.matches("[1-9][0-9]*") || Long.parseLong(value) <= 0)) throw new NumberFormatException();
                    } catch (NumberFormatException error) { throw new ApiException(400, "사진 파일 ID를 확인해 주세요."); }
                }
                default -> throw new IllegalStateException(key);
            }
            values.put(key, value);
        }
        return new ProfilePatch(Collections.unmodifiableMap(values));
    }

    public boolean has(String key) { return fields.containsKey(key); }
    public String value(String key) { return (String) fields.get(key); }
}

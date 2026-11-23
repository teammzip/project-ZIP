package com.zip.backend.map;

import java.util.regex.Pattern;

/** 카카오 원본 ID와 ZIP 장소 키 사이의 변환. 원본 ID는 문자열 그대로 보존한다. */
final class KakaoPlaceId {
    static final String PREFIX = "kakao:";
    private static final Pattern ID = Pattern.compile("[0-9]{1,50}");

    private KakaoPlaceId() {}

    static boolean isValid(String id) {
        return id != null && ID.matcher(id).matches();
    }

    static String toKey(String id) {
        return PREFIX + id;
    }

    static String fromKey(String key) {
        if (key == null || !key.startsWith(PREFIX)) return null;
        var id = key.substring(PREFIX.length());
        return isValid(id) ? id : null;
    }
}

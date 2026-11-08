package com.zip.backend.settings;

import com.zip.backend.common.ApiException;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import java.util.Set;

public record SettingsInput(Map<String, Object> fields, BigDecimal rent, int rentDay,
    String moveIn, String contractEnd, boolean notiOn) {
    private static final Set<String> ALLOWED = Set.of("rent", "rentDay", "moveIn", "contractEnd", "notiOn",
        "homeAddress", "regionId", "regionName", "regionLocation");

    public static SettingsInput parse(Map<String, Object> input) {
        if (!ALLOWED.containsAll(input.keySet())) throw bad("지원하지 않는 설정 필드가 있어요.");
        BigDecimal rent = number(input.get("rent"), "rent");
        if (rent.signum() < 0 || rent.compareTo(new BigDecimal("9999999999.9999")) > 0
            || rent.stripTrailingZeros().scale() > 4) throw bad("월세는 0~9999999999.9999만원, 소수점 4자리까지 입력해 주세요.");
        int day;
        try { day = number(input.get("rentDay"), "rentDay").intValueExact(); }
        catch (ArithmeticException error) { throw bad("납부일은 정수여야 해요."); }
        if (day < 1 || day > 31) throw bad("납부일은 1~31일이어야 해요.");
        String moveIn = month(input.get("moveIn"), "moveIn");
        String end = month(input.get("contractEnd"), "contractEnd");
        if (!moveIn.isEmpty() && !end.isEmpty() && end.compareTo(moveIn) < 0) throw bad("계약 종료월은 입주월보다 빠를 수 없어요.");
        if (!(input.get("notiOn") instanceof Boolean on)) throw bad("notiOn은 true 또는 false여야 해요.");
        if (input.containsKey("homeAddress")) text(input.get("homeAddress"), "homeAddress", 200, true);
        if (input.containsKey("regionName")) text(input.get("regionName"), "regionName", 200, true);
        return new SettingsInput(input, rent, day, moveIn, end, on);
    }

    static String text(Object raw, String key, int max, boolean nullable) {
        if (raw == null && nullable) return "";
        if (!(raw instanceof String value)) throw bad(key + "는 문자열이어야 해요.");
        value = value.strip();
        if (value.length() > max) throw bad(key + " 길이를 확인해 주세요.");
        return value;
    }

    static BigDecimal number(Object raw, String key) {
        if (!(raw instanceof Number)) throw bad(key + "는 숫자여야 해요.");
        try { return new BigDecimal(raw.toString()); }
        catch (NumberFormatException error) { throw bad(key + "를 확인해 주세요."); }
    }

    static String id(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof String value) || !value.matches("[1-9][0-9]*")) throw bad("regionId는 양의 정수 문자열이어야 해요.");
        try { Long.parseLong(value); } catch (NumberFormatException error) { throw bad("regionId 범위를 확인해 주세요."); }
        return value;
    }

    private static String month(Object raw, String key) {
        String value = text(raw, key, 7, false);
        if (value.isEmpty()) return value;
        try {
            if (!value.matches("[0-9]{4}-(0[1-9]|1[0-2])") || YearMonth.parse(value).getYear() < 1) throw new IllegalArgumentException();
        } catch (RuntimeException error) { throw bad(key + "는 YYYY-MM 형식 또는 빈 문자열이어야 해요."); }
        return value;
    }

    static ApiException bad(String message) { return new ApiException(400, message); }
}

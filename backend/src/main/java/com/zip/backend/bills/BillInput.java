package com.zip.backend.bills;

import com.zip.backend.common.ApiException;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import java.util.Set;

public final class BillInput {
    public static final long MAX_AMOUNT = 9_007_199_254_740_991L;
    private BillInput() {}

    public static void item(Map<String, Object> body, boolean create) {
        if (body.isEmpty() || !Set.of("name", "amount", "tag").containsAll(body.keySet())
            || (create && !body.keySet().containsAll(Set.of("name", "amount", "tag")))) {
            throw bad("고정 지출의 name·amount·tag를 확인해 주세요.");
        }
        if (body.containsKey("name")) text(body.get("name"), "이름", 30);
        if (body.containsKey("tag")) text(body.get("tag"), "분류", 24);
        if (body.containsKey("amount")) amount(body.get("amount"));
    }

    public static void payment(Map<String, Object> body) {
        if (body.isEmpty() || !Set.of("paid", "amount").containsAll(body.keySet())) throw bad("paid 또는 amount를 보내 주세요.");
        if (body.containsKey("paid") && !(body.get("paid") instanceof Boolean)) throw bad("paid는 true 또는 false여야 해요.");
        if (body.containsKey("amount")) amount(body.get("amount"));
    }

    public static String text(Object raw, String label, int max) {
        if (!(raw instanceof String value) || value.strip().isEmpty() || value.strip().length() > max) {
            throw bad(label + "은 공백이 아닌 1~" + max + "자로 입력해 주세요.");
        }
        return value.strip();
    }

    public static long amount(Object raw) {
        if (!(raw instanceof Number)) throw bad("금액은 원 단위 정수여야 해요.");
        try {
            long value = new BigDecimal(raw.toString()).longValueExact();
            if (value < 0 || value > MAX_AMOUNT) throw new ArithmeticException();
            return value;
        } catch (ArithmeticException | NumberFormatException error) { throw bad("금액은 0~9007199254740991원 정수여야 해요."); }
    }

    public static YearMonth month(String raw) {
        try {
            if (raw == null || !raw.matches("[0-9]{4}-(0[1-9]|1[0-2])")) throw new IllegalArgumentException();
            var month = YearMonth.parse(raw);
            if (month.getYear() < 1) throw new IllegalArgumentException();
            return month;
        } catch (RuntimeException error) { throw bad("month는 YYYY-MM 형식이어야 해요."); }
    }

    public static long id(String raw) {
        try {
            if (raw == null || !raw.matches("[1-9][0-9]*")) throw new IllegalArgumentException();
            return Long.parseLong(raw);
        } catch (RuntimeException error) { throw bad("고정 지출 ID를 확인해 주세요."); }
    }

    static ApiException bad(String message) { return new ApiException(400, message); }
}

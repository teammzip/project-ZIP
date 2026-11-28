package com.zip.backend.bills;

import com.zip.backend.common.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class BillInput {
    public static final long MAX_AMOUNT = 9_007_199_254_740_991L;
    private BillInput() {}

    public record MonthlyCreate(String name, String tag, MonthlyDetails details) {}

    public record MonthlyDetails(long amount, LocalDate dueDate, String memo, String memoId) {}

    public static MonthlyCreate monthlyCreate(Map<String, Object> body) {
        String memoId = monthlyMemoId(body);
        requireMonthlyFields(body, Set.of("tag", "amount", "dueDate"),
            Set.of("name", "tag", "amount", "dueDate", "memo", "memoId"));
        String memo = body.containsKey("memo") ? memo(body.get("memo")) : null;
        String name = body.containsKey("name") ? text(body.get("name"), "이름", 30) : null;
        String tag = text(body.get("tag"), "분류", 24);
        return new MonthlyCreate(name == null ? tag : name, tag, monthlyDetails(body, memo, memoId));
    }

    public static MonthlyDetails monthlyUpdate(Map<String, Object> body) {
        String memoId = monthlyMemoId(body);
        requireMonthlyFields(body, Set.of("amount", "dueDate"), Set.of("amount", "dueDate", "memo", "memoId"));
        String memo = body.containsKey("memo") ? memo(body.get("memo")) : null;
        return monthlyDetails(body, memo, memoId);
    }

    private static String monthlyMemoId(Map<String, Object> body) {
        if (!body.containsKey("memoId")) return null;
        String memoId = Objects.toString(body.get("memoId"), "");
        id(memoId);
        return memoId;
    }

    private static void requireMonthlyFields(Map<String, Object> body, Set<String> required, Set<String> allowed) {
        if (!body.keySet().containsAll(required) || !allowed.containsAll(body.keySet())) {
            throw bad("금액과 납부 기한을 입력해 주세요.");
        }
    }

    private static MonthlyDetails monthlyDetails(Map<String, Object> body, String memo, String memoId) {
        return new MonthlyDetails(amount(body.get("amount")), dueDate(body.get("dueDate")), memo, memoId);
    }

    public static String memo(Object raw) {
        if (!(raw instanceof String value) || value.length()>200) throw bad("메모는 200자 이내로 입력해 주세요.");
        return value.strip();
    }

    public static java.time.LocalDate dueDate(Object raw) {
        try {
            if (!(raw instanceof String value) || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new IllegalArgumentException();
            var date = java.time.LocalDate.parse(value);
            if (date.getYear() < 1) throw new IllegalArgumentException();
            return date;
        } catch (RuntimeException error) { throw bad("납부 기한은 YYYY-MM-DD 형식의 실제 날짜여야 해요."); }
    }

    public static void item(Map<String, Object> body, boolean create) {
        if (body.isEmpty() || !Set.of("name", "amount", "tag").containsAll(body.keySet())
            || (create && !body.keySet().containsAll(Set.of("name", "amount", "tag")))) {
            throw bad("고정 지출의 name·amount·tag를 확인해 주세요.");
        }
        if (body.containsKey("name")) text(body.get("name"), "이름", 30);
        if (body.containsKey("tag")) text(body.get("tag"), "분류", 24);
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

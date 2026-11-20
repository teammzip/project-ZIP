package com.zip.backend.settings;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

public record HomeInfoInput(String kind, long deposit, long rent, int rentDay, boolean included,
    long fee, long contractFee, String moveIn, String end, String address, Loan loan) {
    public record Loan(long principal, BigDecimal rate, int day, LocalDate start) {}

    public static HomeInfoInput parse(Map<String, Object> body) {
        if (!Set.of("kind", "deposit", "rent", "rentDay", "mgmtIncluded", "mgmtFee", "contractFee", "moveIn", "contractEnd", "homeAddress", "loan").containsAll(body.keySet())) throw SettingsInput.bad("지원하지 않는 내 집 정보 항목이에요.");
        String kind = SettingsInput.text(body.get("kind"), "계약 유형", 10, false);
        if (!Set.of("monthly", "jeonse").contains(kind)) throw SettingsInput.bad("계약 유형을 확인해 주세요.");
        boolean monthly = kind.equals("monthly");
        long deposit = amount(body.get("deposit"), 9999990000L), rent = amount(body.get("rent"), 99990000L);
        long fee = amount(body.get("mgmtFee"), 9990000L), contractFee = amount(body.get("contractFee"), 9999990000L);
        int day = (int) amount(body.get("rentDay"), 31);
        if (day < 1) throw SettingsInput.bad("납부일은 1~31일이어야 해요.");
        if (!(body.get("mgmtIncluded") instanceof Boolean included)) throw SettingsInput.bad("관리비 포함 여부를 확인해 주세요.");
        var settingFields = new java.util.LinkedHashMap<String,Object>();
        settingFields.put("rent",BigDecimal.valueOf(rent,4)); settingFields.put("rentDay",day); settingFields.put("moveIn",body.getOrDefault("moveIn","")); settingFields.put("contractEnd",body.getOrDefault("contractEnd","")); settingFields.put("notiOn",true);
        var settings = SettingsInput.parse(settingFields);
        String address = body.containsKey("homeAddress") ? SettingsInput.text(body.get("homeAddress"), "집 주소", 200, true) : null;
        Loan loan = parseLoan(body.get("loan"));
        if (monthly && loan != null) throw SettingsInput.bad("월세 계약에는 전세 대출을 설정할 수 없어요.");
        return new HomeInfoInput(kind, monthly ? deposit : 0, monthly ? rent : 0, day, monthly && included,
            monthly && included ? 0 : fee, monthly ? 0 : contractFee, settings.moveIn(), settings.contractEnd(), address, loan);
    }

    public static Loan parseLoan(Object value) {
        if (value == null) return null;
        if (!(value instanceof Map<?, ?> fields) || !fields.keySet().equals(Set.of("principal", "annualRate", "paymentDay", "startDate"))) throw SettingsInput.bad("대출 조건을 확인해 주세요.");
        long principal = amount(fields.get("principal"), 9999990000L);
        BigDecimal rate = SettingsInput.number(fields.get("annualRate"), "이율");
        int loanDay = (int) amount(fields.get("paymentDay"), 31);
        if (principal == 0 || loanDay == 0 || rate.signum() < 0 || rate.compareTo(BigDecimal.valueOf(100)) > 0 || rate.stripTrailingZeros().scale() > 2) throw SettingsInput.bad("대출 금액·이율·납부일을 확인해 주세요.");
        LocalDate start;
        try {
            String raw = SettingsInput.text(fields.get("startDate"), "시작일", 10, false);
            start = LocalDate.parse(raw);
            if (!start.toString().equals(raw) || start.isBefore(LocalDate.of(2000,1,1)) || start.isAfter(LocalDate.of(2100,12,31))) throw new IllegalArgumentException();
        } catch (RuntimeException e) { throw SettingsInput.bad("대출 시작일을 확인해 주세요."); }
        return new Loan(principal, rate, loanDay, start);
    }
    private static long amount(Object value, long max) {
        try {
            long amount = SettingsInput.number(value, "금액·납부일").longValueExact();
            if (amount < 0 || amount > max) throw new ArithmeticException();
            return amount;
        } catch (ArithmeticException e) { throw SettingsInput.bad("금액·납부일 범위를 확인해 주세요."); }
    }
}

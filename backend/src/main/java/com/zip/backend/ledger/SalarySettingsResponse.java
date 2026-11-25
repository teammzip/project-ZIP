package com.zip.backend.ledger;

import com.fasterxml.jackson.annotation.JsonInclude;

public record SalarySettingsResponse(
    long amount,
    String incomePeriod,
    long monthlyAmount,
    int paymentDay,
    String startMonth,
    @JsonInclude(JsonInclude.Include.NON_NULL) Draft draft
) {
    public record Draft(long amount, String incomePeriod) {}

    SalarySettingsResponse withDraft(Draft draft) {
        return new SalarySettingsResponse(amount, incomePeriod, monthlyAmount, paymentDay, startMonth, draft);
    }
}

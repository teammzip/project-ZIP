package com.zip.backend.settings;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.zip.backend.bills.BillResponse;
import java.math.BigDecimal;
import java.util.List;

public record HomeInfoResponse(SettingsResponse settings, Contract contract, Loan loan, LoanDraft loanDraft,
    List<InterestCharge> charges, BillResponse managementBill) {
    public record Contract(String kind, long deposit, boolean mgmtIncluded, long mgmtFee, long contractFee,
        String managementBillId) {}

    public record Loan(String id, String userId, long principal, BigDecimal annualRate, int paymentDay,
        String startDate, boolean active) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoanDraft(Long principal, BigDecimal annualRate, Integer paymentDay, String startDate) {}

    public record InterestCharge(String id, String loanId, String userId, String date, long amount,
        long principal, BigDecimal annualRate) {}
}

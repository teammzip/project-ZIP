package com.zip.backend.ledger;

import com.fasterxml.jackson.annotation.JsonInclude;

public record LedgerRow(
    String id, long amount, String date, String cat, String memo, boolean salaryCategory, boolean salaryManaged,
    @JsonInclude(JsonInclude.Include.NON_NULL) String memoId,
    @JsonInclude(JsonInclude.Include.NON_NULL) String memoTitle
) {}

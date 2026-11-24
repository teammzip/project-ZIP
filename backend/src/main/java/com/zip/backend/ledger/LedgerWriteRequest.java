package com.zip.backend.ledger;

import java.time.LocalDate;

sealed interface LedgerWriteRequest {
    Fields fields();

    record Income(Fields fields, String incomeType) implements LedgerWriteRequest {}

    record Spend(Fields fields) implements LedgerWriteRequest {}

    record Fields(long amount, LocalDate date, String cat, String memo, String memoId, LocalDate today) {}
}

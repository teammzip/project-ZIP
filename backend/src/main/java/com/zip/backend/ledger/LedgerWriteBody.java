package com.zip.backend.ledger;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;

public final class LedgerWriteBody {
    // Keep JSON values uncoerced until validation can check their original types.
    @JsonProperty Object amount;
    @JsonProperty Object date;
    @JsonProperty Object cat;
    @JsonProperty Object memo = "";
    @JsonProperty Object memoId;

    private Object incomeType;
    private boolean incomeTypePresent;
    private boolean unknownFieldPresent;

    @JsonSetter("incomeType")
    void setIncomeType(Object value) {
        incomeType = value;
        incomeTypePresent = true;
    }

    @JsonAnySetter
    void recordUnknownField(String name, Object value) {
        unknownFieldPresent = true;
    }

    boolean hasUnsupportedFields(boolean income) {
        return unknownFieldPresent || (!income && incomeTypePresent);
    }

    Object incomeType() {
        return incomeType;
    }
}

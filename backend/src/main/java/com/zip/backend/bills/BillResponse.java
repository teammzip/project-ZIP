package com.zip.backend.bills;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public record BillResponse(
    String id, String name, String tag, long amount, boolean paid, String paidAt, String month,
    long defaultAmount, boolean active, boolean snapshot, String terminationDate, String dueDate, String memo,
    @JsonInclude(JsonInclude.Include.NON_NULL) String memoId,
    @JsonInclude(JsonInclude.Include.NON_NULL) String memoTitle,
    @JsonInclude(JsonInclude.Include.NON_NULL) Boolean homeManaged
) {
    public record Monthly(
        String month, String currentMonth, String timeZone, String periodFrom, String periodThrough, String queriedAt,
        String contractKind, boolean managementIncluded, ContractPeriod contractPeriod,
        List<HousingItem> housingItems, List<BillResponse> items
    ) {}

    public record ContractPeriod(String from, String through, boolean outside, boolean currentOutside) {}

    public record HousingItem(
        String id, String name, String tag, long amount, long defaultAmount, boolean paid, String paidAt,
        String dueDate, String month, boolean active, boolean snapshot, String source, String memo
    ) {}
}

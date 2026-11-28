package com.zip.backend.memo;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record MemoResponse(
    String id,
    String title,
    String body,
    String color,
    boolean pinned,
    boolean checklist,
    List<Map<String, Object>> items,
    String createdAt,
    String updatedAt,
    String ledgerContext,
    boolean draft,
    String folderId
) {}

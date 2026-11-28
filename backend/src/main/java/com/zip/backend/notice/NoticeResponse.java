package com.zip.backend.notice;

import com.fasterxml.jackson.annotation.JsonInclude;

public record NoticeResponse(
    String id,
    String title,
    @JsonInclude(JsonInclude.Include.NON_NULL) String body,
    boolean pinned,
    boolean popup,
    String author,
    String createdAt,
    String updatedAt
) {}

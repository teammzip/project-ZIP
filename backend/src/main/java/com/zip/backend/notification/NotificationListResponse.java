package com.zip.backend.notification;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public record NotificationListResponse(List<Item> items, int unreadCount) {
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Item(
        String id,
        String type,
        String title,
        String body,
        String link,
        String refId,
        String notifyAt,
        boolean read
    ) {}
}

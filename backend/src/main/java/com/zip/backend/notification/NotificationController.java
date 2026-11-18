package com.zip.backend.notification;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 알림 (frontend/API.md 6장). 로그인 회원의 알림만 */
@RestController
public class NotificationController {
    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) { this.notifications = notifications; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    /** status: all · unread · read → { items, unreadCount } */
    @GetMapping("/api/notifications")
    public Map<String, Object> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String status) {
        return notifications.list(userId(jwt), status);
    }

    /** { ids: [] } 이면 전부 읽음 */
    @PatchMapping("/api/notifications/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) NotificationService.ReadInput input) {
        notifications.markRead(userId(jwt), input);
    }

    /** 읽은 알림 지우기 (?ids=1,2) */
    @DeleteMapping("/api/notifications")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String ids) {
        notifications.deleteRead(userId(jwt), ids);
    }
}

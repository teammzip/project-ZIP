package com.zip.backend.moderation;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 회원 관리 · 경고 · 정지 (frontend/API.md 11장). /api/admin/** 는 ADMIN 만, /api/me/warnings/seen 은 로그인 회원 */
@RestController
public class ModerationController {
    private final ModerationService moderation;

    public ModerationController(ModerationService moderation) { this.moderation = moderation; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    public record UnbanInput(String reason) {}
    public record SeenInput(List<String> ids) {}

    @GetMapping("/api/admin/stats")
    public Map<String, Object> stats() { return moderation.stats(); }

    @GetMapping("/api/admin/members")
    public Map<String, Object> members(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
        @RequestParam(required = false) Integer minBans, @RequestParam(required = false) Integer minWarns,
        @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page) {
        return moderation.members(q, status, minBans, minWarns, sort, page);
    }

    @GetMapping("/api/admin/members/{id}/sanctions")
    public List<Map<String, Object>> sanctions(@PathVariable String id) { return moderation.sanctions(id); }

    @PostMapping("/api/admin/members/{id}/sanctions")
    public Map<String, Object> sanction(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) ModerationService.SanctionInput input) {
        return moderation.sanction(userId(jwt), id, input);
    }

    @DeleteMapping("/api/admin/members/{id}/sanctions/active")
    public Map<String, Object> unban(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) UnbanInput input) {
        return moderation.unban(userId(jwt), id, input == null ? null : input.reason());
    }

    /** 내가 받은 경고 · 정지 내역 */
    @GetMapping("/api/me/sanctions")
    public List<Map<String, Object>> mySanctions(@AuthenticationPrincipal Jwt jwt) { return moderation.mySanctions(userId(jwt)); }

    /** 경고 안내 창의 "확인했어요" → user_sanctions.seen_at */
    @PostMapping("/api/me/warnings/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void seen(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) SeenInput input) {
        moderation.markWarningsSeen(userId(jwt), input == null ? null : input.ids());
    }
}

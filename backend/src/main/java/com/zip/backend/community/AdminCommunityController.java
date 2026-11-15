package com.zip.backend.community;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * 관리자 커뮤니티 관리 (frontend/API.md 11장 중 게시글 · 신고). /api/admin/** 는 보안 설정에서 ADMIN 만 통과해요.
 * 삭제 사유(?reason=)는 posts · comments 의 delete_reason 에, 지운 운영자는 deleted_by 에 남겨요. 작성자 경고 · 정지는 회원 관리 API 로 따로.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminCommunityController {
    private final CommunityService community;

    public AdminCommunityController(CommunityService community) { this.community = community; }

    private static long adminId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    /** 신고 처리: HIDDEN(내용 삭제) · DISMISSED(문제없음) */
    public record Resolution(String status) {}

    @GetMapping("/posts")
    public Map<String, Object> posts(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String category,
        @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page) {
        return community.adminPosts(adminId(jwt), category, q, page);
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam(required = false) String reason) {
        community.adminDeletePost(adminId(jwt), id, reason);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam(required = false) String reason) {
        community.adminDeleteComment(adminId(jwt), id, reason);
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> staffComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) CommunityRequests.CommentInput input) {
        return community.adminComment(adminId(jwt), id, input);
    }

    @PutMapping("/posts/{id}/home-tip")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addHomeTip(@PathVariable String id) { community.adminHomeTip(id, true); }

    @DeleteMapping("/posts/{id}/home-tip")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeHomeTip(@PathVariable String id) { community.adminHomeTip(id, false); }

    @GetMapping("/reports")
    public List<Map<String, Object>> reports(@RequestParam(required = false) String status) { return community.adminReports(status); }

    /** 같은 대상(글 하나 · 댓글 하나)의 접수 중 신고를 한꺼번에 처리 */
    @PatchMapping("/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolveTarget(@AuthenticationPrincipal Jwt jwt, @RequestParam String targetType, @RequestParam String targetId,
        @RequestBody(required = false) Resolution body) {
        community.adminResolve(adminId(jwt), targetType, targetId, body == null ? null : body.status());
    }

    @PatchMapping("/reports/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolveReport(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) Resolution body) {
        community.adminResolveReport(adminId(jwt), id, body == null ? null : body.status());
    }
}

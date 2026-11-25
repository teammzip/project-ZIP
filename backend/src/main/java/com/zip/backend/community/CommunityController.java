package com.zip.backend.community;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 커뮤니티 API (frontend/API.md 7장 · openapi.yaml "커뮤니티"). 모두 로그인 후 요청 */
@RestController
public class CommunityController {
    private final CommunityService community;

    public CommunityController(CommunityService community) { this.community = community; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    @GetMapping("/api/posts")
    public PostResponse.Page posts(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String scope,
        @RequestParam(required = false) String category, @RequestParam(required = false) String q,
        @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page) {
        return community.posts(userId(jwt), scope, category, q, sort, page);
    }

    @GetMapping("/api/posts/my-count")
    public Map<String, Long> myPostCount(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("count", community.myPostCount(userId(jwt)));
    }

    @GetMapping("/api/posts/home-tips")
    public List<PostResponse> homeTips(@AuthenticationPrincipal Jwt jwt) { return community.homeTips(userId(jwt)); }

    /** "주변 동네" 탭 안내: 내 동네와 이웃 동네 이름 (글 목록 scope=near 와 같은 기준) */
    @GetMapping("/api/posts/neighbors")
    public Map<String, Object> neighbors(@AuthenticationPrincipal Jwt jwt) { return community.neighbors(userId(jwt)); }

    @GetMapping("/api/posts/popular")
    public List<PostResponse> popularPosts(@AuthenticationPrincipal Jwt jwt) { return community.popularPosts(userId(jwt)); }

    @GetMapping("/api/posts/{id}")
    public PostResponse post(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { return community.post(userId(jwt), id); }

    @PostMapping("/api/posts/{id}/views")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordView(@PathVariable String id) { community.recordView(id); }

    @PostMapping("/api/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) CommunityRequests.PostInput input) {
        return community.createPost(userId(jwt), input);
    }

    @PatchMapping("/api/posts/{id}")
    public PostResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) CommunityRequests.PostInput input) {
        return community.updatePost(userId(jwt), id, input);
    }

    @DeleteMapping("/api/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { community.deletePost(userId(jwt), id); }

    @PutMapping("/api/posts/{id}/like")
    public Map<String, Object> like(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { return community.like(userId(jwt), id, true); }

    @DeleteMapping("/api/posts/{id}/like")
    public Map<String, Object> unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { return community.like(userId(jwt), id, false); }

    @PostMapping("/api/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse.Comment addComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) CommunityRequests.CommentInput input) {
        return community.addComment(userId(jwt), id, input);
    }

    @PatchMapping("/api/comments/{id}")
    public PostResponse.Comment updateComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) CommunityRequests.CommentInput input) {
        return community.updateComment(userId(jwt), id, input);
    }

    @DeleteMapping("/api/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { community.deleteComment(userId(jwt), id); }

    @PostMapping("/api/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) CommunityRequests.ReportInput input) {
        community.report(userId(jwt), input);
    }
}

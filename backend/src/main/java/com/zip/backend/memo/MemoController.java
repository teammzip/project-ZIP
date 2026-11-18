package com.zip.backend.memo;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 메모 (frontend/API.md 12장). 로그인 회원의 메모만 */
@RestController
public class MemoController {
    private final MemoService memos;

    public MemoController(MemoService memos) { this.memos = memos; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    @GetMapping("/api/memos")
    public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String q) {
        return memos.list(userId(jwt), q);
    }

    @PostMapping("/api/memos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) MemoService.MemoInput input) {
        return memos.create(userId(jwt), input);
    }

    @PatchMapping("/api/memos/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) MemoService.MemoInput input) {
        return memos.update(userId(jwt), id, input);
    }

    @DeleteMapping("/api/memos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        memos.delete(userId(jwt), id);
    }

    /** 홈 메모 위젯에 보일 메모 · 순서 ({ ids: null } = 자동) */
    @GetMapping("/api/me/home-memos")
    public Map<String, Object> home(@AuthenticationPrincipal Jwt jwt) { return memos.homeMemos(userId(jwt)); }

    @PutMapping("/api/me/home-memos")
    public Map<String, Object> saveHome(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) MemoService.HomeInput input) {
        return memos.saveHomeMemos(userId(jwt), input);
    }
}

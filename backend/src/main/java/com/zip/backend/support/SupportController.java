package com.zip.backend.support;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 고객센터 (frontend/API.md 13장). /api/support/** 는 로그인 회원, /api/admin/support/** 는 ADMIN 만 */
@RestController
public class SupportController {
    private final SupportService support;

    public SupportController(SupportService support) { this.support = support; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    /** 내 문의 (최근 것부터) */
    @GetMapping("/api/support/inquiries")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) { return support.mine(userId(jwt)); }

    @PostMapping("/api/support/inquiries")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) SupportService.InquiryInput input) {
        return support.create(userId(jwt), input);
    }

    /** 관리자: 전체 문의 (답변 대기부터) */
    @GetMapping("/api/admin/support/inquiries")
    public List<Map<String, Object>> all() { return support.all(); }

    /** 관리자 답변 (문의당 하나) */
    @PostMapping("/api/admin/support/inquiries/{id}/answer")
    public Map<String, Object> answer(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
        @RequestBody(required = false) SupportService.AnswerInput input) {
        return support.answer(userId(jwt), id, input);
    }
}

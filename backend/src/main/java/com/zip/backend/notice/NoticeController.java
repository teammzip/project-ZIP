package com.zip.backend.notice;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 공지사항 (frontend/API.md 14장). /api/notices 는 로그인 회원, /api/admin/notices 는 ADMIN 만 */
@RestController
public class NoticeController {
    private final NoticeService notices;

    public NoticeController(NoticeService notices) { this.notices = notices; }

    /** 목록 (고정 먼저, 새 것부터 · 내용 빼고) */
    @GetMapping("/api/notices")
    public List<NoticeResponse> list() { return notices.list(); }

    /** 앱을 열면 띄울 팝업 공지 (내용 포함) */
    @GetMapping("/api/notices/popups")
    public List<NoticeResponse> popups() { return notices.popups(); }

    @GetMapping("/api/notices/{id}")
    public NoticeResponse get(@PathVariable String id) { return notices.get(id); }

    @PostMapping("/api/admin/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) NoticeService.NoticeInput input) {
        return notices.create(Long.parseLong(jwt.getSubject()), input);
    }

    @PatchMapping("/api/admin/notices/{id}")
    public NoticeResponse update(@PathVariable String id, @RequestBody(required = false) NoticeService.NoticeInput input) {
        return notices.update(id, input);
    }

    @DeleteMapping("/api/admin/notices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { notices.delete(id); }
}

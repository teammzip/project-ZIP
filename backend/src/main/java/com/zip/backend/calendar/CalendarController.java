package com.zip.backend.calendar;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 일정 · 일정 카테고리 · 항목 버튼 · 쓰레기 배출표 (frontend/API.md 3장). 로그인 회원의 것만 */
@RestController
public class CalendarController {
    private final CalendarService calendar;

    public CalendarController(CalendarService calendar) { this.calendar = calendar; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    /** from · to 가 없으면 전부 */
    @GetMapping("/api/events")
    public List<Map<String, Object>> events(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return calendar.events(userId(jwt), from, to);
    }

    @PostMapping("/api/events")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) CalendarService.EventInput input) {
        return calendar.createEvent(userId(jwt), input);
    }

    @PatchMapping("/api/events/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) CalendarService.EventInput input) {
        return calendar.updateEvent(userId(jwt), id, input);
    }

    @DeleteMapping("/api/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        calendar.deleteEvent(userId(jwt), id);
    }

    @GetMapping("/api/event-categories")
    public List<Map<String, Object>> categories(@AuthenticationPrincipal Jwt jwt) { return calendar.categories(userId(jwt)); }

    @PostMapping("/api/event-categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createCategory(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) CalendarService.NameInput input) {
        return calendar.createCategory(userId(jwt), input);
    }

    @PatchMapping("/api/event-categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void renameCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) CalendarService.NameInput input) {
        calendar.renameCategory(userId(jwt), id, input);
    }

    @DeleteMapping("/api/event-categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        calendar.deleteCategory(userId(jwt), id);
    }

    @GetMapping("/api/event-presets")
    public List<Map<String, Object>> presets(@AuthenticationPrincipal Jwt jwt) { return calendar.presets(userId(jwt)); }

    @PostMapping("/api/event-presets")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createPreset(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) CalendarService.PresetInput input) {
        return calendar.createPreset(userId(jwt), input);
    }

    @PatchMapping("/api/event-presets/{id}")
    public Map<String, Object> updatePreset(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody(required = false) CalendarService.PresetInput input) {
        return calendar.updatePreset(userId(jwt), id, input);
    }

    @DeleteMapping("/api/event-presets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePreset(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        calendar.deletePreset(userId(jwt), id);
    }

    @GetMapping("/api/trash-schedules/me")
    public CalendarService.MyTrashSchedule myTrash(@AuthenticationPrincipal Jwt jwt) {
        return calendar.myTrashSchedule(userId(jwt));
    }
}

package com.zip.backend.bills;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bills")
public class BillController {
    private final BillService service;
    public BillController(BillService service) { this.service = service; }
    private long user(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }
    private long session(Jwt jwt) { return Long.parseLong(jwt.getClaimAsString("sid")); }

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String month) {
        return service.list(user(jwt), BillInput.month(month));
    }

    @PostMapping("/monthly/auto-register")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void autoRegister(@AuthenticationPrincipal Jwt jwt,@RequestParam String timeZone) {
        service.autoRegister(user(jwt),session(jwt),timeZone);
    }
    @GetMapping("/monthly")
    public Map<String, Object> monthly(@AuthenticationPrincipal Jwt jwt, @RequestParam String month, @RequestParam String timeZone) {
        return service.monthly(user(jwt), BillInput.month(month), timeZone);
    }
    @PostMapping("/monthly")
    public Map<String, Object> registerMonthly(@AuthenticationPrincipal Jwt jwt, @RequestParam String month, @RequestParam String timeZone, @RequestBody Map<String, Object> body) {
        return service.registerMonthly(user(jwt), session(jwt), month, timeZone, body);
    }
    @PatchMapping("/monthly/{id}")
    public Map<String, Object> updateMonthly(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam String month, @RequestParam String timeZone, @RequestBody Map<String, Object> body) {
        return service.updateMonthly(user(jwt), session(jwt), BillInput.id(id), month, timeZone, body);
    }
    @DeleteMapping("/monthly/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMonthly(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam String month, @RequestParam String timeZone) {
        service.deleteMonthly(user(jwt), session(jwt), BillInput.id(id), month, timeZone);
    }
    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> body) {
        return service.create(user(jwt), session(jwt), body);
    }
    @PatchMapping("/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Map<String, Object> body) {
        return service.update(user(jwt), session(jwt), BillInput.id(id), body);
    }
    @PutMapping("/{id}/payments/{month}")
    public Map<String, Object> pay(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String month, @RequestBody Map<String, Object> body) {
        return service.pay(user(jwt), session(jwt), BillInput.id(id), BillInput.month(month), body);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) { service.remove(user(jwt), session(jwt), BillInput.id(id)); }
}

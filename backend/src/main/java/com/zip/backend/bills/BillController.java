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

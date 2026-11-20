package com.zip.backend.ledger;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/salary")
public class SalaryController {
    private final SalaryService salary;
    public SalaryController(SalaryService salary) { this.salary=salary; }
    @GetMapping
    public Map<String,Object> get(@AuthenticationPrincipal Jwt jwt) { return salary.getWithDraft(Long.parseLong(jwt.getSubject())); }
    @PutMapping
    public Map<String,Object> save(@AuthenticationPrincipal Jwt jwt,@RequestParam String timeZone,@RequestBody Map<String,Object> input) {
        return salary.save(Long.parseLong(jwt.getSubject()),Long.parseLong(jwt.getClaimAsString("sid")),timeZone,input);
    }
}

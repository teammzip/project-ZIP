package com.zip.backend.ledger;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ledger")
public class LedgerController {
    private final LedgerService ledger;

    public LedgerController(LedgerService ledger) {
        this.ledger = ledger;
    }

    @GetMapping("/{kind}")
    public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @PathVariable String kind,
                                         @RequestParam String month, @RequestParam String timeZone,
                                         @RequestParam(defaultValue = "fixed") String incomeType) {
        return ledger.list(user(jwt), kind, month, timeZone, incomeType);
    }

    @PostMapping("/{kind}")
    @ResponseStatus(HttpStatus.CREATED)
    public void create(@AuthenticationPrincipal Jwt jwt, @PathVariable String kind, @RequestParam String timeZone,
                       @RequestBody Map<String, Object> body) {
        ledger.create(user(jwt), session(jwt), kind, timeZone, body);
    }

    @PutMapping("/{kind}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal Jwt jwt, @PathVariable String kind, @PathVariable String id,
                       @RequestParam String timeZone, @RequestBody Map<String, Object> body) {
        ledger.update(user(jwt), session(jwt), kind, id, timeZone, body);
    }

    @DeleteMapping("/{kind}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String kind, @PathVariable String id) {
        ledger.delete(user(jwt), session(jwt), kind, id);
    }

    @GetMapping("/income-summary")
    public Map<String, Long> summary(@AuthenticationPrincipal Jwt jwt, @RequestParam String timeZone) {
        return ledger.summary(user(jwt), timeZone);
    }

    private long user(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }

    private long session(Jwt jwt) {
        return Long.parseLong(jwt.getClaimAsString("sid"));
    }
}

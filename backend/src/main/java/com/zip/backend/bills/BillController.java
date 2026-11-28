package com.zip.backend.bills;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bills")
public class BillController {
    private final BillService service;
    private final BillSettlementService settlement;
    public BillController(BillService service,BillSettlementService settlement) { this.service = service; this.settlement=settlement; }
    private long user(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }
    private long session(Jwt jwt) { return Long.parseLong(jwt.getClaimAsString("sid")); }

    // 예전 일반 고정 지출 API(GET · POST /api/bills, PATCH · DELETE /api/bills/{id}, PUT /api/bills/{id}/payments/{month})는
    // 화면이 월별 API 로 바뀐 뒤 쓰이지 않아 2026-11-28 에 지웠다. 화면은 아래 /monthly 만 쓴다.

    @PostMapping("/monthly/auto-register")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void autoRegister(@AuthenticationPrincipal Jwt jwt,@RequestParam String timeZone,@RequestParam(required=false) String month) {
        service.autoRegister(user(jwt),session(jwt),timeZone,month==null?null:BillInput.month(month));
    }
    @GetMapping("/monthly")
    public BillResponse.Monthly monthly(@AuthenticationPrincipal Jwt jwt, @RequestParam String month, @RequestParam String timeZone) {
        return service.monthly(user(jwt), BillInput.month(month), timeZone);
    }
    @PostMapping("/monthly")
    public BillResponse registerMonthly(@AuthenticationPrincipal Jwt jwt, @RequestParam String month, @RequestParam String timeZone, @RequestBody Map<String, Object> body) {
        return service.registerMonthly(user(jwt), session(jwt), service.writableMonth(month, timeZone), timeZone,
            BillInput.monthlyCreate(body));
    }
    @PatchMapping("/monthly/{id}")
    public BillResponse updateMonthly(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam String month, @RequestParam String timeZone, @RequestBody Map<String, Object> body) {
        return service.updateMonthly(user(jwt), session(jwt), BillInput.id(id), service.writableMonth(month, timeZone), timeZone,
            BillInput.monthlyUpdate(body));
    }
    @PutMapping("/monthly/{id}/payment")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void payment(@AuthenticationPrincipal Jwt jwt,@PathVariable String id,@RequestParam String month,@RequestParam String timeZone,@RequestBody Map<String,Object> body) {
        settlement.payment(user(jwt),session(jwt),id,month,timeZone,body);
    }
    @PostMapping("/monthly/{id}/termination")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void terminate(@AuthenticationPrincipal Jwt jwt,@PathVariable String id,@RequestParam String timeZone,@RequestBody Map<String,Object> body) {
        settlement.terminate(user(jwt),session(jwt),BillInput.id(id),timeZone,body);
    }
    @DeleteMapping("/monthly/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMonthly(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestParam String month, @RequestParam String timeZone) {
        service.deleteMonthly(user(jwt), session(jwt), BillInput.id(id), month, timeZone);
    }
}

package com.zip.backend.settings;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/home-info")
public class HomeInfoController {
    private final HomeInfoService service;
    public HomeInfoController(HomeInfoService service) { this.service = service; }
    @GetMapping public Map<String,Object> get(@AuthenticationPrincipal Jwt jwt) {
        return service.get(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")));
    }
    @PutMapping public Map<String,Object> put(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String,Object> body) {
        return service.save(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), HomeInfoInput.parse(body));
    }
}

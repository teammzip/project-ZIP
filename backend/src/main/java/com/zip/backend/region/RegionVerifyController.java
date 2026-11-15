package com.zip.backend.region;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 동네 인증: POST /api/me/region-verify { lat, lon } → { region: { id, name, fullName }, dong, verifiedAt, expiresAt } */
@RestController
public class RegionVerifyController {
    private final RegionVerifyService service;

    public RegionVerifyController(RegionVerifyService service) { this.service = service; }

    @PostMapping("/api/me/region-verify")
    public Map<String, Object> verify(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) RegionVerifyService.VerifyInput input) {
        return service.verify(Long.parseLong(jwt.getSubject()), input);
    }
}

package com.zip.backend.settings;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/settings")
public class SettingsController {
    private final SettingsService service;
    public SettingsController(SettingsService service) { this.service = service; }

    @GetMapping
    public Map<String, Object> get(@AuthenticationPrincipal Jwt jwt) { return service.get(Long.parseLong(jwt.getSubject())); }

    @PutMapping
    public Map<String, Object> put(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> input) {
        return service.put(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), SettingsInput.parse(input));
    }
}

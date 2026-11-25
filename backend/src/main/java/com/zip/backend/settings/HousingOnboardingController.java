package com.zip.backend.settings;

import com.zip.backend.auth.UserResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HousingOnboardingController {
    private final HousingOnboardingService onboarding;

    public HousingOnboardingController(HousingOnboardingService onboarding) {
        this.onboarding = onboarding;
    }

    @PutMapping("/api/me/housing-onboarding")
    public UserResponse save(@AuthenticationPrincipal Jwt jwt, @RequestBody HousingOnboardingRequest input) {
        return onboarding.save(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), input);
    }
}

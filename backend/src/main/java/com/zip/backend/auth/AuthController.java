package com.zip.backend.auth;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) { this.auth = auth; }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody AuthRequests.Login request) { return auth.login(request); }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) { return auth.me(Long.parseLong(jwt.getSubject())); }

    private static final java.util.Set<String> CONSENT_KEYS =
        java.util.Set.of("address", "agreeTerms", "agreePrivacy", "agreePolicy", "ageOver14", "termsVersion");

    /**
     * One endpoint, two jobs (frontend/API.md): a social user's first consent (address, agreements, termsVersion),
     * otherwise a profile edit (nickname, bio, avatar...).
     */
    @PatchMapping("/me")
    public Map<String, Object> updateMe(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        long userId = Long.parseLong(jwt.getSubject());
        if (request.keySet().stream().anyMatch(CONSENT_KEYS::contains)) {
            return auth.updateMe(userId, AuthRequests.UpdateMe.from(request));
        }
        return auth.updateProfile(userId, Long.parseLong(jwt.getClaimAsString("sid")), ProfilePatch.parse(request));
    }

    @PostMapping("/logout")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal Jwt jwt) {
        auth.logout(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")));
    }

    @PatchMapping("/me/password")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AuthRequests.ChangePassword request) {
        auth.changePassword(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), request);
    }
}

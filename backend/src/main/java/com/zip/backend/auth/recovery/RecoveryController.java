package com.zip.backend.auth.recovery;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Find id and reset password (frontend/API.md). No login needed. */
@RestController
@RequestMapping("/api/auth")
public class RecoveryController {
    private final RecoveryService recovery;

    public RecoveryController(RecoveryService recovery) { this.recovery = recovery; }

    @PostMapping("/find-id")
    public Map<String, Object> findId(@Valid @RequestBody RecoveryRequests.FindId request) { return recovery.findId(request); }

    @PostMapping("/password-reset/verify")
    public Map<String, Object> verifyPasswordReset(@Valid @RequestBody RecoveryRequests.PasswordResetVerify request) {
        return recovery.verifyPasswordReset(request);
    }

    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody RecoveryRequests.PasswordReset request) { recovery.resetPassword(request); }
}

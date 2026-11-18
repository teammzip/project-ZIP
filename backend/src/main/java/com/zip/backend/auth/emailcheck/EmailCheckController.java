package com.zip.backend.auth.emailcheck;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Email verification: send a code, check it (frontend/API.md, 이메일 인증). No login needed. */
@RestController
@RequestMapping("/api/auth/email")
public class EmailCheckController {
    private final EmailAuthService emailAuth;

    public EmailCheckController(EmailAuthService emailAuth) { this.emailAuth = emailAuth; }

    @PostMapping("/send")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendEmailCode(@Valid @RequestBody EmailCheckRequests.EmailSend request) {
        emailAuth.send(request.email(), request.purpose());
    }

    @PostMapping("/verify")
    public Map<String, Object> verifyEmailCode(@Valid @RequestBody EmailCheckRequests.EmailVerify request) {
        return emailAuth.verify(request.email(), request.code(), request.purpose());
    }
}

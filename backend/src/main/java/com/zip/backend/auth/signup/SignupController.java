package com.zip.backend.auth.signup;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Sign-up (frontend/API.md). No login needed. */
@RestController
@RequestMapping("/api/auth")
public class SignupController {
    private final SignupService signup;

    public SignupController(SignupService signup) {
        this.signup = signup;
    }

    @PostMapping("/signup")
    public Map<String, Object> signup(@Valid @RequestBody SignupRequests.Signup request) { return signup.signup(request); }
}

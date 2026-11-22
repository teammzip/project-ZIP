package com.zip.backend.auth.signup;

import com.zip.backend.auth.RefreshCookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
    private final RefreshCookie cookie;

    public SignupController(SignupService signup, RefreshCookie cookie) {
        this.signup = signup;
        this.cookie = cookie;
    }

    @PostMapping("/signup")
    public Map<String, Object> signup(@Valid @RequestBody SignupRequests.Signup request,
        HttpServletRequest servlet, HttpServletResponse response) {
        var result = signup.signup(request);
        cookie.write(servlet, response, result.session());
        return result.body();
    }
}

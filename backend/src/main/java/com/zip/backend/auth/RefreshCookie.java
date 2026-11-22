package com.zip.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class RefreshCookie {
    public static final String NAME = "zip_refresh";
    private final boolean secure;

    public RefreshCookie(@Value("${zip.auth.cookie-secure}") boolean secure) {
        this.secure = secure;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, AuthSessions.Issued session) {
        write(request, response, session.id() + "." + session.refreshToken(), session.cookieLifetime());
    }

    public void clear(HttpServletRequest request, HttpServletResponse response, long id, String cookie) {
        if (token(id, cookie) != null) write(request, response, "", Duration.ZERO);
    }

    static String token(long id, String cookie) {
        String prefix = id + ".";
        return cookie != null && cookie.startsWith(prefix) ? cookie.substring(prefix.length()) : null;
    }

    private void write(HttpServletRequest request, HttpServletResponse response, String value, Duration maxAge) {
        var cookie = ResponseCookie.from(NAME, value).httpOnly(true).secure(secure || request.isSecure())
            .sameSite("Lax").path("/api/auth").maxAge(maxAge).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }
}

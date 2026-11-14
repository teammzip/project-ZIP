package com.zip.backend.auth;

import com.zip.backend.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Ends the OAuth redirect flow: issues our own access token and sends the browser back to the frontend
 * (<frontend-url>/oauth/callback?token=... as agreed in frontend/API.md). Failures go to the same page
 * with ?error=<message> so the user sees a reason instead of a blank page.
 */
@Component
public class OAuthLoginHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {
    private final AuthService auth;
    private final String frontendUrl;

    public OAuthLoginHandler(AuthService auth, @Value("${zip.oauth.frontend-url}") String frontendUrl) {
        this.auth = auth;
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
        Authentication authentication) throws IOException {
        try {
            var login = (OAuth2AuthenticationToken) authentication;
            OAuth2User principal = login.getPrincipal();
            String provider = login.getAuthorizedClientRegistrationId().toUpperCase(Locale.ROOT);
            String subject;
            String email;
            String name;
            if ("NAVER".equals(provider)) {
                // Naver nests the profile: {resultcode, message, response: {id, email, nickname, name}}.
                Object nested = principal.getAttribute("response");
                if (!(nested instanceof Map<?, ?> profile)) throw new ApiException(400, "소셜 계정 정보를 받지 못했어요.");
                subject = text(profile.get("id"));
                email = text(profile.get("email"));
                name = text(profile.get("nickname")) != null ? text(profile.get("nickname")) : text(profile.get("name"));
            } else if ("KAKAO".equals(provider)) {
                // Kakao: {id: 123, kakao_account: {email, is_email_valid, is_email_verified, profile: {nickname}},
                //         properties: {nickname}}. Without the email consent item there is simply no email.
                subject = text(principal.getAttribute("id"));
                Object account = principal.getAttribute("kakao_account");
                Map<?, ?> kakao = account instanceof Map<?, ?> found ? found : Map.of();
                email = Boolean.TRUE.equals(kakao.get("is_email_valid")) && Boolean.TRUE.equals(kakao.get("is_email_verified"))
                    ? text(kakao.get("email")) : null;
                name = kakao.get("profile") instanceof Map<?, ?> profile ? text(profile.get("nickname")) : null;
                if (name == null && principal.getAttribute("properties") instanceof Map<?, ?> props) name = text(props.get("nickname"));
            } else {
                subject = principal.getAttribute("sub");
                email = principal.getAttribute("email");
                name = principal.getAttribute("name");
                // Only trust an email Google says it has verified.
                if (!Boolean.TRUE.equals(principal.getAttribute("email_verified"))) email = null;
            }
            if (subject == null || subject.isBlank()) throw new ApiException(400, "소셜 계정 정보를 받지 못했어요.");
            redirect(request, response, "token", auth.socialLogin(provider, subject, email, name));
        } catch (ApiException error) {
            redirect(request, response, "error", error.getMessage());
        } catch (RuntimeException error) {
            redirect(request, response, "error", "소셜 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
        }
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
        AuthenticationException exception) throws IOException {
        redirect(request, response, "error", "소셜 로그인이 취소됐거나 실패했어요.");
    }

    private static String text(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString();
    }

    private void redirect(HttpServletRequest request, HttpServletResponse response, String key, String value)
        throws IOException {
        // The session only carried the OAuth state; our API is stateless, so drop it now.
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        response.setHeader("Cache-Control", "no-store");
        response.sendRedirect(UriComponentsBuilder.fromUriString(frontendUrl).path("/oauth/callback")
            .queryParam(key, value).encode().build().toUriString());
    }
}

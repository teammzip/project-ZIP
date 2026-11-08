package com.zip.backend.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfiguration {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecretKey jwtKey(@Value("${zip.auth.jwt-secret}") String secret) {
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(secret); }
        catch (IllegalArgumentException error) { throw new IllegalStateException("JWT_SECRET must be Base64", error); }
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }

    @Bean
    JwtDecoder jwtDecoder(SecretKey key, @Value("${zip.auth.issuer}") String issuer) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(issuer), jwt -> {
                try {
                    if (jwt.getExpiresAt() == null || Long.parseLong(jwt.getSubject()) <= 0
                        || Long.parseLong(jwt.getClaimAsString("sid")) <= 0) throw new IllegalArgumentException();
                    return OAuth2TokenValidatorResult.success();
                } catch (RuntimeException error) {
                    return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
                }
            }));
        return decoder;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AuthRepository repository, Clock clock) throws Exception {
        http.csrf(csrf -> csrf.disable()) // Only Authorization bearer tokens; no cookie authentication.
            .formLogin(form -> form.disable()).httpBasic(basic -> basic.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/terms").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> authenticationFailure(response, error))
                .accessDeniedHandler((request, response, error) -> forbidden(response)))
            .oauth2ResourceServer(resource -> resource
                .authenticationEntryPoint((request, response, error) -> authenticationFailure(response, error))
                .accessDeniedHandler((request, response, error) -> forbidden(response))
                .jwt(jwt -> jwt.jwtAuthenticationConverter(token -> {
                    long userId = Long.parseLong(token.getSubject());
                    long sessionId = Long.parseLong(token.getClaimAsString("sid"));
                    if (!repository.sessionActive(sessionId, userId, clock.instant())) {
                        throw new org.springframework.security.oauth2.core.OAuth2AuthenticationException("invalid_token");
                    }
                    var user = repository.findById(userId).orElseThrow(() ->
                        new org.springframework.security.oauth2.core.OAuth2AuthenticationException("invalid_token"));
                    if (repository.suspended(user, clock.instant())) throw new SuspendedAuthenticationException();
                    return new JwtAuthenticationToken(token, List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
                })));
        return http.build();
    }

    private static void authenticationFailure(HttpServletResponse response,
        org.springframework.security.core.AuthenticationException error) throws IOException {
        if (error instanceof SuspendedAuthenticationException) {
            response.setStatus(403);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"이용이 정지된 계정이에요.\",\"code\":\"SUSPENDED\"}");
            return;
        }
        response.setStatus(401);
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"로그인이 필요하거나 만료됐어요.\"}");
    }

    private static void forbidden(HttpServletResponse response) throws IOException {
        response.setStatus(403);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"접근 권한이 없어요.\"}");
    }

    static class SuspendedAuthenticationException extends org.springframework.security.oauth2.core.OAuth2AuthenticationException {
        SuspendedAuthenticationException() { super("SUSPENDED"); }
    }
}

package com.zip.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

/** Registers Google only when GOOGLE_CLIENT_ID is set; otherwise social login is simply off. */
@Configuration
@ConditionalOnExpression("!'${zip.oauth.google.client-id:}'.isEmpty()")
public class GoogleOAuthConfiguration {
    @Bean
    ClientRegistrationRepository clientRegistrationRepository(
        @Value("${zip.oauth.google.client-id}") String clientId,
        @Value("${zip.oauth.google.client-secret:}") String clientSecret) {
        if (clientSecret.isBlank()) throw new IllegalStateException("GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set");
        // Redirect URI defaults to {baseUrl}/login/oauth2/code/google; register exactly that in Google Cloud.
        return new InMemoryClientRegistrationRepository(CommonOAuth2Provider.GOOGLE.getBuilder("google")
            .clientId(clientId).clientSecret(clientSecret).scope("openid", "profile", "email").build());
    }
}

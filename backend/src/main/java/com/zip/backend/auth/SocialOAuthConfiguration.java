package com.zip.backend.auth;

import java.util.ArrayList;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

/**
 * Registers each social provider only when its client id is set
 * (GOOGLE_CLIENT_ID / NAVER_CLIENT_ID / KAKAO_LOGIN_CLIENT_ID); with none set, social login is simply off
 * and the app still starts.
 */
@Configuration
@ConditionalOnExpression("!'${zip.oauth.google.client-id:}'.isEmpty() or !'${zip.oauth.naver.client-id:}'.isEmpty() "
    + "or !'${zip.oauth.kakao.client-id:}'.isEmpty()")
public class SocialOAuthConfiguration {
    @Bean
    ClientRegistrationRepository clientRegistrationRepository(
        @Value("${zip.oauth.google.client-id:}") String googleId,
        @Value("${zip.oauth.google.client-secret:}") String googleSecret,
        @Value("${zip.oauth.naver.client-id:}") String naverId,
        @Value("${zip.oauth.naver.client-secret:}") String naverSecret,
        @Value("${zip.oauth.kakao.client-id:}") String kakaoId,
        @Value("${zip.oauth.kakao.client-secret:}") String kakaoSecret) {
        var registrations = new ArrayList<ClientRegistration>();
        if (!googleId.isBlank()) {
            if (googleSecret.isBlank()) throw new IllegalStateException("GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set");
            // Redirect URI defaults to {baseUrl}/login/oauth2/code/google; register exactly that in Google Cloud.
            registrations.add(CommonOAuth2Provider.GOOGLE.getBuilder("google")
                .clientId(googleId).clientSecret(googleSecret).scope("openid", "profile", "email").build());
        }
        if (!naverId.isBlank()) {
            if (naverSecret.isBlank()) throw new IllegalStateException("NAVER_CLIENT_SECRET is required when NAVER_CLIENT_ID is set");
            // Spring has no built-in Naver provider. Redirect URI: {baseUrl}/login/oauth2/code/naver.
            // Naver wraps the profile in a "response" object, so that is the user-name attribute.
            registrations.add(ClientRegistration.withRegistrationId("naver")
                .clientId(naverId).clientSecret(naverSecret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/{action}/oauth2/code/{registrationId}")
                .scope("name", "email")
                .authorizationUri("https://nid.naver.com/oauth2.0/authorize")
                .tokenUri("https://nid.naver.com/oauth2.0/token")
                .userInfoUri("https://openapi.naver.com/v1/nid/me")
                .userNameAttributeName("response")
                .clientName("Naver").build());
        }
        if (!kakaoId.isBlank()) {
            if (kakaoSecret.isBlank()) throw new IllegalStateException("KAKAO_LOGIN_CLIENT_SECRET is required when KAKAO_LOGIN_CLIENT_ID is set");
            // No scope is sent on purpose: Kakao then asks for exactly the consent items enabled in Kakao Developers
            // (requesting one that is not enabled there fails with KOE205). Redirect URI: {baseUrl}/login/oauth2/code/kakao.
            // The user-name attribute is the numeric "id"; the profile lives under kakao_account.
            registrations.add(ClientRegistration.withRegistrationId("kakao")
                .clientId(kakaoId).clientSecret(kakaoSecret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/{action}/oauth2/code/{registrationId}")
                .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                .tokenUri("https://kauth.kakao.com/oauth/token")
                .userInfoUri("https://kapi.kakao.com/v2/user/me")
                .userNameAttributeName("id")
                .clientName("Kakao").build());
        }
        return new InMemoryClientRegistrationRepository(registrations);
    }
}

package com.zip.backend.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class TokenService {
    private final JwtEncoder encoder;
    private final String issuer;
    private final SecureRandom random = new SecureRandom();

    public TokenService(JwtEncoder encoder, @Value("${zip.auth.issuer}") String issuer) {
        this.encoder = encoder;
        this.issuer = issuer;
    }

    public String issue(long userId, long sessionId, Instant now, Instant expires) {
        var claims = JwtClaimsSet.builder().issuer(issuer).subject(Long.toString(userId))
            .issuedAt(now).expiresAt(expires).claim("sid", Long.toString(sessionId)).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    }

    // Reserve an unguessable hash for the session; refresh cookies are not issued in this phase.
    public String sessionHash() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}

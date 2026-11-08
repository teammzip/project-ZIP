package com.zip.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import static org.junit.jupiter.api.Assertions.*;

/** Google is switched on just by GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET living in an imported properties file. */
@SpringBootTest(properties = "spring.config.import=optional:file:./src/test/resources/google-sample.properties")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class GoogleConfigFileTests {
    @Autowired ClientRegistrationRepository clients;

    @Test void idAndSecretFromAnImportedFileEnableGoogle() {
        var google = clients.findByRegistrationId("google");
        assertEquals("sample-id-from-file", google.getClientId());
        assertEquals("sample-secret-from-file", google.getClientSecret());
    }
}

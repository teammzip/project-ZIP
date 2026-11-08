package com.zip.backend.tools;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.io.StringReader;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;

class PasswordHashTests {
    @Test void missingInputHasDistinctMessageAndNoHash() throws Exception {
        var output = new ByteArrayOutputStream();
        var errors = new ByteArrayOutputStream();
        int status = PasswordHash.generate(new BufferedReader(new StringReader("")), new PrintStream(output), new PrintStream(errors));
        assertEquals(2, status);
        assertTrue(errors.toString().contains("stdin closed"));
        assertEquals("", output.toString());
    }

    @Test void invalidInputsDoNotPrintPasswordsOrHashes() throws Exception {
        for (String password : new String[] {"", "short1!", "abcdefghijklmnopq1!", "abcdefgh", "abcd1234", "abcd!!!!", "1234!!!!"}) {
            var output = new ByteArrayOutputStream();
            var errors = new ByteArrayOutputStream();
            int status = PasswordHash.generate(new BufferedReader(new StringReader(password + "\n")), new PrintStream(output), new PrintStream(errors));
            assertEquals(2, status);
            assertTrue(errors.toString().contains("Invalid password"));
            if (!password.isEmpty()) assertFalse(errors.toString().contains(password));
            assertEquals("", output.toString());
        }
    }

    @Test void validInputGeneratesMatchingHashWithoutEchoingPassword() throws Exception {
        String password = "localPass7!";
        var output = new ByteArrayOutputStream();
        var errors = new ByteArrayOutputStream();
        int status = PasswordHash.generate(new BufferedReader(new StringReader(password + "\n")), new PrintStream(output), new PrintStream(errors));
        assertEquals(0, status);
        assertTrue(new BCryptPasswordEncoder().matches(password, output.toString().trim()));
        assertFalse(output.toString().contains(password));
        assertFalse(errors.toString().contains(password));
    }
}

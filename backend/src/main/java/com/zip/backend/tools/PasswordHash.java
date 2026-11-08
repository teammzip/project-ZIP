package com.zip.backend.tools;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Explicit local provisioning aid; never creates users or prints the input password. */
public final class PasswordHash {
    private PasswordHash() {}
    public static void main(String[] args) throws Exception {
        int status = generate(new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)), System.out, System.err);
        if (status != 0) System.exit(status);
    }

    // ASCII diagnostics also work in Windows terminals using a legacy code page.
    static int generate(BufferedReader input, PrintStream output, PrintStream errors) throws java.io.IOException {
        errors.println("Enter a test password, then press Enter (8-16 characters; English letter + digit + special character):");
        String password = input.readLine();
        if (password == null) {
            errors.println("No password received (stdin closed). Run in a terminal, or pipe Read-Host into the Gradle command.");
            return 2;
        }
        if (password.length() < 8 || password.length() > 16
            || !password.matches("(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*")) {
            errors.println("Invalid password. Use 8-16 characters with an English letter, a digit and a special character.");
            return 2;
        }
        output.println(new BCryptPasswordEncoder(12).encode(password));
        return 0;
    }
}

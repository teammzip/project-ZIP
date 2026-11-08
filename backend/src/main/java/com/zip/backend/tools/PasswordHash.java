package com.zip.backend.tools;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Explicit local provisioning aid; never creates users or prints the input password. */
public final class PasswordHash {
    private PasswordHash() {}
    public static void main(String[] args) throws Exception {
        System.err.println("비밀번호를 입력한 뒤 Enter (8~16자 영문·숫자·특수문자):");
        String password = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)).readLine();
        if (password == null || password.length() < 8 || password.length() > 16
            || !password.matches("(?s)(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*")) {
            throw new IllegalArgumentException("비밀번호 규칙을 확인해 주세요.");
        }
        System.out.println(new BCryptPasswordEncoder(12).encode(password));
    }
}

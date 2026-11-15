package com.zip.backend.settings;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 본인의 등록 정보만 조회한다. */
@RestController
public class ProfileInfoController {
    private final JdbcTemplate jdbc;
    public ProfileInfoController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/api/me/profile-info")
    public Map<String, Object> get(@AuthenticationPrincipal Jwt jwt) {
        long userId = Long.parseLong(jwt.getSubject());
        return jdbc.query("""
            SELECT u.login_id, u.email, u.address, h.birth_date
            FROM users u LEFT JOIN housing_surveys h ON h.user_id = u.id
            WHERE u.id = ?
            """, (rs, row) -> {
                var result = new LinkedHashMap<String, Object>();
                result.put("username", rs.getString("login_id"));
                result.put("email", rs.getString("email"));
                result.put("address", rs.getString("address"));
                var birth = rs.getDate("birth_date");
                result.put("birth", birth == null ? null : birth.toLocalDate().toString());
                return (Map<String, Object>) result;
            }, userId).stream().findFirst().orElseThrow(() -> new com.zip.backend.common.ApiException(401, "로그인 정보가 없어요."));
    }
}

package com.zip.backend.settings;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.transaction.annotation.Transactional;
import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Set;

/** 로그인한 본인의 등록 정보만 조회한다. */
@RestController
public class ProfileInfoController {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    public ProfileInfoController(JdbcTemplate jdbc, AuthRepository auth, Clock clock) {
        this.jdbc = jdbc; this.auth = auth; this.clock = clock;
    }

    @GetMapping("/api/me/profile-info")
    public Map<String, Object> get(@AuthenticationPrincipal Jwt jwt) {
        long userId = Long.parseLong(jwt.getSubject());
        return jdbc.query("""
            SELECT u.login_id, u.nickname, u.email,
                CASE WHEN p.user_id IS NULL THEN h.birth_date ELSE p.birth_date END AS birth_date
            FROM users u LEFT JOIN housing_surveys h ON h.user_id = u.id
            LEFT JOIN user_personal_info p ON p.user_id = u.id
            WHERE u.id = ?
            """, (rs, row) -> {
                var result = new LinkedHashMap<String, Object>();
                result.put("username", rs.getString("login_id"));
                result.put("email", rs.getString("email"));
                result.put("nickname", rs.getString("nickname"));
                var birth = rs.getDate("birth_date");
                result.put("birth", birth == null ? null : birth.toLocalDate().toString());
                return (Map<String, Object>) result;
            }, userId).stream().findFirst().orElseThrow(() -> new com.zip.backend.common.ApiException(401, "로그인 정보가 없어요."));
    }

    @PatchMapping("/api/me/profile-info")
    @Transactional
    public Map<String, Object> update(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> input) {
        if (!input.keySet().equals(Set.of("nickname", "birth"))) throw new ApiException(400, "이름과 생년월일만 수정할 수 있어요.");
        if (!(input.get("nickname") instanceof String rawName) || !(input.get("birth") instanceof String birth)) throw new ApiException(400, "이름과 생년월일을 확인해 주세요.");
        String nickname = rawName.strip();
        int length = nickname.codePointCount(0, nickname.length());
        if (length < 2 || length > 12) throw new ApiException(400, "닉네임은 2~12자로 입력해 주세요.");
        LocalDate date = ProfileBirth.parse(birth, clock);
        long id = Long.parseLong(jwt.getSubject());
        auth.lockUser(id);
        if (!auth.sessionActive(Long.parseLong(jwt.getClaimAsString("sid")), id, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        jdbc.update("UPDATE users SET nickname = ? WHERE id = ?", nickname, id);
        ProfileBirth.save(jdbc, id, date);
        return get(jwt);
    }
}

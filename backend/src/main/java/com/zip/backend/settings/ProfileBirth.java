package com.zip.backend.settings;

import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.jdbc.core.JdbcTemplate;

final class ProfileBirth {
    private ProfileBirth() {}

    static LocalDate parse(String birth, Clock clock) {
        LocalDate date = null;
        if (!birth.isEmpty()) {
            try {
                date = LocalDate.parse(birth);
                if (!birth.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !date.toString().equals(birth) || date.getYear() < 1 || date.isAfter(LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul"))))) throw new IllegalArgumentException();
            } catch (RuntimeException error) { throw new ApiException(400, "생년월일은 미래가 아닌 올바른 날짜로 입력해 주세요."); }
        }
        return date;
    }

    static void save(JdbcTemplate jdbc, long id, LocalDate date) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM user_personal_info WHERE user_id = ?", Long.class, id) == 0) jdbc.update("INSERT INTO user_personal_info(user_id) VALUES (?)", id);
        jdbc.update("UPDATE user_personal_info SET birth_date = ? WHERE user_id = ?", date == null ? null : java.sql.Date.valueOf(date), id);
    }
}


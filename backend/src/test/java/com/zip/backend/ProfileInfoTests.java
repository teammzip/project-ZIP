package com.zip.backend;

import com.zip.backend.auth.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/profile-info-fixture.sql"})
class ProfileInfoTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;

    @Test void readsOnlyCurrentUsersDatabaseInfo() throws Exception {
        String first = auth.socialLogin("GOOGLE", "profile-a", "first@example.com", "회원하나");
        String second = auth.socialLogin("GOOGLE", "profile-b", "second@example.com", "회원둘");
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE email = 'first@example.com'", Long.class);
        jdbc.update("UPDATE users SET address = ? WHERE id = ?", "검증용 등록 주소", id);
        jdbc.update("INSERT INTO housing_surveys(user_id, birth_date) VALUES (?, ?)", id, java.sql.Date.valueOf("2000-02-29"));
        mvc.perform(get("/api/me/profile-info").header("Authorization", "Bearer " + first))
            .andExpect(status().isOk()).andExpect(jsonPath("$.birth").value("2000-02-29"))
            .andExpect(jsonPath("$.address").value("검증용 등록 주소"))
            .andExpect(jsonPath("$.email").value("first@example.com"));
        mvc.perform(get("/api/me/profile-info").param("userId", id.toString()).header("Authorization", "Bearer " + second))
            .andExpect(status().isOk()).andExpect(jsonPath("$.birth").isEmpty())
            .andExpect(jsonPath("$.email").value("second@example.com"));
    }

    @Test void unauthenticatedRequestIsRejected() throws Exception {
        mvc.perform(get("/api/me/profile-info")).andExpect(status().isUnauthorized());
    }
}

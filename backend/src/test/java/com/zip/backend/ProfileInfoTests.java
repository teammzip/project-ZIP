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
            .andExpect(jsonPath("$.nickname").value("회원하나"))
            .andExpect(jsonPath("$.address").doesNotExist())
            .andExpect(jsonPath("$.rent").doesNotExist())
            .andExpect(jsonPath("$.contractEnd").doesNotExist())
            .andExpect(jsonPath("$.email").value("first@example.com"));
        mvc.perform(get("/api/me/profile-info").param("userId", id.toString()).header("Authorization", "Bearer " + second))
            .andExpect(status().isOk()).andExpect(jsonPath("$.birth").isEmpty())
            .andExpect(jsonPath("$.email").value("second@example.com"));
    }

    @Test void unauthenticatedRequestIsRejected() throws Exception {
        mvc.perform(get("/api/me/profile-info")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/me/profile-info").contentType("application/json").content("{}"))
            .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions save(String token, String body) throws Exception {
        return mvc.perform(patch("/api/me/profile-info").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(body));
    }

    @Test void editsPersonalInfoAndClearsBirthWithoutChangingHousingOrEmail() throws Exception {
        String token = auth.socialLogin("GOOGLE", "edit-a", "edit@example.com", "기존이름");
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE email='edit@example.com'", Long.class);
        jdbc.update("INSERT INTO housing_surveys(user_id,birth_date) VALUES (?,?)", id, java.sql.Date.valueOf("1990-01-01"));
        save(token, "{\"nickname\":\"새이름\",\"birth\":\"2000-02-29\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.birth").value("2000-02-29"))
            .andExpect(jsonPath("$.nickname").value("새이름")).andExpect(jsonPath("$.email").value("edit@example.com"));
        org.junit.jupiter.api.Assertions.assertEquals(java.sql.Date.valueOf("1990-01-01"), jdbc.queryForObject("SELECT birth_date FROM housing_surveys WHERE user_id=?", java.sql.Date.class, id));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.birth").value("2000-02-29"));
        save(token, "{\"nickname\":\"새이름\",\"birth\":\"\"}").andExpect(status().isOk()).andExpect(jsonPath("$.birth").isEmpty());
        mvc.perform(get("/api/me/profile-info").header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.birth").isEmpty());
    }

    @Test void rejectsIdentityFieldsAndInvalidBirthWithoutChangingName() throws Exception {
        String token = auth.socialLogin("GOOGLE", "invalid-a", "invalid@example.com", "기존이름");
        for (String body : new String[] {
            "{\"nickname\":\"새이름\",\"birth\":\"2001-02-29\"}",
            "{\"nickname\":\"새이름\",\"birth\":\"9999-01-01\"}",
            "{\"nickname\":\"가\",\"birth\":\"\"}",
            "{\"nickname\":\"새이름\",\"birth\":\"\",\"email\":\"changed@example.com\"}",
            "{\"nickname\":\"새이름\",\"birth\":\"\",\"username\":\"changed\"}",
            "{\"nickname\":\"새이름\",\"birth\":\"\",\"userId\":\"2\"}"
        }) save(token, body).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/profile-info").header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.nickname").value("기존이름")).andExpect(jsonPath("$.email").value("invalid@example.com"));
    }
}

package com.zip.backend.memo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 메모: 만들기 · 고치기(보낸 칸만) · 지우기 · 내 것만 · 홈 메모 순서 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class MemoIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String me, other;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'mapo01', ?, '마포주민'), (2, 'yongsan1', ?, '용산주민')", hash, hash);
        me = login("mapo01");
        other = login("yongsan1");
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private ResultActions call(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private String create(String token, String body) throws Exception {
        return JsonPath.read(call(token, post("/api/memos"), body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
    }

    @Test void createUpdateAndDeleteOwnMemos() throws Exception {
        // 빠른 메모: 글만
        call(me, post("/api/memos"), "{\"body\":\"택배 반품\"}").andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("")).andExpect(jsonPath("$.body").value("택배 반품"))
            .andExpect(jsonPath("$.color").value("노랑")).andExpect(jsonPath("$.pinned").value(false))
            .andExpect(jsonPath("$.checklist").value(false)).andExpect(jsonPath("$.items.length()").value(0));
        String list = create(me, "{\"title\":\"장보기\",\"color\":\"하늘\",\"checklist\":true,\"items\":[{\"text\":\"두부\",\"done\":false},{\"text\":\"계란 한 판\",\"done\":true}]}");

        // 보낸 칸만 바뀜 (체크 하나)
        call(me, patch("/api/memos/{id}", list), "{\"items\":[{\"text\":\"두부\",\"done\":true},{\"text\":\"계란 한 판\",\"done\":true}]}").andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("장보기")).andExpect(jsonPath("$.color").value("하늘"))
            .andExpect(jsonPath("$.items[0].done").value(true)).andExpect(jsonPath("$.items[1].text").value("계란 한 판"));
        call(me, patch("/api/memos/{id}", list), "{\"pinned\":true}").andExpect(jsonPath("$.pinned").value(true));

        // 고정 먼저
        call(me, get("/api/memos"), null).andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].id").value(list));
        call(me, get("/api/memos").param("q", "택배"), null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].body").value("택배 반품"));

        // 남의 메모는 못 봄 · 못 고침 · 못 지움
        call(other, get("/api/memos"), null).andExpect(jsonPath("$.length()").value(0));
        call(other, patch("/api/memos/{id}", list), "{\"title\":\"가로채기\"}").andExpect(status().isNotFound());
        call(other, delete("/api/memos/{id}", list), null).andExpect(status().isNotFound());

        call(me, delete("/api/memos/{id}", list), null).andExpect(status().isNoContent());
        call(me, delete("/api/memos/{id}", list), null).andExpect(status().isNotFound());
        call(me, get("/api/memos"), null).andExpect(jsonPath("$.length()").value(1));
        call(null, get("/api/memos"), null).andExpect(status().isUnauthorized());
    }

    @Test void inputIsChecked() throws Exception {
        call(me, post("/api/memos"), "{\"title\":\"" + "가".repeat(61) + "\"}").andExpect(status().isBadRequest());
        call(me, post("/api/memos"), "{\"title\":\"두\\n줄\"}").andExpect(status().isBadRequest());
        call(me, post("/api/memos"), "{\"body\":\"" + "가".repeat(5001) + "\"}").andExpect(status().isBadRequest());
        call(me, post("/api/memos"), "{\"color\":\"빨강\"}").andExpect(status().isBadRequest());
        call(me, post("/api/memos"), "{\"items\":[{\"text\":\"" + "가".repeat(101) + "\",\"done\":false}]}").andExpect(status().isBadRequest());
        call(me, post("/api/memos"), "{\"items\":[null]}").andExpect(status().isBadRequest());
        call(me, patch("/api/memos/{id}", "abc"), "{\"title\":\"x\"}").andExpect(status().isNotFound());
        call(me, post("/api/memos"), "{\"body\":\"여러 줄\\n\\t들여쓰기도 돼요\"}").andExpect(status().isCreated());
    }

    @Test void homeMemosKeepOrderAndOnlyMine() throws Exception {
        String a = create(me, "{\"body\":\"가\"}"), b = create(me, "{\"body\":\"나\"}"), c = create(me, "{\"body\":\"다\"}"), d = create(me, "{\"body\":\"라\"}");
        String theirs = create(other, "{\"body\":\"남의 것\"}");
        call(me, get("/api/me/home-memos"), null).andExpect(status().isOk()).andExpect(jsonPath("$.ids").isEmpty());

        call(me, put("/api/me/home-memos"), "{\"ids\":[\"" + c + "\",\"" + a + "\"]}").andExpect(status().isOk());
        call(me, get("/api/me/home-memos"), null).andExpect(jsonPath("$.ids[0]").value(c)).andExpect(jsonPath("$.ids[1]").value(a));

        call(me, put("/api/me/home-memos"), "{\"ids\":[\"" + a + "\",\"" + b + "\",\"" + c + "\",\"" + d + "\"]}").andExpect(status().isBadRequest());
        call(me, put("/api/me/home-memos"), "{\"ids\":[\"" + a + "\",\"" + a + "\"]}").andExpect(status().isBadRequest());
        call(me, put("/api/me/home-memos"), "{\"ids\":[\"" + theirs + "\"]}").andExpect(status().isBadRequest());

        // 지운 메모는 빠져서 보임
        call(me, delete("/api/memos/{id}", c), null).andExpect(status().isNoContent());
        call(me, get("/api/me/home-memos"), null).andExpect(jsonPath("$.ids.length()").value(1)).andExpect(jsonPath("$.ids[0]").value(a));

        // null = 자동
        call(me, put("/api/me/home-memos"), "{\"ids\":null}").andExpect(status().isOk());
        call(me, get("/api/me/home-memos"), null).andExpect(jsonPath("$.ids").isEmpty());
    }
}

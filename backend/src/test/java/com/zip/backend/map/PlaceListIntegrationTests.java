package com.zip.backend.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

/** 저장 리스트 (★ 저장 창): 기본 "내 장소", 여러 리스트에 넣기, 다 빼면 저장 풀림, 리스트 삭제 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/map-favorites-fixture.sql"})
class PlaceListIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String token;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (1, 'tester01', ?, '회원하나'), (2, 'tester02', ?, '회원둘')", hash, hash);
        token = login("tester01");
    }

    private String login(String id) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"" + id + "\",\"password\":\"abcd123!\"}")).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
        request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private String createList(String name, String color) throws Exception {
        String response = call(post("/api/me/place-lists"), "{\"name\":\"" + name + "\",\"color\":\"" + color + "\"}")
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    @Test void firstLoadCreatesDefaultListAndMovesExistingFavoritesIntoIt() throws Exception {
        jdbc.update("INSERT INTO place_favorites (user_id, place_id) VALUES (1, 10)");
        jdbc.update("INSERT INTO kakao_place_favorites (user_id, kakao_place_id, name, category) VALUES (1, '555', '다이소', '다이소')");
        call(get("/api/me/place-lists"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].name").value("내 장소"))
            .andExpect(jsonPath("$[0].color").value("#03c75a")).andExpect(jsonPath("$[0].placeIds.length()").value(2));
        // 두 번 불러도 리스트가 또 생기지 않음
        call(get("/api/me/place-lists"), null).andExpect(jsonPath("$.length()").value(1));
    }

    @Test void placeCanBeInSeveralListsAndUncheckingAllUnsavesIt() throws Exception {
        call(get("/api/me/place-lists"), null).andExpect(status().isOk());
        String mine = jdbc.queryForObject("SELECT CAST(id AS VARCHAR) FROM place_lists WHERE user_id = 1", String.class);
        String food = createList("맛집", "#ff5a7e");
        String body = "{\"listIds\":[\"" + mine + "\",\"" + food + "\"],\"name\":\"그린컴퓨터크리닝\",\"category\":\"편의점\"}";
        call(put("/api/me/place-favorites/{id}/lists", "kakao:8806003"), body).andExpect(status().isNoContent());
        call(get("/api/me/place-favorites"), null).andExpect(jsonPath("$[0]").value("kakao:8806003"));
        call(get("/api/me/place-lists"), null)
            .andExpect(jsonPath("$[0].placeIds[0]").value("kakao:8806003")).andExpect(jsonPath("$[1].name").value("맛집"))
            .andExpect(jsonPath("$[1].placeIds[0]").value("kakao:8806003"));
        // 맛집에서만 빼기
        call(put("/api/me/place-favorites/{id}/lists", "kakao:8806003"), "{\"listIds\":[\"" + mine + "\"]}").andExpect(status().isNoContent());
        call(get("/api/me/place-lists"), null).andExpect(jsonPath("$[1].placeIds.length()").value(0));
        // 다 빼면 저장이 풀림
        call(put("/api/me/place-favorites/{id}/lists", "kakao:8806003"), "{\"listIds\":[]}").andExpect(status().isNoContent());
        call(get("/api/me/place-favorites"), null).andExpect(jsonPath("$.length()").value(0));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM place_list_items", Integer.class));
    }

    @Test void deletingAListUnsavesPlacesThatAreInNoOtherList() throws Exception {
        call(get("/api/me/place-lists"), null);
        String mine = jdbc.queryForObject("SELECT CAST(id AS VARCHAR) FROM place_lists WHERE user_id = 1", String.class);
        String trip = createList("제주", "#ff9500");
        call(put("/api/me/place-favorites/{id}/lists", "10"), "{\"listIds\":[\"" + trip + "\"]}").andExpect(status().isNoContent());
        call(put("/api/me/place-favorites/{id}/lists", "kakao:1"), "{\"listIds\":[\"" + mine + "\",\"" + trip + "\"],\"name\":\"가게\",\"category\":\"기타\"}")
            .andExpect(status().isNoContent());
        call(delete("/api/me/place-lists/{id}", trip), null).andExpect(status().isNoContent());
        // 10 은 제주에만 있었으니 저장 풀림, kakao:1 은 내 장소에 남음
        call(get("/api/me/place-favorites"), null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0]").value("kakao:1"));
    }

    @Test void listRulesAndOwnership() throws Exception {
        createList("맛집", "#ff5a7e");
        call(post("/api/me/place-lists"), "{\"name\":\"맛집\",\"color\":\"#000000\"}").andExpect(status().isConflict());
        call(post("/api/me/place-lists"), "{\"name\":\"   \",\"color\":\"#000000\"}").andExpect(status().isBadRequest());
        call(post("/api/me/place-lists"), "{\"name\":\"" + "가".repeat(21) + "\"}").andExpect(status().isBadRequest());
        call(post("/api/me/place-lists"), "{\"name\":\"색\",\"color\":\"red\"}").andExpect(status().isBadRequest());
        String renamed = createList("카페", "#2f80ed");
        call(patch("/api/me/place-lists/{id}", renamed), "{\"name\":\"카페 모음\",\"color\":\"#7C6CF5\"}").andExpect(status().isNoContent());
        assertEquals("#7c6cf5", jdbc.queryForObject("SELECT color FROM place_lists WHERE name = '카페 모음'", String.class));
        // 다른 회원의 리스트는 못 씀
        String other = jdbc.queryForObject("SELECT CAST(id AS VARCHAR) FROM place_lists WHERE name = '맛집'", String.class);
        token = login("tester02");
        call(delete("/api/me/place-lists/{id}", other), null).andExpect(status().isNotFound());
        call(put("/api/me/place-favorites/{id}/lists", "10"), "{\"listIds\":[\"" + other + "\"]}").andExpect(status().isNotFound());
        call(put("/api/me/place-favorites/{id}/lists", "kakao:5"), "{\"listIds\":[]}").andExpect(status().isNoContent());
    }
}

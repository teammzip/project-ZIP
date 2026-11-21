package com.zip.backend.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
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

/** 일정 · 카테고리 · 항목 버튼: 기본값 만들기, 일정 만들기 · 고치기 · 완료 · 지우기, 카테고리 이름 바꾸기 · 지우기(미분류로), 내 것만 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class CalendarIntegrationTests {
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
        return JsonPath.read(call(token, post("/api/events"), body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
    }

    @Test void defaultsAreCreatedOnceWithUncategorizedLast() throws Exception {
        call(me, get("/api/event-categories"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(6))
            .andExpect(jsonPath("$[0].name").value("집 관리")).andExpect(jsonPath("$[0].ico").value("🏠"))
            .andExpect(jsonPath("$[0].items.length()").value(6)).andExpect(jsonPath("$[0].items[0]").value("에어컨 필터 청소"))
            .andExpect(jsonPath("$[5].name").value("미분류")).andExpect(jsonPath("$[5].system").value(true)).andExpect(jsonPath("$[5].items.length()").value(0));
        call(me, get("/api/event-categories"), null).andExpect(jsonPath("$.length()").value(6));
        assertEquals(30, jdbc.queryForObject("SELECT COUNT(*) FROM event_presets WHERE user_id = 1 AND is_custom = FALSE", Integer.class));
        call(me, get("/api/event-presets"), null).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void eventsCreateUpdateDoneAndDelete() throws Exception {
        String id = create(me, "{\"date\":\"2026-11-24\",\"time\":\"18:00\",\"title\":\"  택배 반품  \",\"category\":\"연락·행정\"}");
        call(me, get("/api/events"), null).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].title").value("택배 반품")).andExpect(jsonPath("$[0].time").value("18:00"))
            .andExpect(jsonPath("$[0].category").value("연락·행정")).andExpect(jsonPath("$[0].done").value(false))
            .andExpect(jsonPath("$[0].source").value("USER")).andExpect(jsonPath("$[0].anniv").value(false));

        // 보낸 칸만: 종일로 · 분류 없음으로
        call(me, patch("/api/events/{id}", id), "{\"time\":\"\",\"category\":\"\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.time").value("")).andExpect(jsonPath("$.category").isEmpty()).andExpect(jsonPath("$.title").value("택배 반품"));
        call(me, patch("/api/events/{id}/done", id), "{\"done\":true}").andExpect(jsonPath("$.done").value(true));
        call(me, patch("/api/events/{id}/done", id), "{\"done\":false}").andExpect(jsonPath("$.done").value(false));
        assertEquals(null, jdbc.queryForObject("SELECT done_at FROM events WHERE id = ?", java.sql.Timestamp.class, Long.parseLong(id)));

        // 기간 · 검색
        create(me, "{\"date\":\"2026-12-30\",\"title\":\"연말 정리\"}");
        call(me, get("/api/events").param("from", "2026-11-01").param("to", "2026-11-30"), null).andExpect(jsonPath("$.length()").value(1));
        call(me, get("/api/events/search").param("q", "정리"), null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("연말 정리"));

        // 남의 일정
        call(other, get("/api/events"), null).andExpect(jsonPath("$.length()").value(0));
        call(other, patch("/api/events/{id}", id), "{\"title\":\"가로채기\"}").andExpect(status().isNotFound());
        call(other, delete("/api/events/{id}", id), null).andExpect(status().isNotFound());
        call(me, delete("/api/events/{id}", id), null).andExpect(status().isNoContent());
        call(me, delete("/api/events/{id}", id), null).andExpect(status().isNotFound());
        call(null, get("/api/events"), null).andExpect(status().isUnauthorized());
    }

    @Test void anniversariesHaveNoTimeCategoryOrDone() throws Exception {
        String id = create(me, "{\"date\":\"2024-02-29\",\"time\":\"10:00\",\"title\":\"🎉 생일\",\"category\":\"집 관리\",\"anniv\":true,\"yearly\":true,\"done\":true}");
        call(me, get("/api/events").param("from", "2026-02-01").param("to", "2026-02-28"), null)
            .andExpect(jsonPath("$.length()").value(1)) // 매년 반복은 기간과 상관없이
            .andExpect(jsonPath("$[0].time").value("")).andExpect(jsonPath("$[0].category").isEmpty())
            .andExpect(jsonPath("$[0].done").value(false)).andExpect(jsonPath("$[0].yearly").value(true));
        call(me, patch("/api/events/{id}", id), "{\"anniv\":false}").andExpect(status().isBadRequest()); // 반복은 기념일만
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"반복\",\"yearly\":true}").andExpect(status().isBadRequest());
    }

    @Test void inputIsChecked() throws Exception {
        call(me, post("/api/events"), "{\"title\":\"날짜 없음\"}").andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-02-30\",\"title\":\"없는 날\"}").andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"시간\",\"time\":\"25:00\"}").andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"" + "가".repeat(61) + "\"}").andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"없는 분류\",\"category\":\"우주\"}").andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"출처\",\"source\":\"AI\"}").andExpect(status().isBadRequest());
        call(me, get("/api/events").param("from", "2026-01-01").param("to", "2027-12-31"), null).andExpect(status().isBadRequest());
        call(me, post("/api/events"), "{\"date\":\"2026-11-24\",\"title\":\"월세 납부일\",\"source\":\"RENT\"}").andExpect(status().isCreated())
            .andExpect(jsonPath("$.source").value("RENT"));
    }

    @Test void renamingAndDeletingCategoriesMovesEventsAndPresets() throws Exception {
        String catId = JsonPath.read(call(me, post("/api/event-categories"), "{\"name\":\"반려동물\"}").andExpect(status().isCreated())
            .andExpect(jsonPath("$.ico").value("🏷️")).andReturn().getResponse().getContentAsString(), "$.id");
        call(me, get("/api/event-categories"), null).andExpect(jsonPath("$[5].name").value("반려동물")).andExpect(jsonPath("$[6].name").value("미분류"));
        call(me, post("/api/event-categories"), "{\"name\":\"반려동물\"}").andExpect(status().isConflict());
        call(me, post("/api/event-categories"), "{\"name\":\"미분류\"}").andExpect(status().isConflict());

        String event = create(me, "{\"date\":\"2026-11-25\",\"title\":\"사료 주문\",\"category\":\"반려동물\"}");
        String preset = JsonPath.read(call(me, post("/api/event-presets"), "{\"title\":\"사료 주문\",\"category\":\"반려동물\"}").andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString(), "$.id");
        // 같은 이름은 새로 안 만들고 그것을 돌려줌
        call(me, post("/api/event-presets"), "{\"title\":\"사료 주문\",\"category\":\"반려동물\"}").andExpect(jsonPath("$.id").value(preset));
        // 미분류에 같은 이름이 이미 있는 항목 (지울 때 겹침)
        call(me, post("/api/event-presets"), "{\"title\":\"사료 주문\",\"category\":\"미분류\"}").andExpect(status().isCreated());

        // 이름 바꾸기: 일정 · 항목이 그대로 따라감
        call(me, patch("/api/event-categories/{id}", catId), "{\"name\":\"고양이\"}").andExpect(status().isNoContent());
        call(me, get("/api/events"), null).andExpect(jsonPath("$[0].category").value("고양이"));
        call(me, get("/api/event-presets"), null).andExpect(jsonPath("$[?(@.id == '" + preset + "')].category").value("고양이"));

        // 지우기: 일정은 미분류로, 겹치는 항목은 하나만 남음
        call(me, delete("/api/event-categories/{id}", catId), null).andExpect(status().isNoContent());
        call(me, get("/api/events"), null).andExpect(jsonPath("$[0].id").value(event)).andExpect(jsonPath("$[0].category").value("미분류"));
        List<String> titles = JsonPath.read(call(me, get("/api/event-presets"), null).andReturn().getResponse().getContentAsString(), "$[*].title");
        assertEquals(List.of("사료 주문"), titles);

        // 기본 카테고리를 지우면 기본 항목은 같이 없어짐
        String house = JsonPath.read(call(me, get("/api/event-categories"), null).andReturn().getResponse().getContentAsString(), "$[0].id");
        call(me, delete("/api/event-categories/{id}", house), null).andExpect(status().isNoContent());
        assertEquals(24, jdbc.queryForObject("SELECT COUNT(*) FROM event_presets WHERE user_id = 1 AND is_custom = FALSE", Integer.class));

        // 미분류는 못 바꾸고 못 지움, 남의 카테고리도
        String uncategorized = JsonPath.read(call(me, get("/api/event-categories"), null).andReturn().getResponse().getContentAsString(), "$[-1].id");
        call(me, patch("/api/event-categories/{id}", uncategorized), "{\"name\":\"기타\"}").andExpect(status().isBadRequest());
        call(me, delete("/api/event-categories/{id}", uncategorized), null).andExpect(status().isBadRequest());
        call(other, delete("/api/event-categories/{id}", house), null).andExpect(status().isNotFound());
    }

    // 쓰레기 배출표: 동네 · 장소 한 줄에 종류별 요일(0=일 ~ 6=토) · 시작 시각, 배출 없는 종류는 null. 다른 동네 것은 안 섞임
    @Test void trashSchedulesListKindsPerPlace() throws Exception {
        jdbc.update("""
            INSERT INTO trash_schedules (region_id, place, general_days, general_time, food_days, food_time, recycle_days, recycle_time) VALUES
              (2, '내 집 혹은 내 점포 앞', '일,월,수', '18:00:00', '일,월,수', '18:00:00', '목', '20:00:00'),
              (2, '마을 내 생활 폐기물 배출장', '월', '00:00:00', '', NULL, '', NULL),
              (3, '집 앞', '', NULL, '', NULL, '화', '19:00:00')""");
        call(me, get("/api/trash-schedules").param("regionId", "2"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].place").value("내 집 혹은 내 점포 앞"))
            .andExpect(jsonPath("$[0].general.days.length()").value(3)).andExpect(jsonPath("$[0].general.days[0]").value(0)).andExpect(jsonPath("$[0].general.days[2]").value(3))
            .andExpect(jsonPath("$[0].general.startTime").value("18:00"))
            .andExpect(jsonPath("$[0].recycle.days[0]").value(4)).andExpect(jsonPath("$[0].recycle.startTime").value("20:00"))
            .andExpect(jsonPath("$[1].place").value("마을 내 생활 폐기물 배출장"))
            .andExpect(jsonPath("$[1].general.startTime").value("00:00"))
            .andExpect(jsonPath("$[1].food").isEmpty()).andExpect(jsonPath("$[1].recycle").isEmpty());
        call(me, get("/api/trash-schedules").param("regionId", "3"), null).andExpect(jsonPath("$.length()").value(1));
        call(me, get("/api/trash-schedules").param("regionId", "999"), null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        call(me, get("/api/trash-schedules").param("regionId", "abc"), null).andExpect(status().isNotFound());
    }

    @Test void customPresetsUpdateAndDelete() throws Exception {
        call(me, get("/api/event-categories"), null);
        String id = JsonPath.read(call(me, post("/api/event-presets"), "{\"title\":\"화분 물 주기\",\"category\":\"집 관리\"}").andReturn().getResponse().getContentAsString(), "$.id");
        call(me, patch("/api/event-presets/{id}", id), "{\"title\":\"화분 분갈이\",\"category\":\"건강·생활\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("화분 분갈이")).andExpect(jsonPath("$.category").value("건강·생활"));
        // 기본 항목과 같은 이름으로는 못 바꿈
        call(me, patch("/api/event-presets/{id}", id), "{\"title\":\"장보기\",\"category\":\"건강·생활\"}").andExpect(status().isConflict());
        call(other, delete("/api/event-presets/{id}", id), null).andExpect(status().isNotFound());
        call(me, delete("/api/event-presets/{id}", id), null).andExpect(status().isNoContent());
        call(me, get("/api/event-presets"), null).andExpect(jsonPath("$.length()").value(0));
    }
}

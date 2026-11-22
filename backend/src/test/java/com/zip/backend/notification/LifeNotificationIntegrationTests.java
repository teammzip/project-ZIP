package com.zip.backend.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.ZoneId;
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

/** 일정 알림을 동기화하고 다른 종류의 알림은 각자의 생성 경로를 따른다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/home-info-fixture.sql"})
class LifeNotificationIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String token;
    // 3일 전 오전 9시부터 보이므로, 테스트 시각과 상관없이 보이게 오늘 · 내일 날짜로 확인
    final LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
    final LocalDate tomorrow = today.plusDays(1);

    @BeforeEach void seed() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname, region_id, role) VALUES (1, 'mapo01', ?, '마포주민', 2, 'USER')", passwords.encode("abcd123!"));
        jdbc.update("INSERT INTO user_settings (user_id) VALUES (1)");
        String response = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"mapo01\",\"password\":\"abcd123!\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        token = JsonPath.read(response, "$.accessToken");
    }

    private ResultActions notis() throws Exception {
        return mvc.perform(get("/api/notifications").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }

    private List<String> titles() throws Exception {
        return JsonPath.read(notis().andReturn().getResponse().getContentAsString(), "$.items[*].title");
    }

    private int rows(String type) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = 1 AND noti_type = ?", Integer.class, type);
    }

    @Test void eventsWithinThreeDaysBecomeNotificationsOnce() throws Exception {
        jdbc.update("INSERT INTO events (id, user_id, title, event_date, event_time) VALUES (10, 1, '병원 예약', ?, '14:30:00')", tomorrow);
        jdbc.update("INSERT INTO events (id, user_id, title, event_date, is_done) VALUES (11, 1, '끝난 일', ?, TRUE)", today);
        jdbc.update("INSERT INTO events (id, user_id, title, event_date) VALUES (12, 1, '먼 일정', ?)", today.plusDays(10));
        jdbc.update("INSERT INTO events (id, user_id, title, event_date, is_anniversary, repeat_yearly) VALUES (13, 1, '생일', ?, TRUE, TRUE)", today.minusYears(3));

        assertEquals(List.of("병원 예약", "생일").stream().sorted().toList(), titles().stream().sorted().toList());
        notis().andExpect(jsonPath("$.items[?(@.title == '병원 예약')].link").value("calendar:" + tomorrow))
            .andExpect(jsonPath("$.items[?(@.title == '병원 예약')].type").value("EVENT"))
            .andExpect(jsonPath("$.unreadCount").value(2));
        assertEquals(2, rows("EVENT"), "여러 번 봐도 한 번만 만듦");

        // 읽고 지운 알림은 다시 생기지 않음
        mvc.perform(patch("/api/notifications/read").header("Authorization", "Bearer " + token).contentType("application/json").content("{\"ids\":[]}"))
            .andExpect(status().isNoContent());
        String ids = String.join(",", JsonPath.<List<String>>read(notis().andReturn().getResponse().getContentAsString(), "$.items[*].id"));
        mvc.perform(delete("/api/notifications").param("ids", ids).header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertEquals(List.of(), titles());
        assertEquals(2, rows("EVENT"));
    }

    @Test void changedOrDoneEventsUpdateTheirUnreadNotification() throws Exception {
        jdbc.update("INSERT INTO events (id, user_id, title, event_date) VALUES (20, 1, '택배 반품', ?)", tomorrow);
        jdbc.update("INSERT INTO events (id, user_id, title, event_date) VALUES (21, 1, '분리수거', ?)", tomorrow);
        assertEquals(2, titles().size());

        jdbc.update("UPDATE events SET title = '택배 반품 (편의점)' WHERE id = 20");
        jdbc.update("UPDATE events SET is_done = TRUE WHERE id = 21");
        assertEquals(List.of("택배 반품 (편의점)"), titles());

        // 날짜를 옮기면 옛 날짜 알림은 지우고 새 날짜로
        jdbc.update("UPDATE events SET event_date = ? WHERE id = 20", today);
        notis().andExpect(jsonPath("$.items[0].link").value("calendar:" + today)).andExpect(jsonPath("$.items.length()").value(1));
        jdbc.update("DELETE FROM events WHERE id = 20");
        assertEquals(List.of(), titles());
    }

    @Test void listingDoesNotGenerateRentAndHidesAnUnreadReminderAfterPayment() throws Exception {
        var month = java.time.YearMonth.from(today).toString();
        jdbc.update("UPDATE user_settings SET rent_amount = 55, rent_day = ? WHERE user_id = 1", today.getDayOfMonth());
        jdbc.update("INSERT INTO home_contracts (user_id, contract_kind) VALUES (1, 'monthly')");
        jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date) VALUES (1,?,550000,?)",month,today);
        assertEquals(List.of(), titles());
        assertEquals(0, rows("RENT"));

        jdbc.update("""
            INSERT INTO notifications (user_id,noti_type,title,link_view,notify_at)
            VALUES (1,'RENT','기존 월세 알림',?,TIMESTAMP '2020-01-01 07:00:00')
            ""","budget:"+today);
        assertEquals(List.of("기존 월세 알림"), titles());
        jdbc.update("UPDATE rent_payments SET paid_at=CURRENT_TIMESTAMP WHERE user_id=1");
        notis().andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.unreadCount").value(0));
        assertEquals(1, rows("RENT"), "숨긴 알림도 같은 달의 발송 이력에 남음");
    }

    /** 쓰레기 배출 알림은 TrashReminderService(아침 7시)가 만들고, 생활 알림은 건드리지 않음 */
    @Test void trashReminderRowsAreLeftAlone() throws Exception {
        jdbc.update("INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at) VALUES (1, 'TRASH', '오늘은 쓰레기 배출일이에요', '생활쓰레기', NULL, 2, TIMESTAMP '2020-01-01 07:00:00')");
        notis().andExpect(jsonPath("$.items[?(@.type == 'TRASH')].title").value("오늘은 쓰레기 배출일이에요"));
        jdbc.update("UPDATE user_settings SET noti_on = FALSE WHERE user_id = 1");
        notis();
        assertEquals(1, rows("TRASH"), "생활 알림 정리가 쓰레기 알림을 지우지 않음");
    }

    @Test void otherUsersEventsAreNotMine() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, nickname) VALUES (2, 'other01', '남')");
        jdbc.update("INSERT INTO events (id, user_id, title, event_date) VALUES (30, 2, '남의 일정', ?)", today);
        assertEquals(List.of(), titles());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notifications", Integer.class));
    }
}

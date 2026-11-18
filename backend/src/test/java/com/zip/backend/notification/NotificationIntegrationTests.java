package com.zip.backend.notification;

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

/** 알림: 댓글 · 답글 · 운영자 조치 · 경고 · 문의 답변이 받는 사람에게 생기고, 읽음 · 지우기 · 알림 끄기 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/community-fixture.sql"})
class NotificationIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String writer, other, admin;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, region_id, role, region_verified_at) VALUES
            (1, 'mapo01', ?, '마포주민', 2, 'USER', CURRENT_TIMESTAMP), (2, 'yongsan1', ?, '용산주민', 3, 'USER', CURRENT_TIMESTAMP), (9, 'admin01', ?, '운영자', NULL, 'ADMIN', NULL)
            """, hash, hash, hash);
        writer = login("mapo01");
        other = login("yongsan1");
        admin = login("admin01");
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

    private String json(ResultActions result, String path) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), path);
    }

    private String writePost(String token, String title) throws Exception {
        return json(call(token, post("/api/posts"), "{\"category\":\"FREE\",\"title\":\"" + title + "\",\"body\":\"내용\"}").andExpect(status().isCreated()), "$.id");
    }

    private ResultActions notis(String token) throws Exception {
        return call(token, get("/api/notifications"), null).andExpect(status().isOk());
    }

    @Test void commentsAndRepliesNotifyTheRightPeople() throws Exception {
        String postId = writePost(writer, "세탁기 추천");
        // 내 글에 내가 단 댓글은 알림 없음
        String mine = json(call(writer, post("/api/posts/{id}/comments", postId), "{\"body\":\"제가 먼저요\"}"), "$.id");
        notis(writer).andExpect(jsonPath("$.items.length()").value(0)).andExpect(jsonPath("$.unreadCount").value(0));

        // 다른 사람 댓글 → 글쓴이에게
        call(other, post("/api/posts/{id}/comments", postId), "{\"body\":\"저는 LG\\n좋아요\"}").andExpect(status().isCreated());
        notis(writer).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].type").value("COMMUNITY"))
            .andExpect(jsonPath("$.items[0].title").value("내 글에 댓글이 달렸어요"))
            .andExpect(jsonPath("$.items[0].body").value("용산주민: 저는 LG 좋아요"))
            .andExpect(jsonPath("$.items[0].link").value("community"))
            .andExpect(jsonPath("$.items[0].refId").value(postId))
            .andExpect(jsonPath("$.items[0].read").value(false))
            .andExpect(jsonPath("$.unreadCount").value(1));
        notis(other).andExpect(jsonPath("$.items.length()").value(0));

        // 내 댓글(글쓴이 = 댓글쓴이)에 답글 → 답글 알림 하나만
        call(other, post("/api/posts/{id}/comments", postId), "{\"body\":\"답글이에요\",\"parentId\":\"" + mine + "\"}").andExpect(status().isCreated());
        notis(writer).andExpect(jsonPath("$.items.length()").value(2)).andExpect(jsonPath("$.items[0].title").value("내 댓글에 답글이 달렸어요"));

        // 다른 사람 댓글에 운영자가 답글 → 그 댓글 쓴 사람(답글) + 글쓴이(운영자 댓글)
        String otherComment = json(call(other, post("/api/posts/{id}/comments", postId), "{\"body\":\"질문 있어요\"}"), "$.id");
        call(admin, post("/api/admin/posts/{id}/comments", postId), "{\"body\":\"안내드려요\",\"parentId\":\"" + otherComment + "\"}").andExpect(status().isCreated());
        notis(other).andExpect(jsonPath("$.items[0].title").value("내 댓글에 답글이 달렸어요")).andExpect(jsonPath("$.items[0].body").value("운영자: 안내드려요"));
        notis(writer).andExpect(jsonPath("$.items[0].title").value("운영자가 내 글에 댓글을 남겼어요")).andExpect(jsonPath("$.unreadCount").value(4));
    }

    @Test void readAndDeleteOnlyMyNotifications() throws Exception {
        String postId = writePost(writer, "글");
        for (int i = 0; i < 3; i++) call(other, post("/api/posts/{id}/comments", postId), "{\"body\":\"댓글 " + i + "\"}");
        List<String> ids = JsonPath.read(notis(writer).andReturn().getResponse().getContentAsString(), "$.items[*].id");
        assertEquals(3, ids.size());

        // 남의 알림은 읽거나 지울 수 없음 (그냥 0개 처리)
        call(other, patch("/api/notifications/read"), "{\"ids\":[\"" + ids.get(0) + "\"]}").andExpect(status().isNoContent());
        notis(writer).andExpect(jsonPath("$.unreadCount").value(3));

        call(writer, patch("/api/notifications/read"), "{\"ids\":[\"" + ids.get(0) + "\"]}").andExpect(status().isNoContent());
        call(writer, get("/api/notifications").param("status", "read"), null).andExpect(jsonPath("$.items.length()").value(1));
        call(writer, get("/api/notifications").param("status", "unread"), null).andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.unreadCount").value(2));

        // 안 읽은 알림은 지워지지 않음, 읽은 것만
        call(writer, delete("/api/notifications").param("ids", ids.get(0) + "," + ids.get(1)), null).andExpect(status().isNoContent());
        notis(writer).andExpect(jsonPath("$.items.length()").value(2));

        // 모두 읽음 (빈 배열) → 지우기
        call(writer, patch("/api/notifications/read"), "{\"ids\":[]}").andExpect(status().isNoContent());
        notis(writer).andExpect(jsonPath("$.unreadCount").value(0));
        call(writer, delete("/api/notifications").param("ids", String.join(",", ids)), null).andExpect(status().isNoContent());
        notis(writer).andExpect(jsonPath("$.items.length()").value(0));

        call(writer, get("/api/notifications").param("status", "new"), null).andExpect(status().isBadRequest());
        call(writer, delete("/api/notifications").param("ids", "1,abc"), null).andExpect(status().isBadRequest());
        call(writer, delete("/api/notifications"), null).andExpect(status().isBadRequest());
        call(null, get("/api/notifications"), null).andExpect(status().isUnauthorized());
    }

    @Test void adminActionsWarningsAndSupportAnswersNotify() throws Exception {
        String postId = writePost(writer, "광고 글");
        String commentId = json(call(writer, post("/api/posts/{id}/comments", writePost(other, "남의 글")), "{\"body\":\"욕설 댓글\"}"), "$.id");
        call(admin, delete("/api/admin/posts/{id}", postId).param("reason", "광고"), null).andExpect(status().isNoContent());
        call(admin, delete("/api/admin/comments/{id}", commentId), null).andExpect(status().isNoContent());
        call(admin, post("/api/admin/members/1/sanctions"), "{\"type\":\"WARNING\",\"reason\":\"도배\"}").andExpect(status().isOk());
        String inquiry = json(call(writer, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"질문\",\"content\":\"내용\"}"), "$.id");
        call(admin, post("/api/admin/support/inquiries/{id}/answer", inquiry), "{\"content\":\"답변\"}").andExpect(status().isOk());

        // 글 삭제 · 댓글 삭제 · 경고 · 문의 답변 = 4 (새 것부터). 남의 글에 단 댓글 알림은 그 글쓴이(용산주민)에게 감
        notis(writer).andExpect(jsonPath("$.items.length()").value(4))
            .andExpect(jsonPath("$.items[0].title").value("문의에 답변이 등록됐어요")).andExpect(jsonPath("$.items[0].link").value("support"))
            .andExpect(jsonPath("$.items[0].refId").value(inquiry)).andExpect(jsonPath("$.items[0].type").value("SYSTEM"))
            .andExpect(jsonPath("$.items[1].title").value("운영 정책 경고를 받았어요")).andExpect(jsonPath("$.items[1].body").value("사유: 도배"))
            .andExpect(jsonPath("$.items[2].title").value("운영 정책에 따라 내 댓글이 삭제됐어요")).andExpect(jsonPath("$.items[2].body").value("「욕설 댓글」"))
            .andExpect(jsonPath("$.items[3].title").value("운영 정책에 따라 내 글이 삭제됐어요")).andExpect(jsonPath("$.items[3].body").value("「광고 글」 · 사유: 광고"));
    }

    @Test void hiddenByReportNotifiesAndTurnedOffNotificationsAreNotCreated() throws Exception {
        String postId = writePost(writer, "숨길 글");
        call(other, post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":\"" + postId + "\",\"reason\":\"ABUSE\"}").andExpect(status().isNoContent());
        call(admin, patch("/api/admin/reports").param("targetType", "POST").param("targetId", postId), "{\"status\":\"HIDDEN\"}").andExpect(status().isNoContent());
        notis(writer).andExpect(jsonPath("$.items[0].title").value("신고가 확인돼 내 글이 숨겨졌어요"));

        // 알림을 끈 회원에게는 만들지 않음
        jdbc.update("INSERT INTO user_settings (user_id, noti_on) VALUES (2, FALSE)");
        String post2 = writePost(other, "알림 끈 사람 글");
        call(writer, post("/api/posts/{id}/comments", post2), "{\"body\":\"댓글\"}").andExpect(status().isCreated());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = 2", Integer.class));
    }
}

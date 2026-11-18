package com.zip.backend.support;

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 고객센터: 내 문의 쓰기 · 보기, 관리자 전체 보기 · 답변(한 번만) */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class SupportIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    String member, other, admin;

    @BeforeEach void seed() throws Exception {
        String hash = passwords.encode("abcd123!");
        jdbc.update("""
            INSERT INTO users (id, login_id, password_hash, nickname, role) VALUES
            (1, 'mapo01', ?, '마포주민', 'USER'), (2, 'yongsan1', ?, '용산주민', 'USER'), (9, 'admin01', ?, '운영자', 'ADMIN')
            """, hash, hash, hash);
        member = login("mapo01");
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

    private String ask(String token, String title) throws Exception {
        String response = call(token, post("/api/support/inquiries"), "{\"category\":\"오류 신고\",\"title\":\"" + title + "\",\"content\":\"일정이\\n안 보여요\"}")
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    @Test void memberWritesAndSeesOnlyOwnInquiries() throws Exception {
        call(member, post("/api/support/inquiries"), "{\"category\":\"오류 신고\",\"title\":\"  일정이 안 보여요  \",\"content\":\"새로고침해도\\n그대로예요\"}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("일정이 안 보여요"))
            .andExpect(jsonPath("$.content").value("새로고침해도\n그대로예요"))
            .andExpect(jsonPath("$.nickname").value("마포주민"))
            .andExpect(jsonPath("$.userId").value("1"))
            .andExpect(jsonPath("$.answer").isEmpty());
        ask(other, "다른 사람 문의");
        call(member, get("/api/support/inquiries"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("일정이 안 보여요"));
        call(null, get("/api/support/inquiries"), null).andExpect(status().isUnauthorized());
    }

    @Test void inputIsChecked() throws Exception {
        call(member, post("/api/support/inquiries"), "{\"category\":\"칭찬\",\"title\":\"제목\",\"content\":\"내용\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"  \",\"content\":\"내용\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"" + "가".repeat(101) + "\",\"content\":\"내용\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"두\\n줄\",\"content\":\"내용\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"제목\",\"content\":\"" + "가".repeat(3001) + "\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"제목\",\"content\":\"\\u0007삐\"}").andExpect(status().isBadRequest());
        call(member, post("/api/support/inquiries"), null).andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM support_inquiries", Integer.class));
    }

    @Test void tooManyInquiriesInADayAreRefused() throws Exception {
        for (int i = 0; i < SupportService.DAILY_MAX; i++) {
            jdbc.update("INSERT INTO support_inquiries (user_id, category, title, content) VALUES (1, '기타', ?, '내용')", "문의 " + i);
        }
        call(member, post("/api/support/inquiries"), "{\"category\":\"기타\",\"title\":\"하나 더\",\"content\":\"내용\"}").andExpect(status().isTooManyRequests());
        ask(other, "다른 사람은 괜찮아요");
    }

    @Test void onlyAdminsListAllAndAnswerOnce() throws Exception {
        String first = ask(member, "첫 문의");
        String second = ask(other, "둘째 문의");
        call(member, get("/api/admin/support/inquiries"), null).andExpect(status().isForbidden());
        call(member, post("/api/admin/support/inquiries/{id}/answer", first), "{\"content\":\"셀프 답변\"}").andExpect(status().isForbidden());

        call(admin, get("/api/admin/support/inquiries"), null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        call(admin, post("/api/admin/support/inquiries/{id}/answer", first), "{\"content\":\"  확인해 볼게요  \"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.answer.content").value("확인해 볼게요")).andExpect(jsonPath("$.answer.createdAt").isString());
        assertEquals(9L, jdbc.queryForObject("SELECT answered_by FROM support_inquiries WHERE id = ?", Long.class, Long.parseLong(first)));
        // 한 번 단 답변은 덮어쓰지 않음
        call(admin, post("/api/admin/support/inquiries/{id}/answer", first), "{\"content\":\"덮어쓰기\"}").andExpect(status().isConflict());
        call(admin, post("/api/admin/support/inquiries/{id}/answer", second), "{\"content\":\"\"}").andExpect(status().isBadRequest());
        call(admin, post("/api/admin/support/inquiries/{id}/answer", "999"), "{\"content\":\"없는 문의\"}").andExpect(status().isNotFound());
        call(admin, post("/api/admin/support/inquiries/{id}/answer", "abc"), "{\"content\":\"이상한 번호\"}").andExpect(status().isNotFound());

        // 답변 대기부터
        call(admin, get("/api/admin/support/inquiries"), null).andExpect(jsonPath("$[0].title").value("둘째 문의"))
            .andExpect(jsonPath("$[0].answer").isEmpty()).andExpect(jsonPath("$[1].answer.content").value("확인해 볼게요"));
        // 회원은 내 문의에서 답변을 봄
        call(member, get("/api/support/inquiries"), null).andExpect(jsonPath("$[0].answer.content").value("확인해 볼게요"));
    }
}

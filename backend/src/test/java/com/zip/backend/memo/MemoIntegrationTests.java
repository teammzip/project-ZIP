package com.zip.backend.memo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.json.JsonCompareMode;
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

    @Test void foldersPreserveMemosAndLedgerLinksAndEnforceOwnership() throws Exception {
        String folder = JsonPath.read(call(me, post("/api/memo-folders"), "{\"name\":\"생활\"}").andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        call(me, post("/api/memo-folders"), "{\"name\":\" 생활 \"}").andExpect(status().isConflict());
        call(me, post("/api/memo-folders"), "{\"name\":\" \"}").andExpect(status().isBadRequest());
        String memo = create(me, "{\"body\":\"관리비 확인\",\"folderId\":\"" + folder + "\"}");
        jdbc.update("UPDATE memos SET ledger_label = '가계부 · 관리비' WHERE id = ?", memo);
        call(me, patch("/api/memos/{id}", memo), "{\"title\":\"수정\"}").andExpect(status().isOk())
            .andExpect(jsonPath("$.folderId").value(folder)).andExpect(jsonPath("$.ledgerContext").value("가계부 · 관리비"));
        call(other, get("/api/memo-folders"), null).andExpect(jsonPath("$.length()").value(0));
        call(other, post("/api/memos"), "{\"folderId\":\"" + folder + "\"}").andExpect(status().isBadRequest());
        call(other, patch("/api/memo-folders/{id}", folder), "{\"name\":\"탈취\"}").andExpect(status().isNotFound());
        call(other, delete("/api/memo-folders/{id}", folder), null).andExpect(status().isNotFound());
        call(me, patch("/api/memo-folders/{id}", folder), "{\"name\":\"집 관리\"}").andExpect(status().isOk());
        call(me, patch("/api/memos/{id}", memo), "{\"folderId\":\"\"}").andExpect(status().isOk()).andExpect(jsonPath("$.folderId").isEmpty());
        call(me, patch("/api/memos/{id}", memo), "{\"folderId\":\"" + folder + "\"}").andExpect(status().isOk());
        call(me, delete("/api/memo-folders/{id}", folder), null).andExpect(status().isNoContent());
        call(me, get("/api/memos"), null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].folderId").isEmpty())
            .andExpect(jsonPath("$[0].body").value("관리비 확인")).andExpect(jsonPath("$[0].ledgerContext").value("가계부 · 관리비"));
        call(null, get("/api/memo-folders"), null).andExpect(status().isUnauthorized());
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

    @Test void createReturnsCompleteMemoWithExplicitNulls() throws Exception {
        var created = call(me, post("/api/memos"), """
            {"title":"장보기","checklist":true,"items":[{"text":"두부"},{"text":"우유","done":true}]}
            """).andExpect(status().isCreated());
        String json = created.andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(json, "$.id");
        var createdAt = jdbc.queryForObject("SELECT created_at FROM memos WHERE id = ?", Timestamp.class, id).toInstant();
        created.andExpect(content().json("""
            {"id":"%s","title":"장보기","body":"","color":"노랑","pinned":false,"checklist":true,
             "items":[{"text":"두부","done":false},{"text":"우유","done":true}],
             "createdAt":"%s","updatedAt":"%s","ledgerContext":null,"draft":false,"folderId":null}
            """.formatted(id, createdAt, createdAt), JsonCompareMode.STRICT));
    }

    @Test void listAndUpdatePreserveLedgerDraftAndStoredChecklistJson() throws Exception {
        var draft = call(me, post("/api/memos/ledger-draft"), """
            {"kind":"spend","label":"기타 지출 · 식비","key":"0123456789abcdef0123456789abcdef"}
            """).andExpect(status().isOk());
        String id = JsonPath.read(draft.andReturn().getResponse().getContentAsString(), "$.id");
        Long folder = jdbc.queryForObject("SELECT folder_id FROM memos WHERE id = ?", Long.class, id);
        var createdAt = Instant.parse("2026-11-24T03:00:00Z");
        jdbc.update("UPDATE memos SET items = ?, is_checklist = TRUE, created_at = ?, updated_at = ? WHERE id = ?",
            """
            [{"text":"영수증 확인","done":false,"tag":"확인"}]
            """, Timestamp.from(createdAt), Timestamp.from(createdAt), id);

        call(me, get("/api/memos"), null).andExpect(status().isOk()).andExpect(content().json("""
            [{"id":"%s","title":"기타 지출 · 식비","body":"","color":"노랑","pinned":false,"checklist":true,
              "items":[{"text":"영수증 확인","done":false,"tag":"확인"}],"createdAt":"%s","updatedAt":"%s",
              "ledgerContext":"기타 지출 · 식비","draft":true,"folderId":"%s"}]
            """.formatted(id, createdAt, createdAt, folder), JsonCompareMode.STRICT));

        var updated = call(me, patch("/api/memos/{id}", id), """
            {"complete":true,"folderId":""}
            """).andExpect(status().isOk());
        var updatedAt = jdbc.queryForObject("SELECT updated_at FROM memos WHERE id = ?", Timestamp.class, id).toInstant();
        updated.andExpect(content().json("""
            {"id":"%s","title":"기타 지출 · 식비","body":"","color":"노랑","pinned":false,"checklist":true,
             "items":[{"text":"영수증 확인","done":false,"tag":"확인"}],"createdAt":"%s","updatedAt":"%s",
             "ledgerContext":"기타 지출 · 식비","draft":false,"folderId":null}
            """.formatted(id, createdAt, updatedAt), JsonCompareMode.STRICT));
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

package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

/**
 * Map 으로 요청을 받는 API 14곳: 정상 요청에서 칸 하나만 이상한 값(타입이 다름 · 빈 값 · 아주 큰 수 · 아주 긴 글 · 없는 날짜 등)으로 바꿔도
 * 서버 오류(5xx)가 나지 않고 4xx 로 거절되는지 확인한다. 정상 요청 자체는 성공해야 해서(2xx) 바꾼 칸까지 실제로 검사가 닿는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql({"/auth-fixture.sql", "/home-info-fixture.sql", "/ledger-fixture.sql", "/profile-info-fixture.sql"})
class MalformedInputTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;

    private static final Object[] BAD_VALUES = {
        "abc", "", " ", null, true, 12345, -1, 0, 1.5, 1e300, new java.math.BigInteger("99999999999999999999999"),
        Map.of(), List.of(), List.of(1, 2), "x".repeat(5000), "2026-13-45", "9999-99", "<script>alert(1)</script>",
    };

    private final YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));
    private final List<String> serverErrors = new ArrayList<>();
    private String token;

    @BeforeEach
    void seed() throws Exception {
        jdbc.update("INSERT INTO users (id, login_id, password_hash, nickname, email) VALUES (1, 'tester01', ?, '회원하나', 't1@zip.com')",
            passwords.encode("abcd123!"));
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"loginId\":\"tester01\",\"password\":\"abcd123!\"}")).andReturn().getResponse().getContentAsString();
        token = JsonPath.read(body, "$.accessToken");
    }

    @Test
    void accountAndProfile() throws Exception {
        probe("PATCH /api/auth/me (profile)", () -> patch("/api/auth/me"), Map.of("nickname", "새닉네임", "bio", "소개"),
            "nickname", "bio", "avatarFileId", "avatarEmoji", "avatarColor");
        probe("PATCH /api/auth/me (consent)", () -> patch("/api/auth/me"),
            Map.of("agreeTerms", true, "agreePrivacy", true, "agreePolicy", true, "ageOver14", true, "termsVersion", "2026-10-18"),
            "address", "agreeTerms", "agreePrivacy", "agreePolicy", "ageOver14", "termsVersion");
        probe("PATCH /api/me/profile-info", () -> patch("/api/me/profile-info"), Map.of("nickname", "닉네임둘", "birth", "2000-02-29"),
            "nickname", "birth");
        probe("PUT /api/me/settings", () -> put("/api/me/settings"),
            Map.of("rent", 55, "rentDay", 15, "moveIn", "2026-01", "contractEnd", "2027-01", "notiOn", true),
            "rent", "rentDay", "moveIn", "contractEnd", "notiOn", "homeAddress", "regionId", "regionName", "lat", "lon");
        assertNoServerErrors();
    }

    @Test
    void homeInfoAndSalary() throws Exception {
        var home = new LinkedHashMap<String, Object>();
        home.put("kind", "monthly"); home.put("deposit", 10_000_000); home.put("rent", 550_000); home.put("rentDay", 15);
        home.put("mgmtIncluded", false); home.put("mgmtFee", 50_000); home.put("contractFee", 0);
        home.put("moveIn", "2026-01"); home.put("contractEnd", "2028-01"); home.put("homeAddress", "검증용 집 주소"); home.put("loan", null);
        probe("PUT /api/me/home-info", () -> put("/api/me/home-info"), home,
            "kind", "deposit", "rent", "rentDay", "mgmtIncluded", "mgmtFee", "contractFee", "moveIn", "contractEnd", "homeAddress", "loan");

        var jeonse = new LinkedHashMap<>(home); jeonse.put("kind", "jeonse"); jeonse.put("contractFee", 20_000_000);
        status(json(put("/api/me/home-info"), jeonse));
        var loan = new LinkedHashMap<String, Object>(Map.of("principal", 100_000_000, "annualRate", 3.5, "startDate", "2026-01-01", "paymentDay", 25));
        probe("PUT /api/me/home-info/loan", () -> put("/api/me/home-info/loan"), Map.of("loan", loan), "loan");
        for (String field : List.of("principal", "annualRate", "startDate", "paymentDay")) {
            for (Object bad : BAD_VALUES) {
                var changed = new LinkedHashMap<>(loan); changed.put(field, bad);
                var body = new LinkedHashMap<String, Object>(); body.put("loan", changed);
                record("PUT /api/me/home-info/loan", "loan." + field, bad, status(json(put("/api/me/home-info/loan"), body)));
            }
        }
        probe("PUT /api/me/salary", () -> put("/api/me/salary").param("timeZone", "Asia/Seoul"),
            Map.of("amount", 2_500_000, "incomePeriod", "monthly", "paymentDay", 1), "amount", "incomePeriod", "paymentDay");
        assertNoServerErrors();
    }

    @Test
    void monthlyBills() throws Exception {
        String due = LocalDate.now(ZoneId.of("Asia/Seoul")).toString(); // 납부 기한은 오늘 이후여야 함 (오늘은 항상 이번 달)
        probe("POST /api/bills/monthly", () -> post("/api/bills/monthly").param("month", month.toString()).param("timeZone", "Asia/Seoul"),
            Map.of("tag", "공과금", "amount", 40_000, "dueDate", due, "name", "전기"), "tag", "amount", "dueDate", "name", "memo", "memoId");
        String id = createMonthly("통신비");
        probe("PATCH /api/bills/monthly/{id}", () -> patch("/api/bills/monthly/" + id).param("month", month.toString()).param("timeZone", "Asia/Seoul"),
            Map.of("amount", 41_000, "dueDate", due), "tag", "amount", "dueDate", "name", "memo", "memoId");
        probe("PUT /api/bills/monthly/{id}/payment", () -> put("/api/bills/monthly/" + id + "/payment").param("month", month.toString()).param("timeZone", "Asia/Seoul"),
            Map.of("paid", true), "paid");
        String effective = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1).toString();
        String other = createMonthly("구독");
        probe("POST /api/bills/monthly/{id}/termination", () -> post("/api/bills/monthly/" + other + "/termination").param("timeZone", "Asia/Seoul"),
            Map.of("effectiveDate", effective), "effectiveDate");
        assertNoServerErrors();
    }

    @Test
    void legacyBills() throws Exception {
        probe("POST /api/bills", () -> post("/api/bills"), Map.of("name", "관리비", "amount", 50_000, "tag", "관리비"), "name", "amount", "tag");
        String body = mvc.perform(auth(post("/api/bills")).contentType("application/json").content("{\"name\":\"전기\",\"amount\":30000,\"tag\":\"공과금\"}"))
            .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        probe("PATCH /api/bills/{id}", () -> patch("/api/bills/" + id), Map.of("amount", 31_000), "name", "amount", "tag");
        probe("PUT /api/bills/{id}/payments/{month}", () -> put("/api/bills/" + id + "/payments/" + month), Map.of("paid", true), "paid", "amount");
        assertNoServerErrors();
    }

    @Test
    void ledgerMemoDraft() throws Exception {
        probe("POST /api/memos/ledger-draft", () -> post("/api/memos/ledger-draft"),
            Map.of("kind", "spend", "key", "a".repeat(32), "label", "기타 지출 · 식비"), "kind", "key", "label", "incomeType", "memoId");
        assertNoServerErrors();
    }

    /** 정상 요청이 성공하는지 확인한 뒤, 칸마다 이상한 값으로 하나씩 바꿔 보냄. 모르는 칸 하나도 끼워 봄 */
    private void probe(String name, Supplier<MockHttpServletRequestBuilder> request, Map<String, ?> valid, String... fields) throws Exception {
        var baseResponse = mvc.perform(json(request.get(), new LinkedHashMap<>(valid))).andReturn().getResponse();
        int base = baseResponse.getStatus();
        assertTrue(base >= 200 && base < 300, name + " 정상 요청이 " + base + " 로 실패 (검사 기준이 잘못됨): " + baseResponse.getContentAsString());
        var targets = new ArrayList<>(Arrays.asList(fields));
        targets.add("unknownField");
        for (String field : targets) {
            for (Object bad : BAD_VALUES) {
                var body = new LinkedHashMap<String, Object>(valid);
                body.put(field, bad);
                record(name, field, bad, status(json(request.get(), body)));
            }
        }
        // 본문 자체가 객체가 아닌 경우
        for (String raw : List.of("[]", "\"text\"", "123", "null", "{", "")) {
            record(name, "(body)", raw, mvc.perform(auth(request.get()).contentType("application/json").content(raw)).andReturn().getResponse().getStatus());
        }
    }

    private void record(String name, String field, Object bad, int status) {
        if (status >= 500) {
            String shown = bad instanceof String s && s.length() > 30 ? s.substring(0, 10) + "…(" + s.length() + "자)" : String.valueOf(bad);
            serverErrors.add(name + "  " + field + "=" + shown + " → " + status);
        }
    }

    private void assertNoServerErrors() {
        assertTrue(serverErrors.isEmpty(), serverErrors.size() + "건 서버 오류:\n" + String.join("\n", serverErrors));
    }

    private String createMonthly(String name) throws Exception {
        String body = mvc.perform(auth(post("/api/bills/monthly").param("month", month.toString()).param("timeZone", "Asia/Seoul"))
            .contentType("application/json").content(json.writeValueAsString(Map.of("tag", "통신", "amount", 30_000, "dueDate", LocalDate.now(ZoneId.of("Asia/Seoul")).toString(), "name", name))))
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Map<String, ?> body) throws Exception {
        return auth(request).contentType("application/json").content(json.writeValueAsString(body));
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token);
    }

    private int status(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }
}

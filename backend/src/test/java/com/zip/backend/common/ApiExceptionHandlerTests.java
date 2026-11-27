package com.zip.backend.common;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 처리하지 못한 오류도 {"message"} 한 가지 모양으로, 내부 내용 없이, 알맞은 상태로 나가는지 */
class ApiExceptionHandlerTests {
    @RestController
    static class Failing {
        @GetMapping("/boom") String boom() { throw new IllegalStateException("SELECT password_hash FROM users -- 내부 내용"); }
        @GetMapping("/duplicate") String duplicate() { throw new DuplicateKeyException("Duplicate entry 'a@zip.com' for key 'uk_users_email'"); }
        @GetMapping("/denied") String denied() { throw new AccessDeniedException("no"); }
        @GetMapping("/number") String number(@RequestParam int n) { return "ok " + n; }
        @GetMapping("/api-error") String apiError() { throw new ApiException(404, "글이 없어요.", "POST_NOT_FOUND"); }
    }

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new Failing()).setControllerAdvice(new ApiExceptionHandler()).build();

    @Test
    void unexpectedErrorIs500WithoutInternalDetails() throws Exception {
        mvc.perform(get("/boom")).andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요."))
            .andExpect(content().string(not(containsString("password_hash"))))
            .andExpect(content().string(not(containsString("IllegalStateException"))));
    }

    @Test
    void integrityViolationIs409WithoutSql() throws Exception {
        mvc.perform(get("/duplicate")).andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").exists())
            .andExpect(content().string(not(containsString("uk_users_email"))));
    }

    @Test
    void frameworkStatusesAreKept() throws Exception {
        mvc.perform(post("/number?n=1")).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.message").value("지원하지 않는 요청 방식이에요."));
        mvc.perform(get("/number?n=abc")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("요청 값의 형식을 확인해 주세요."));
        mvc.perform(get("/number")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("요청 내용을 확인해 주세요."));
    }

    @Test
    void existingApiErrorsAreUnchanged() throws Exception {
        mvc.perform(get("/api-error")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("글이 없어요.")).andExpect(jsonPath("$.code").value("POST_NOT_FOUND"));
    }

    @Test
    void securityErrorsAreLeftToSpringSecurity() {
        // 보안 필터가 401 · 403 으로 바꾸도록 그대로 다시 던짐 (500 으로 바꾸지 않음)
        var thrown = assertThrows(Exception.class, () -> mvc.perform(get("/denied")));
        assertInstanceOf(AccessDeniedException.class, thrown.getCause());
    }
}

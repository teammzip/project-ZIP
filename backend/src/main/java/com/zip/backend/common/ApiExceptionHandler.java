package com.zip.backend.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 모든 오류 응답을 {"message"(, "code")} 한 가지 모양으로 보냄. 화면은 message 를 그대로 보여 줘요. */
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> handleUploadSize(org.springframework.web.multipart.MaxUploadSizeExceededException error) {
        return ResponseEntity.status(413).body(Map.of("message", "사진은 2MB 이하여야 해요."));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, String>> handleApi(ApiException error) {
        return ResponseEntity.status(error.status()).body(error.code() == null
            ? Map.of("message", error.getMessage())
            : Map.of("message", error.getMessage(), "code", error.code()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().stream().findFirst();
        return ResponseEntity.badRequest().body(Map.of("message", field
            .map(e -> e.getField() + ": " + e.getDefaultMessage()).orElse("입력값을 확인해 주세요.")));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, String>> handleJson(HttpMessageNotReadableException error) {
        return ResponseEntity.badRequest().body(Map.of("message", "요청 JSON 형식을 확인해 주세요."));
    }

    /** 주소의 숫자 자리에 글자를 넣는 등 요청 값의 형식이 틀림 (?month=abc, /api/bills/abc) */
    @ExceptionHandler(TypeMismatchException.class)
    ResponseEntity<Map<String, String>> handleTypeMismatch(TypeMismatchException error) {
        return ResponseEntity.badRequest().body(Map.of("message", "요청 값의 형식을 확인해 주세요."));
    }

    /** 서비스가 미리 막지 못한 중복 · 제약 위반 (UNIQUE 키 · 외래 키 등). 같은 요청을 두 번 보낸 경우가 대부분이라 409 */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> handleIntegrity(DataIntegrityViolationException error, HttpServletRequest request) {
        log.warn("Data integrity violation on {} {}: {}", request.getMethod(), request.getRequestURI(), error.getMostSpecificCause().getMessage());
        return ResponseEntity.status(409).body(Map.of("message", "이미 처리됐거나 다른 정보와 맞지 않아 저장하지 못했어요. 새로고침한 뒤 다시 시도해 주세요."));
    }

    /**
     * 위에서 처리하지 않은 나머지.
     * - 로그인 · 권한 오류는 Spring Security 가 401 · 403 으로 처리하도록 그대로 넘김
     * - Spring 이 상태를 정해 둔 오류(없는 주소 404 · 지원하지 않는 메서드 405 · 빠진 파라미터 400 등)는 그 상태를 유지
     * - 정말 예상하지 못한 오류만 500. 내부 내용(SQL · 스택)은 응답에 넣지 않고 서버 로그에만 남김
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> handleUnexpected(Exception error, HttpServletRequest request) throws Exception {
        if (error instanceof AccessDeniedException || error instanceof AuthenticationException) throw error;
        if (error instanceof ErrorResponse framework) {
            HttpStatusCode status = framework.getStatusCode();
            if (status.is5xxServerError()) log.error("Server error on {} {}", request.getMethod(), request.getRequestURI(), error);
            return ResponseEntity.status(status).body(Map.of("message", frameworkMessage(status.value())));
        }
        log.error("Unexpected error on {} {}", request.getMethod(), request.getRequestURI(), error);
        return ResponseEntity.status(500).body(Map.of("message", "서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요."));
    }

    private static String frameworkMessage(int status) {
        return switch (status) {
            case 400 -> "요청 내용을 확인해 주세요.";
            case 404 -> "찾는 정보가 없어요.";
            case 405 -> "지원하지 않는 요청 방식이에요.";
            case 406, 415 -> "지원하지 않는 요청 형식이에요.";
            case 503 -> "잠시 뒤 다시 시도해 주세요.";
            default -> status >= 500 ? "서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요." : "요청을 처리하지 못했어요.";
        };
    }
}

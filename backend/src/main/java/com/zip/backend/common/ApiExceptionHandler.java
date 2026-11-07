package com.zip.backend.common;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
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
}

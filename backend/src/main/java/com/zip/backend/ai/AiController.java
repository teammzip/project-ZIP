package com.zip.backend.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** AI chat with saved conversations (frontend/API.md section 8). Logged-in users only, and only their own conversations. */
@RestController
public class AiController {
    public record CreateRequest(@NotBlank @Size(max = 20) String entryPoint, @Size(max = 20) String topic) {}

    public record AskRequest(@NotBlank @Size(max = 2000) String text, @Size(max = 20) String topic) {}

    public record Card(@NotBlank @Size(max = 20) String type, @NotNull Map<String, Object> data) {}

    public record RecordRequest(@NotBlank @Size(max = 2000) String text, @NotBlank @Size(max = 4000) String reply, @Valid Card card) {}

    private final AiService ai;

    public AiController(AiService ai) { this.ai = ai; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    @GetMapping("/api/ai/conversations")
    public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String entryPoint) {
        return ai.list(userId(jwt), entryPoint);
    }

    @PostMapping("/api/ai/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest request) {
        return ai.create(userId(jwt), request.entryPoint(), request.topic());
    }

    @GetMapping("/api/ai/conversations/{id}/messages")
    public List<Map<String, Object>> messages(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return ai.messages(userId(jwt), id);
    }

    /** Ask the AI: saves the question and the answer, returns { user, reply }. */
    @PostMapping("/api/ai/conversations/{id}/messages")
    public Map<String, Object> ask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody AskRequest request) {
        return ai.ask(userId(jwt), id, request.text(), request.topic());
    }

    /** Save an exchange the app answered itself (fixed topics, spend summary card, demo answer). */
    @PostMapping("/api/ai/conversations/{id}/exchanges")
    public Map<String, Object> record(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody RecordRequest request) {
        var card = request.card() == null ? null : new AiService.CardInput(request.card().type(), request.card().data());
        return ai.record(userId(jwt), id, request.text(), request.reply(), card);
    }

    @DeleteMapping("/api/ai/conversations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) { ai.delete(userId(jwt), id); }

    /** "데이터 초기화": every conversation of the logged-in user. */
    @DeleteMapping("/api/ai/conversations")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAll(@AuthenticationPrincipal Jwt jwt) { ai.deleteAll(userId(jwt)); }
}

package com.zip.backend.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Google Gemini API (generateContent). The key lives only in server settings and is sent in a header, never in the URL. */
@Component
public class GeminiClient {
    /** One chat turn. role is "user" or "model" (the name Gemini uses for the assistant). */
    public record Turn(String role, String text) {}

    @JsonIgnoreProperties(ignoreUnknown = true) record Response(List<Candidate> candidates) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Candidate(Content content) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Content(List<Part> parts) {}
    @JsonIgnoreProperties(ignoreUnknown = true) record Part(String text) {}

    private final RestClient rest;
    private final String key;
    private final String model;

    public GeminiClient(@Value("${zip.gemini.api-key:}") String key, @Value("${zip.gemini.model:gemini-3.1-flash-lite}") String model) {
        this.key = key == null ? "" : key.trim();
        this.model = model;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(30_000);
        this.rest = RestClient.builder().baseUrl("https://generativelanguage.googleapis.com").requestFactory(factory).build();
    }

    public boolean enabled() { return !key.isEmpty(); }

    /** Sends the system instruction plus the conversation and returns the answer text (empty if the model returned none). */
    public String chat(String system, List<Turn> turns) {
        var contents = new ArrayList<Map<String, Object>>();
        for (var turn : turns) contents.add(Map.of("role", turn.role(), "parts", List.of(Map.of("text", turn.text()))));
        var body = Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", system))),
            "contents", contents,
            "generationConfig", Map.of("maxOutputTokens", 2048, "temperature", 0.6));
        var response = rest.post().uri("/v1beta/models/{model}:generateContent", model)
            .header("x-goog-api-key", key).body(body).retrieve().body(Response.class);
        if (response == null || response.candidates() == null || response.candidates().isEmpty()) return "";
        var content = response.candidates().get(0).content();
        if (content == null || content.parts() == null) return "";
        var text = new StringBuilder();
        for (var part : content.parts()) if (part.text() != null) text.append(part.text());
        return text.toString().strip();
    }
}

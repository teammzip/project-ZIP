package com.zip.backend.map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class MapRequests {
    private MapRequests() {}

    public record AiSearch(
        @NotBlank @Size(max = 40) String q,
        @NotBlank @Pattern(regexp = "[1-9][0-9]{0,18}") String regionId) {}

    /** 칩에 보일 종류(place_categories 이름)와 직접 추가한 검색어 — 프론트 features/map/store.ts 와 같은 규칙 */
    public record MapSettings(
        @NotNull @Size(max = 15) List<@NotBlank @Size(max = 20) String> categories,
        @NotNull @Size(max = 20) List<@NotBlank @Size(max = 12) String> keywords) {}

    public record Review(
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 300) String body) {}
}

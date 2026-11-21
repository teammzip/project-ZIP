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

    public record NearbySearch(@NotBlank @Size(max = 40) String q, @NotNull Double lat, @NotNull Double lon) {}

    /** 칩에 보일 종류(place_categories 이름)와 직접 추가한 검색어 — 프론트 features/map/store.ts 와 같은 규칙 */
    public record MapSettings(
        @NotNull @Size(max = 15) List<@NotBlank @Size(max = 20) String> categories,
        @NotNull @Size(max = 20) List<@NotBlank @Size(max = 12) String> keywords) {}

    /** 카카오 장소 즐겨찾기 때만 보냄: 저장 목록에 보일 이름과 우리 종류 이름 (주소 · 좌표는 받지 않음) */
    public record KakaoFavorite(String name, String category) {}

    /** 저장 리스트 만들기 · 고치기: 이름(20자) · 색(#RRGGBB, 없으면 초록) */
    public record PlaceListInput(String name, String color) {}

    /** ★ 저장 창의 [저장]: 고른 리스트 id (비우면 저장 풂). 카카오 장소면 name · category 도 */
    public record PlaceListsInput(List<String> listIds, String name, String category) {}

    public record Review(
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 300) String body) {}
}

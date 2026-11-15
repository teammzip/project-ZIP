package com.zip.backend.map;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** 지도 API (backend/openapi.yaml "지도" 태그 9개). 모두 로그인 후 요청 */
@RestController
public class MapController {
    private final MapService map;

    public MapController(MapService map) { this.map = map; }

    private static long userId(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }

    @GetMapping("/api/places/categories")
    public List<Map<String, Object>> categories() { return map.categories(); }

    @GetMapping("/api/places")
    public List<Map<String, Object>> places(@AuthenticationPrincipal Jwt jwt, @RequestParam String regionId,
        @RequestParam(required = false) String category, @RequestParam(required = false) String q,
        @RequestParam(required = false) String filter, @RequestParam(required = false) Double lat,
        @RequestParam(required = false) Double lon, @RequestParam(defaultValue = "false") boolean wide,
        jakarta.servlet.http.HttpServletResponse response) {
        var result = map.places(userId(jwt), regionId, category, q, filter, lat, lon, wide);
        // 카카오를 못 써서 DB 장소로 대신했으면 이유 코드 (user-limit · daily-limit · error)
        if (result.notice() != null) response.setHeader(PLACE_NOTICE, result.notice());
        return result.items();
    }

    static final String PLACE_NOTICE = "X-Place-Notice";

    @PostMapping("/api/places/ai-search")
    public List<Map<String, Object>> aiSearch(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MapRequests.AiSearch request) {
        return map.aiSearch(userId(jwt), request);
    }

    @GetMapping("/api/places/{id}/reviews")
    public List<Map<String, Object>> reviews(@PathVariable String id) { return map.reviews(id); }

    @PostMapping("/api/places/{id}/reviews")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addReview(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody MapRequests.Review request) {
        map.addReview(userId(jwt), id, request);
    }

    @GetMapping("/api/me/place-favorites")
    public List<String> favorites(@AuthenticationPrincipal Jwt jwt) { return map.favorites(userId(jwt)); }

    @PutMapping("/api/me/place-favorites/{placeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addFavorite(@AuthenticationPrincipal Jwt jwt, @PathVariable String placeId,
        @RequestBody(required = false) MapRequests.KakaoFavorite kakaoPlace) {
        // 카카오 장소("kakao:…")는 { name, category } 를 같이 보냄 (id · 이름만 저장, 주소 · 좌표는 저장 안 함)
        map.addFavorite(userId(jwt), placeId, kakaoPlace);
    }

    /** 저장한 카카오 장소의 이름 · 종류 (저장 목록용) */
    @GetMapping("/api/me/place-favorites/kakao")
    public List<Map<String, String>> kakaoFavorites(@AuthenticationPrincipal Jwt jwt) { return map.kakaoFavorites(userId(jwt)); }

    @DeleteMapping("/api/me/place-favorites/{placeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFavorite(@AuthenticationPrincipal Jwt jwt, @PathVariable String placeId) { map.removeFavorite(userId(jwt), placeId); }

    @GetMapping("/api/me/map-settings")
    public Map<String, List<String>> mapSettings(@AuthenticationPrincipal Jwt jwt) { return map.mapSettings(userId(jwt)); }

    @PutMapping("/api/me/map-settings")
    public Map<String, List<String>> saveMapSettings(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MapRequests.MapSettings request) {
        return map.saveMapSettings(userId(jwt), request);
    }
}

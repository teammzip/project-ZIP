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
        @RequestParam(required = false) Double lon, @RequestParam(defaultValue = "false") boolean wide) {
        return map.places(userId(jwt), regionId, category, q, filter, lat, lon, wide);
    }

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
    public void addFavorite(@AuthenticationPrincipal Jwt jwt, @PathVariable String placeId) { map.addFavorite(userId(jwt), placeId); }

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

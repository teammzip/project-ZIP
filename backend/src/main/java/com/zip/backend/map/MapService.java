package com.zip.backend.map;

import com.zip.backend.common.ApiException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MapService {
    /** 사람이 걷는 속도 (분당 약 67m = 시속 4km) */
    private static final double METERS_PER_MINUTE = 67;
    private static final Pattern WALK_TEXT = Pattern.compile("(\\d+)\\s*분");
    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");
    private static final Map<String, Pattern> FILTERS = Map.of(
        "24h", Pattern.compile("24시간|심야|야간"),
        "cheap", Pattern.compile("저렴|월 3만원"),
        "quiet", Pattern.compile("조용|스터디|콘센트"));
    /** 처음 칩에 보이는 종류 수 (DB map_categories 가 NULL 이면 정렬 순서 앞의 4개) */
    private static final int DEFAULT_CATEGORY_COUNT = 4;

    /** 카카오 분류 코드가 있는 종류 (https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category) */
    private static final Map<String, String> KAKAO_CODES = Map.of(
        "편의점", "CS2", "약국", "PM9", "마트", "MT1", "카페", "CE7", "병원", "HP8", "은행", "BK9", "식당", "FD6");
    /** 분류 코드가 없는 종류는 이 말로 키워드 검색 */
    private static final Map<String, String> KAKAO_KEYWORDS = Map.of(
        "세탁방", "빨래방", "헬스장", "헬스장", "미용실", "미용실", "다이소", "다이소", "공원", "공원",
        "반찬가게", "반찬가게", "세탁소", "세탁소", "주민센터", "주민센터");
    private static final int KAKAO_RADIUS = 1_000;
    /** 검색창(wide)에서 가게 이름을 찾을 때의 근처 반경 */
    private static final int KAKAO_KEYWORD_RADIUS = 5_000;
    /** 검색으로 찾은 곳 중 기본 종류에 안 맞는 곳 (place_categories '기타', 칩에는 안 보임) */
    static final String OTHER = "기타";
    private static final Logger log = LoggerFactory.getLogger(MapService.class);

    private final MapRepository repository;
    private final KakaoLocalClient kakao;

    public MapService(MapRepository repository, KakaoLocalClient kakao) {
        this.repository = repository;
        this.kakao = kakao;
    }

    public List<Map<String, Object>> categories() {
        return repository.categories().stream().map(c -> Map.<String, Object>of(
            "id", Long.toString(c.id()), "name", c.name(), "icon", c.icon())).toList();
    }

    public List<Map<String, Object>> places(long userId, String regionId, String category, String q, String filter, Double lat, Double lon, boolean wide) {
        var keyword = q == null || q.isBlank() ? null : q.trim();
        if (keyword != null && keyword.length() > 40) throw new ApiException(400, "검색어는 40자 이내로 입력해 주세요.");
        var condition = filter == null || filter.isBlank() ? null : FILTERS.get(filter);
        if (filter != null && !filter.isBlank() && condition == null) throw new ApiException(400, "filter 는 24h, cheap, quiet 중 하나예요.");
        if ((lat == null) != (lon == null) || (lat != null && (Math.abs(lat) > 90 || Math.abs(lon) > 180))) {
            throw new ApiException(400, "lat · lon 은 둘 다 올바른 좌표로 보내 주세요.");
        }
        var kind = category == null || category.isBlank() ? null : category.trim();
        var region = region(regionId);
        var home = repository.home(userId);
        // 카카오 검색 중심: 보낸 좌표(지도 중심) → 우리 집. 도보 시간은 우리 집 → 지도 중심 기준
        var center = lat != null ? Optional.of(new MapRepository.Point(lat, lon)) : home;
        var origin = home.isPresent() ? home : center;
        var kakaoUsed = kakao.enabled() && center.isPresent() && (kind != null || keyword != null) && !OTHER.equals(kind);
        var rows = kakaoUsed
            ? kakaoPlaces(region, kind, keyword, center.get(), wide)
            : repository.places(region, kind, keyword);
        return rows.stream()
            .filter(p -> condition == null || condition.matcher(text(p)).find())
            // 종류 · 검색어 칩은 가까운 순. 검색창(wide)은 정한 순서 그대로 (이름이 같은 곳 → 이름에 든 곳)
            .sorted(keyword != null && kakaoUsed && wide ? (a, b) -> 0
                : Comparator.comparingInt((MapRepository.PlaceRow p) -> walkMin(p, origin)).thenComparingLong(MapRepository.PlaceRow::id))
            .map(p -> place(p, origin)).toList();
    }

    /** 카카오에서 지도 중심 근처 장소를 찾아 DB 에 저장 · 갱신한 뒤 돌려줌. 카카오가 실패하면 DB 장소로
     * - 종류 칩 · 검색어 칩: 반경 1km 가까운 순
     * - 검색창(wide): 반경 5km 가까운 순 + 거리 제한 없는 정확도 순을 합쳐 이름이 같은 곳 → 이름에 든 곳 → 나머지 */
    List<MapRepository.PlaceRow> kakaoPlaces(long region, String kind, String keyword, MapRepository.Point center, boolean wide) {
        List<KakaoLocalClient.Document> docs;
        try {
            var code = kind == null ? null : KAKAO_CODES.get(kind);
            docs = code != null ? kakao.category(code, center.lat(), center.lon(), KAKAO_RADIUS)
                : kind != null ? kakao.keyword(KAKAO_KEYWORDS.getOrDefault(kind, kind), center.lat(), center.lon(), KAKAO_RADIUS)
                : kakao.keyword(keyword, center.lat(), center.lon(), wide ? KAKAO_KEYWORD_RADIUS : KAKAO_RADIUS);
            if (kind == null && wide) {
                var nearby = docs;
                var accurate = kakao.keywordByAccuracy(keyword, center.lat(), center.lon());
                docs = java.util.stream.Stream.concat(nearby.stream(), accurate.stream())
                    .filter(distinctById())
                    .sorted(Comparator.comparingInt((KakaoLocalClient.Document d) -> rank(d, keyword)))
                    .toList();
            }
        } catch (RestClientException error) {
            log.warn("카카오 로컬 API 실패 — DB 장소로 대신해요: {}", error.getMessage());
            return repository.places(region, kind, keyword);
        }
        var ids = new ArrayList<Long>();
        for (var doc : docs) {
            // 종류 칩이면 그 종류, 검색어면 카카오 분류로 나누고 안 맞으면 '기타'
            var name = kind != null ? kind : Optional.ofNullable(kindOf(doc)).orElse(OTHER);
            if (doc.x() == null || doc.y() == null) continue;
            var categoryId = repository.categoryId(name);
            if (categoryId.isEmpty()) continue;
            var parts = doc.category_name() == null ? new String[0] : doc.category_name().split(">");
            var description = parts.length == 0 ? "" : parts[parts.length - 1].trim();
            ids.add(repository.upsertKakao(region, categoryId.get(), doc, description));
        }
        return repository.placesByIds(ids);
    }

    /** 0 = 이름이 검색어와 같음, 1 = 이름에 검색어가 들어 있음, 2 = 그 밖 (띄어쓰기 · 대소문자 무시) */
    private static int rank(KakaoLocalClient.Document doc, String keyword) {
        var name = doc.place_name() == null ? "" : doc.place_name().replaceAll("\\s", "").toLowerCase(java.util.Locale.ROOT);
        var query = keyword.replaceAll("\\s", "").toLowerCase(java.util.Locale.ROOT);
        return name.equals(query) ? 0 : name.contains(query) ? 1 : 2;
    }

    private static java.util.function.Predicate<KakaoLocalClient.Document> distinctById() {
        var seen = new java.util.HashSet<String>();
        return d -> seen.add(d.id());
    }

    /** 카카오 장소 → 우리 종류 이름 (분류 코드 → 분류 글자 순으로) */
    private static String kindOf(KakaoLocalClient.Document doc) {
        for (var entry : KAKAO_CODES.entrySet()) if (entry.getValue().equals(doc.category_group_code())) return entry.getKey();
        var text = doc.category_name() == null ? "" : doc.category_name();
        for (var entry : KAKAO_KEYWORDS.entrySet()) if (text.contains(entry.getValue()) || text.contains(entry.getKey())) return entry.getKey();
        return null;
    }

    public List<Map<String, Object>> aiSearch(long userId, MapRequests.AiSearch request) {
        var home = repository.home(userId);
        var kinds = repository.categories().stream().map(MapRepository.Category::name).toList();
        return PlaceFinder.find(request.q().trim(), repository.places(region(request.regionId()), null, null), kinds,
                p -> walkMin(p, home))
            .stream().map(found -> Map.<String, Object>of("place", place(found.place(), home),
                "reasons", found.reasons(), "walkMin", walkMin(found.place(), home))).toList();
    }

    public List<String> favorites(long userId) {
        return repository.favorites(userId).stream().map(id -> Long.toString(id)).toList();
    }

    public void addFavorite(long userId, String placeId) {
        repository.addFavorite(userId, existingPlace(placeId).id());
    }

    public void removeFavorite(long userId, String placeId) {
        repository.removeFavorite(userId, id(placeId));
    }

    public Map<String, List<String>> mapSettings(long userId) {
        var categories = repository.mapList(userId, "map_categories").orElseGet(() -> repository.categories().stream()
            .limit(DEFAULT_CATEGORY_COUNT).map(MapRepository.Category::name).toList());
        return Map.of("categories", categories, "keywords", repository.mapList(userId, "map_keywords").orElse(List.of()));
    }

    @Transactional
    public Map<String, List<String>> saveMapSettings(long userId, MapRequests.MapSettings request) {
        var known = repository.categories().stream().map(MapRepository.Category::name).toList();
        var categories = new LinkedHashSet<String>();
        for (var name : request.categories()) {
            if (!known.contains(name.trim())) throw new ApiException(400, "없는 장소 종류예요: " + name.trim());
            categories.add(name.trim());
        }
        var keywords = new LinkedHashSet<String>();
        for (var raw : request.keywords()) {
            var keyword = raw.trim();
            if (keyword.isEmpty() || CONTROL.matcher(keyword).find()) throw new ApiException(400, "검색어를 확인해 주세요.");
            if (known.contains(keyword)) throw new ApiException(400, "이미 있는 장소 종류예요: " + keyword);
            keywords.add(keyword);
        }
        repository.saveMapSettings(userId, List.copyOf(categories), List.copyOf(keywords));
        return Map.of("categories", List.copyOf(categories), "keywords", List.copyOf(keywords));
    }

    public List<Map<String, Object>> reviews(String placeId) {
        return repository.reviews(existingPlace(placeId).id()).stream().map(r -> Map.<String, Object>of(
            "id", Long.toString(r.id()), "rating", r.rating(), "body", r.body() == null ? "" : r.body(),
            "author", Map.of("id", Long.toString(r.authorId()), "nickname", r.authorNickname()),
            "createdAt", r.createdAt().toString())).toList();
    }

    @Transactional
    public void addReview(long userId, String placeId, MapRequests.Review request) {
        var body = request.body() == null || request.body().isBlank() ? null : request.body().trim();
        if (!repository.addReview(existingPlace(placeId).id(), userId, request.rating(), body)) {
            throw new ApiException(409, "이미 이 장소에 리뷰를 썼어요.");
        }
    }

    private long region(String regionId) {
        long id;
        try { id = Long.parseLong(regionId); }
        catch (NumberFormatException | NullPointerException error) { throw new ApiException(400, "동네(regionId)를 확인해 주세요."); }
        if (id <= 0 || !repository.regionExists(id)) throw new ApiException(400, "동네(regionId)를 확인해 주세요.");
        return id;
    }

    private static long id(String placeId) {
        try {
            long id = Long.parseLong(placeId);
            if (id > 0) return id;
        } catch (NumberFormatException error) {
            // 아래에서 404
        }
        throw new ApiException(404, "장소를 찾을 수 없어요.");
    }

    private MapRepository.PlaceRow existingPlace(String placeId) {
        return repository.findPlace(id(placeId)).orElseThrow(() -> new ApiException(404, "장소를 찾을 수 없어요."));
    }

    private static String text(MapRepository.PlaceRow p) {
        return (p.description() == null ? "" : p.description()) + " " + (p.openHours() == null ? "" : p.openHours());
    }

    /** 우리 집 좌표가 있으면 직선 거리로, 없으면 설명의 "도보 약 N분"으로. 둘 다 없으면 99 (맨 뒤) */
    static int walkMin(MapRepository.PlaceRow p, Optional<MapRepository.Point> home) {
        if (home.isPresent()) {
            return (int) Math.max(1, Math.ceil(meters(home.get().lat(), home.get().lon(), p.lat(), p.lon()) / METERS_PER_MINUTE));
        }
        var match = WALK_TEXT.matcher(p.description() == null ? "" : p.description());
        return match.find() ? Integer.parseInt(match.group(1)) : 99;
    }

    private static double meters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static Map<String, Object> place(MapRepository.PlaceRow p, Optional<MapRepository.Point> home) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(p.id()));
        result.put("category", p.category());
        result.put("name", p.name());
        result.put("description", p.description() == null ? "" : p.description());
        result.put("lat", p.lat());
        result.put("lon", p.lon());
        result.put("walkMin", walkMin(p, home));
        result.put("address", p.address());
        result.put("phone", p.phone());
        result.put("openHours", p.openHours());
        result.put("rating", p.rating());
        result.put("reviewCount", p.reviewCount());
        return result;
    }
}

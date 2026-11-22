package com.zip.backend.map;

import com.zip.backend.common.ApiException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
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

    private final MapRepository repository;
    private final KakaoLocalClient kakao;
    private final KakaoQuota quota;

    public MapService(MapRepository repository, KakaoLocalClient kakao, KakaoQuota quota) {
        this.repository = repository;
        this.kakao = kakao;
        this.quota = quota;
    }

    public List<Map<String, Object>> categories() {
        return repository.categories().stream().map(c -> Map.<String, Object>of(
            "id", Long.toString(c.id()), "name", c.name(), "icon", c.icon())).toList();
    }

    /** 장소 목록 + 카카오를 못 써서 DB 장소로 대신했을 때의 이유 코드 (없으면 null) */
    public record PlaceResult(List<Map<String, Object>> items, String notice) {}
    public record NearbyPlace(String id, String name, String address, long distanceMeters, double lat, double lon, String category) {}

    /** 응답 장소 한 곳. 카카오 장소는 DB 번호가 없어 id 가 "kakao:카카오장소id" */
    record Item(String id, MapRepository.PlaceRow row) {}

    static final String KAKAO_ID = "kakao:";

    public PlaceResult places(long userId, String regionId, String category, String q, String filter, Double lat, Double lon, boolean wide) {
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
        List<Item> rows;
        String notice = null;
        if (kakaoUsed) {
            try {
                var point = center.get();
                // 지도에서는 약 100m 안의 같은 검색에 캐시를 공유한다.
                var cell = Math.round(point.lat() * 1_000) + "," + Math.round(point.lon() * 1_000);
                rows = kakaoPlaces(userId, kind, keyword, point, wide, cell);
            } catch (KakaoQuota.Unavailable unavailable) {
                notice = unavailable.code();
                rows = dbPlaces(region, kind, keyword);
            }
        } else {
            rows = dbPlaces(region, kind, keyword);
        }
        boolean keepOrder = keyword != null && kakaoUsed && notice == null && wide;
        var items = rows.stream()
            .filter(p -> condition == null || condition.matcher(text(p.row())).find())
            // 종류 · 검색어 칩은 가까운 순. 검색창(wide)은 정한 순서 그대로 (이름이 같은 곳 → 이름에 든 곳)
            .sorted(keepOrder ? (a, b) -> 0 : Comparator.comparingInt((Item p) -> walkMin(p.row(), origin)))
            .map(p -> place(p.id(), p.row(), origin)).toList();
        return new PlaceResult(items, notice);
    }

    private List<Item> dbPlaces(long region, String kind, String keyword) {
        return repository.places(region, kind, keyword).stream().map(p -> new Item(Long.toString(p.id()), p)).toList();
    }

    public List<NearbyPlace> nearby(long userId, MapRequests.NearbySearch request) {
        double lat = request.lat(), lon = request.lon();
        if (!Double.isFinite(lat) || Math.abs(lat) > 90 || !Double.isFinite(lon) || Math.abs(lon) > 180) {
            throw new ApiException(400, "검색 위치를 확인해 주세요.");
        }
        if (!kakao.enabled()) throw new ApiException(503, "장소 검색 서비스가 아직 준비되지 않았어요.");

        var keyword = request.q().strip();
        var kind = KAKAO_CODES.containsKey(keyword) || KAKAO_KEYWORDS.containsKey(keyword) ? keyword : null;
        var center = new MapRepository.Point(lat, lon);
        var cell = Math.round(lat * 100_000) + "," + Math.round(lon * 100_000) + "|nearby";
        try {
            var seen = new HashSet<String>();
            return kakaoPlaces(userId, kind, keyword, center, false, cell).stream()
                .filter(item -> KAKAO_PLACE_ID.matcher(item.id().substring(KAKAO_ID.length())).matches())
                .map(item -> new NearbyPlace(item.id().substring(KAKAO_ID.length()), item.row().name(), item.row().address(),
                    (long) Math.ceil(meters(lat, lon, item.row().lat(), item.row().lon())),
                    item.row().lat(), item.row().lon(), item.row().category()))
                .filter(place -> place.distanceMeters() <= KAKAO_RADIUS)
                .sorted(Comparator.comparingLong(NearbyPlace::distanceMeters))
                .filter(place -> seen.add(place.id()))
                .limit(KakaoLocalClient.SIZE)
                .toList();
        } catch (KakaoQuota.Unavailable unavailable) {
            throw switch (unavailable.code()) {
                case "user-limit" -> new ApiException(429, "장소 검색을 너무 자주 했어요. 1분 뒤 다시 검색해 주세요.");
                case "daily-limit" -> new ApiException(429, "오늘 장소 검색 한도에 도달했어요. 내일 다시 검색해 주세요.");
                default -> new ApiException(503, "카카오맵 장소 검색에 연결하지 못했어요. 잠시 뒤 다시 검색해 주세요.");
            };
        }
    }

    /** 카카오에서 지도 중심 근처 장소를 찾아 그대로 돌려줌 (DB 에 저장하지 않음, 같은 검색은 KakaoQuota 가 10분 캐시)
     * - 종류 칩 · 검색어 칩: 반경 1km 가까운 순
     * - 검색창(wide): 반경 5km 가까운 순 + 거리 제한 없는 정확도 순을 합쳐 이름이 같은 곳 → 이름에 든 곳 → 나머지
     * 한도 초과 · 실패면 KakaoQuota.Unavailable */
    private List<Item> kakaoPlaces(long userId, String kind, String keyword, MapRepository.Point center, boolean wide, String cell) {
        double lat = center.lat(), lon = center.lon();
        var code = kind == null ? null : KAKAO_CODES.get(kind);
        List<KakaoLocalClient.Document> docs;
        if (code != null) {
            docs = quota.call(userId, "category|" + code + "|" + cell, () -> kakao.category(code, lat, lon, KAKAO_RADIUS));
        } else {
            var query = kind != null ? KAKAO_KEYWORDS.getOrDefault(kind, kind) : keyword;
            int radius = kind == null && wide ? KAKAO_KEYWORD_RADIUS : KAKAO_RADIUS;
            docs = quota.call(userId, "keyword|" + radius + "|" + query + "|" + cell, () -> kakao.keyword(query, lat, lon, radius));
        }
        if (kind == null && wide) {
            var nearby = docs;
            var accurate = quota.call(userId, "accuracy|" + keyword + "|" + cell, () -> kakao.keywordByAccuracy(keyword, lat, lon));
            docs = java.util.stream.Stream.concat(nearby.stream(), accurate.stream())
                .filter(distinctById())
                .sorted(Comparator.comparingInt((KakaoLocalClient.Document d) -> rank(d, keyword)))
                .toList();
        }
        var items = new ArrayList<Item>();
        for (var doc : docs) {
            if (doc.id() == null || doc.x() == null || doc.y() == null || doc.place_name() == null || doc.place_name().isBlank()) continue;
            double y, x;
            try { y = Double.parseDouble(doc.y()); x = Double.parseDouble(doc.x()); }
            catch (NumberFormatException error) { continue; }
            if (!Double.isFinite(y) || Math.abs(y) > 90 || !Double.isFinite(x) || Math.abs(x) > 180) continue;
            // 종류 칩이면 그 종류, 검색어면 카카오 분류로 나누고 안 맞으면 '기타'
            var name = kind != null ? kind : Optional.ofNullable(kindOf(doc)).orElse(OTHER);
            var parts = doc.category_name() == null ? new String[0] : doc.category_name().split(">");
            var description = parts.length == 0 ? "" : parts[parts.length - 1].trim();
            var address = doc.road_address_name() == null || doc.road_address_name().isBlank() ? doc.address_name() : doc.road_address_name();
            items.add(new Item(KAKAO_ID + doc.id(), new MapRepository.PlaceRow(0, name, doc.place_name(), description, y, x,
                blankToNull(address), blankToNull(doc.phone()), null, null, 0)));
        }
        return items;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }

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
            .stream().map(found -> Map.<String, Object>of("place", place(Long.toString(found.place().id()), found.place(), home),
                "reasons", found.reasons(), "walkMin", walkMin(found.place(), home))).toList();
    }

    /** 저장한 장소 id. DB 장소는 번호, 카카오 장소는 "kakao:카카오장소id" */
    public List<String> favorites(long userId) {
        var ids = new ArrayList<String>();
        repository.favorites(userId).forEach(id -> ids.add(Long.toString(id)));
        repository.kakaoFavorites(userId).forEach(f -> ids.add(KAKAO_ID + f.kakaoPlaceId()));
        return ids;
    }

    /** 저장한 카카오 장소 (저장 목록에 보일 이름 · 종류). 지도 핀용 좌표는 없음 */
    public List<Map<String, String>> kakaoFavorites(long userId) {
        return repository.kakaoFavorites(userId).stream().map(f -> Map.of(
            "id", KAKAO_ID + f.kakaoPlaceId(), "name", f.name(), "category", f.category())).toList();
    }

    /** 한 사람이 저장할 수 있는 카카오 장소 수 */
    static final int KAKAO_FAVORITE_MAX = 200;
    private static final Pattern KAKAO_PLACE_ID = Pattern.compile("[0-9]{1,50}");

    @Transactional
    public void addFavorite(long userId, String placeId, MapRequests.KakaoFavorite kakaoPlace) {
        if (placeId == null || !placeId.startsWith(KAKAO_ID)) {
            repository.addFavorite(userId, existingPlace(placeId).id());
            return;
        }
        var kakaoPlaceId = kakaoPlaceId(placeId);
        var name = kakaoPlace == null || kakaoPlace.name() == null ? "" : kakaoPlace.name().strip();
        if (name.isEmpty() || name.length() > 60 || CONTROL.matcher(name).find()) throw new ApiException(400, "장소 이름(name)을 확인해 주세요.");
        var category = kakaoPlace.category() == null ? "" : kakaoPlace.category().strip();
        if (repository.categories().stream().noneMatch(c -> c.name().equals(category))) throw new ApiException(400, "장소 종류(category)를 확인해 주세요.");
        boolean saved = repository.kakaoFavorites(userId).stream().anyMatch(f -> f.kakaoPlaceId().equals(kakaoPlaceId));
        if (!saved && repository.kakaoFavoriteCount(userId) >= KAKAO_FAVORITE_MAX) {
            throw new ApiException(400, "카카오 장소는 " + KAKAO_FAVORITE_MAX + "곳까지 저장할 수 있어요.");
        }
        repository.addKakaoFavorite(userId, new MapRepository.KakaoFavorite(kakaoPlaceId, name, category));
    }

    @Transactional
    public void removeFavorite(long userId, String placeId) {
        var key = placeKey(placeId);
        repository.setPlaceListMembership(userId, key, List.of()); // 모든 리스트에서도 뺌
        if (key.startsWith(KAKAO_ID)) repository.removeKakaoFavorite(userId, key.substring(KAKAO_ID.length()));
        else repository.removeFavorite(userId, Long.parseLong(key));
    }

    // ---------- 저장 리스트 (★ 저장 창: 내 장소 · 맛집 …) ----------

    static final String DEFAULT_LIST = "내 장소";
    static final String DEFAULT_COLOR = "#03c75a";
    static final int LIST_MAX = 20;
    private static final Pattern COLOR = Pattern.compile("#[0-9a-fA-F]{6}");

    /** 리스트 목록 + 각 리스트의 장소 키. 리스트가 하나도 없으면 "내 장소"를 만들고, 리스트에 안 든 저장 장소는 첫 리스트에 넣음 */
    @Transactional
    public List<Map<String, Object>> placeLists(long userId) {
        repository.lockUser(userId); // 두 기기가 처음 동시에 열어도 "내 장소"는 하나
        var lists = repository.placeLists(userId);
        var saved = favorites(userId);
        var items = repository.placeListItems(userId);
        var inSomeList = items.stream().map(row -> (String) row[1]).collect(java.util.stream.Collectors.toSet());
        var orphans = saved.stream().filter(key -> !inSomeList.contains(key)).toList();
        if (lists.isEmpty() || !orphans.isEmpty()) {
            long first = lists.isEmpty() ? repository.insertPlaceList(userId, DEFAULT_LIST, DEFAULT_COLOR) : lists.get(0).id();
            for (var key : orphans) repository.addToPlaceList(first, key);
            lists = repository.placeLists(userId);
            items = repository.placeListItems(userId);
        }
        // 저장이 풀린 장소가 리스트에 남아 있으면 보이지 않게 (저장 목록과 맞춤)
        var savedSet = new java.util.HashSet<>(saved);
        var result = new ArrayList<Map<String, Object>>();
        for (var list : lists) {
            var keys = items.stream().filter(row -> (long) row[0] == list.id()).map(row -> (String) row[1]).filter(savedSet::contains).toList();
            result.add(Map.of("id", Long.toString(list.id()), "name", list.name(), "color", list.color(), "placeIds", keys));
        }
        return result;
    }

    @Transactional
    public Map<String, Object> createPlaceList(long userId, MapRequests.PlaceListInput input) {
        var valid = validList(input);
        if (repository.placeLists(userId).size() >= LIST_MAX) throw new ApiException(400, "리스트는 " + LIST_MAX + "개까지 만들 수 있어요.");
        long id;
        try { id = repository.insertPlaceList(userId, valid[0], valid[1]); }
        catch (org.springframework.dao.DuplicateKeyException duplicate) { throw new ApiException(409, "같은 이름의 리스트가 있어요."); }
        return Map.of("id", Long.toString(id), "name", valid[0], "color", valid[1], "placeIds", List.of());
    }

    @Transactional
    public void updatePlaceList(long userId, String listId, MapRequests.PlaceListInput input) {
        var valid = validList(input);
        int updated;
        try { updated = repository.updatePlaceList(userId, listIdOf(listId), valid[0], valid[1]); }
        catch (org.springframework.dao.DuplicateKeyException duplicate) { throw new ApiException(409, "같은 이름의 리스트가 있어요."); }
        if (updated == 0) throw new ApiException(404, "리스트를 찾을 수 없어요.");
    }

    /** 리스트를 지우고, 그 때문에 어느 리스트에도 없게 된 장소는 저장도 풂 */
    @Transactional
    public void deletePlaceList(long userId, String listId) {
        if (repository.deletePlaceList(userId, listIdOf(listId)) == 0) throw new ApiException(404, "리스트를 찾을 수 없어요.");
        var stillListed = repository.placeListItems(userId).stream().map(row -> (String) row[1]).collect(java.util.stream.Collectors.toSet());
        for (var key : favorites(userId)) if (!stillListed.contains(key)) removeFavorite(userId, key);
    }

    /** ★ 저장 창의 [저장]: 이 장소를 고른 리스트들에 넣음. 하나도 안 고르면 저장을 풂. 카카오 장소는 name · category 필요 */
    @Transactional
    public void setPlaceLists(long userId, String placeId, MapRequests.PlaceListsInput input) {
        var key = placeKey(placeId);
        var raw = input == null || input.listIds() == null ? List.<String>of() : input.listIds();
        var mine = repository.placeLists(userId).stream().map(MapRepository.PlaceList::id).collect(java.util.stream.Collectors.toSet());
        var listIds = new java.util.LinkedHashSet<Long>();
        for (var value : raw) {
            long id = listIdOf(value);
            if (!mine.contains(id)) throw new ApiException(404, "리스트를 찾을 수 없어요.");
            listIds.add(id);
        }
        if (listIds.isEmpty()) {
            removeFavorite(userId, key);
            return;
        }
        boolean noMeta = input.name() == null && input.category() == null;
        // 이미 저장한 장소의 리스트만 바꿀 때는 이름 · 종류가 없어도 됨
        if (!(noMeta && favorites(userId).contains(key))) {
            addFavorite(userId, key, noMeta ? null : new MapRequests.KakaoFavorite(input.name(), input.category()));
        }
        repository.setPlaceListMembership(userId, key, List.copyOf(listIds));
    }

    /** [이름, 색] */
    private static String[] validList(MapRequests.PlaceListInput input) {
        var name = input == null || input.name() == null ? "" : input.name().strip();
        if (name.isEmpty() || name.length() > 20 || CONTROL.matcher(name).find()) throw new ApiException(400, "리스트 이름은 20자 이내로 입력해 주세요.");
        var color = input.color() == null || input.color().isBlank() ? DEFAULT_COLOR : input.color().strip();
        if (!COLOR.matcher(color).matches()) throw new ApiException(400, "리스트 색(color)은 #RRGGBB 로 보내 주세요.");
        return new String[] {name, color.toLowerCase(java.util.Locale.ROOT)};
    }

    private static long listIdOf(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,18}")) throw new ApiException(404, "리스트를 찾을 수 없어요.");
        return Long.parseLong(value);
    }

    /** 장소 키: DB 장소 "12", 카카오 장소 "kakao:123" (형식이 틀리면 404) */
    private static String placeKey(String placeId) {
        if (placeId != null && placeId.startsWith(KAKAO_ID)) return KAKAO_ID + kakaoPlaceId(placeId);
        return Long.toString(id(placeId));
    }

    private static String kakaoPlaceId(String placeId) {
        var id = placeId.substring(KAKAO_ID.length());
        if (!KAKAO_PLACE_ID.matcher(id).matches()) throw new ApiException(404, "장소를 찾을 수 없어요.");
        return id;
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

    private long region(String regionId) {
        long id;
        try { id = Long.parseLong(regionId); }
        catch (NumberFormatException | NullPointerException error) { throw new ApiException(400, "동네(regionId)를 확인해 주세요."); }
        if (id <= 0 || !repository.regionExists(id)) throw new ApiException(400, "동네(regionId)를 확인해 주세요.");
        return id;
    }

    private static long id(String placeId) {
        if (placeId != null && placeId.startsWith(KAKAO_ID)) {
            throw new ApiException(400, "카카오 검색 장소는 여기서 쓸 수 없어요.");
        }
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
        return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    }

    private static Map<String, Object> place(String id, MapRepository.PlaceRow p, Optional<MapRepository.Point> home) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", id);
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

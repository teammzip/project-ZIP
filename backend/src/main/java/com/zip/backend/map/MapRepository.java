package com.zip.backend.map;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MapRepository {
    private final JdbcTemplate jdbc;

    public MapRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Category(long id, String name, String icon) {}

    public record PlaceRow(long id, String category, String name, String description, double lat, double lon,
        String address, String phone, String openHours, Double rating, int reviewCount) {}

    public record Point(double lat, double lon) {}

    public record ReviewRow(long id, int rating, String body, long authorId, String authorNickname, Instant createdAt) {}

    private static final String PLACE_SQL = """
        SELECT p.*, c.name AS category_name FROM places p
        JOIN place_categories c ON c.id = p.category_id
        """;

    private static PlaceRow place(ResultSet rs, int row) throws SQLException {
        BigDecimal rating = rs.getBigDecimal("rating_avg");
        return new PlaceRow(rs.getLong("id"), rs.getString("category_name"), rs.getString("name"),
            rs.getString("description"), rs.getDouble("lat"), rs.getDouble("lon"), rs.getString("address"),
            rs.getString("phone"), rs.getString("open_hours"), rating == null ? null : rating.doubleValue(),
            rs.getInt("review_count"));
    }

    public List<Category> categories() {
        return jdbc.query("SELECT id, name, icon FROM place_categories ORDER BY sort_order, id",
            (rs, row) -> new Category(rs.getLong("id"), rs.getString("name"), rs.getString("icon")));
    }

    /** 동네 장소. category 는 종류 이름, keyword 는 이름 · 설명 · 종류에 들어간 글자 */
    public List<PlaceRow> places(long regionId, String category, String keyword) {
        var sql = new StringBuilder(PLACE_SQL).append(" WHERE p.region_id = ?");
        var args = new ArrayList<Object>(List.of(regionId));
        if (category != null) {
            sql.append(" AND c.name = ?");
            args.add(category);
        }
        if (keyword != null) {
            sql.append(" AND (p.name LIKE ? ESCAPE '!' OR p.description LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!')");
            var like = "%" + keyword.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
            args.addAll(List.of(like, like, like));
        }
        return jdbc.query(sql.append(" ORDER BY p.id").toString(), MapRepository::place, args.toArray());
    }

    public Optional<PlaceRow> findPlace(long placeId) {
        return jdbc.query(PLACE_SQL + " WHERE p.id = ?", MapRepository::place, placeId).stream().findFirst();
    }

    /** 순서를 지켜 여러 장소 (카카오 결과 순서 = 가까운 순) */
    public List<PlaceRow> placesByIds(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        var byId = new java.util.HashMap<Long, PlaceRow>();
        jdbc.query(PLACE_SQL + " WHERE p.id IN (" + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")",
            MapRepository::place, ids.toArray()).forEach(p -> byId.put(p.id(), p));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    public Optional<Long> categoryId(String name) {
        return jdbc.queryForList("SELECT id FROM place_categories WHERE name = ?", Long.class, name).stream().findFirst();
    }

    /** 카카오 장소를 저장하거나 최신 정보로 갱신 (같은 카카오 id 면 한 줄, uk_places_source_source_id). 장소 번호를 돌려줌 */
    public long upsertKakao(long regionId, long categoryId, KakaoLocalClient.Document doc, String description) {
        var address = doc.road_address_name() == null || doc.road_address_name().isBlank() ? doc.address_name() : doc.road_address_name();
        jdbc.update("""
            INSERT INTO places (region_id, category_id, name, description, lat, lon, address, phone, source, source_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KAKAO', ?) AS n
            ON DUPLICATE KEY UPDATE name = n.name, description = n.description, lat = n.lat, lon = n.lon,
            address = n.address, phone = n.phone
            """, regionId, categoryId, cut(doc.place_name(), 60), cut(description, 100), Double.parseDouble(doc.y()),
            Double.parseDouble(doc.x()), cut(blankToNull(address), 200), cut(blankToNull(doc.phone()), 20), cut(doc.id(), 50));
        return jdbc.queryForObject("SELECT id FROM places WHERE source = 'KAKAO' AND source_id = ?", Long.class, cut(doc.id(), 50));
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }

    private static String cut(String value, int max) { return value == null || value.length() <= max ? value : value.substring(0, max); }

    public boolean regionExists(long regionId) {
        return !jdbc.queryForList("SELECT id FROM regions WHERE id = ?", Long.class, regionId).isEmpty();
    }

    /** 우리 집 좌표 (users.home_lat · home_lon). 아직 없으면 비어 있음 */
    public Optional<Point> home(long userId) {
        return jdbc.query("SELECT home_lat, home_lon FROM users WHERE id = ? AND home_lat IS NOT NULL",
            (rs, row) -> new Point(rs.getDouble("home_lat"), rs.getDouble("home_lon")), userId).stream().findFirst();
    }

    public List<Long> favorites(long userId) {
        return jdbc.queryForList("SELECT place_id FROM place_favorites WHERE user_id = ? ORDER BY created_at, place_id",
            Long.class, userId);
    }

    public void addFavorite(long userId, long placeId) {
        jdbc.update("INSERT IGNORE INTO place_favorites (user_id, place_id) VALUES (?, ?)", userId, placeId);
    }

    public void removeFavorite(long userId, long placeId) {
        jdbc.update("DELETE FROM place_favorites WHERE user_id = ? AND place_id = ?", userId, placeId);
    }

    /** user_settings.map_categories · map_keywords 를 순서대로 (줄이 없거나 NULL 이면 비어 있음) */
    public Optional<List<String>> mapList(long userId, String column) {
        if (!column.equals("map_categories") && !column.equals("map_keywords")) throw new IllegalArgumentException(column);
        var isNull = jdbc.queryForList("SELECT " + column + " IS NULL FROM user_settings WHERE user_id = ?",
            Boolean.class, userId);
        if (isNull.isEmpty() || isNull.get(0)) return Optional.empty();
        return Optional.of(jdbc.queryForList("""
            SELECT jt.v FROM user_settings s,
            JSON_TABLE(s.%s, '$[*]' COLUMNS (i FOR ORDINALITY, v VARCHAR(50) PATH '$')) jt
            WHERE s.user_id = ? ORDER BY jt.i
            """.formatted(column), String.class, userId));
    }

    public void saveMapSettings(long userId, List<String> categories, List<String> keywords) {
        jdbc.update("""
            INSERT INTO user_settings (user_id, map_categories, map_keywords)
            VALUES (?, CAST(? AS JSON), CAST(? AS JSON)) AS n
            ON DUPLICATE KEY UPDATE map_categories = n.map_categories, map_keywords = n.map_keywords
            """, userId, jsonArray(categories), jsonArray(keywords));
    }

    private static String jsonArray(List<String> items) {
        // 값은 MapService 에서 제어 문자를 막은 뒤라 따옴표 · 역슬래시만 이스케이프하면 돼요.
        return items.stream().map(s -> "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
            .reduce((a, b) -> a + "," + b).map(s -> "[" + s + "]").orElse("[]");
    }

    public List<ReviewRow> reviews(long placeId) {
        return jdbc.query("""
            SELECT r.id, r.rating, r.body, r.created_at, u.id AS author_id, u.nickname FROM place_reviews r
            JOIN users u ON u.id = r.user_id WHERE r.place_id = ? ORDER BY r.created_at DESC, r.id DESC
            """, (rs, row) -> new ReviewRow(rs.getLong("id"), rs.getInt("rating"), rs.getString("body"),
                rs.getLong("author_id"), rs.getString("nickname"), rs.getTimestamp("created_at").toInstant()), placeId);
    }

    /** 한 사람당 한 장소에 하나 (uk_place_reviews_place_id_user_id). 이미 있으면 false */
    public boolean addReview(long placeId, long userId, int rating, String body) {
        try {
            jdbc.update("INSERT INTO place_reviews (place_id, user_id, rating, body) VALUES (?, ?, ?, ?)",
                placeId, userId, rating, body);
        } catch (DuplicateKeyException duplicate) {
            return false;
        }
        jdbc.update("""
            UPDATE places SET
            rating_avg = (SELECT ROUND(AVG(rating), 1) FROM place_reviews WHERE place_id = ?),
            review_count = (SELECT COUNT(*) FROM place_reviews WHERE place_id = ?)
            WHERE id = ?
            """, placeId, placeId, placeId);
        return true;
    }
}

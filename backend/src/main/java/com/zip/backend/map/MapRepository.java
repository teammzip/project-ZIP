package com.zip.backend.map;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
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

    /** 같은 회원의 요청을 한 줄로 (트랜잭션 맨 처음에) */
    public void lockUser(long userId) {
        jdbc.queryForList(com.zip.backend.common.Sql.LOCK_USER, Long.class, userId);
    }

    public record Category(long id, String name, String icon) {}

    public record PlaceRow(long id, String category, String name, String description, double lat, double lon,
        String address, String phone, String openHours, Double rating, int reviewCount) {}

    public record Point(double lat, double lon) {}

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
            var like = com.zip.backend.common.Sql.likeContains(keyword);
            args.addAll(List.of(like, like, like));
        }
        return jdbc.query(sql.append(" ORDER BY p.id").toString(), MapRepository::place, args.toArray());
    }

    public Optional<PlaceRow> findPlace(long placeId) {
        return jdbc.query(PLACE_SQL + " WHERE p.id = ?", MapRepository::place, placeId).stream().findFirst();
    }

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

    /** 카카오 장소 즐겨찾기 한 곳 (카카오 장소 id · 표시용 이름 · 우리 종류 이름. 주소 · 좌표는 저장하지 않음) */
    public record KakaoFavorite(String kakaoPlaceId, String name, String category) {}

    public List<KakaoFavorite> kakaoFavorites(long userId) {
        return jdbc.query("SELECT kakao_place_id, name, category FROM kakao_place_favorites WHERE user_id = ? ORDER BY created_at, kakao_place_id",
            (rs, row) -> new KakaoFavorite(rs.getString("kakao_place_id"), rs.getString("name"), rs.getString("category")), userId);
    }

    public int kakaoFavoriteCount(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM kakao_place_favorites WHERE user_id = ?", Integer.class, userId);
    }

    /** 이미 저장한 곳이면 이름 · 종류만 최신으로 */
    public void addKakaoFavorite(long userId, KakaoFavorite favorite) {
        int updated = jdbc.update("UPDATE kakao_place_favorites SET name = ?, category = ? WHERE user_id = ? AND kakao_place_id = ?",
            favorite.name(), favorite.category(), userId, favorite.kakaoPlaceId());
        if (updated == 0) {
            jdbc.update("INSERT INTO kakao_place_favorites (user_id, kakao_place_id, name, category) VALUES (?, ?, ?, ?)",
                userId, favorite.kakaoPlaceId(), favorite.name(), favorite.category());
        }
    }

    public void removeKakaoFavorite(long userId, String kakaoPlaceId) {
        jdbc.update("DELETE FROM kakao_place_favorites WHERE user_id = ? AND kakao_place_id = ?", userId, kakaoPlaceId);
    }

    // ---------- 저장 리스트 (place_lists · place_list_items) ----------

    public record PlaceList(long id, String name, String color) {}

    public List<PlaceList> placeLists(long userId) {
        return jdbc.query("SELECT id, name, color FROM place_lists WHERE user_id = ? ORDER BY sort_order, id",
            (rs, row) -> new PlaceList(rs.getLong("id"), rs.getString("name"), rs.getString("color")), userId);
    }

    /** 회원의 모든 리스트 줄: [리스트 id, 장소 키] (넣은 순서) */
    public List<Object[]> placeListItems(long userId) {
        return jdbc.query("""
            SELECT i.list_id, i.place_key FROM place_list_items i JOIN place_lists l ON l.id = i.list_id
            WHERE l.user_id = ? ORDER BY i.created_at, i.place_key
            """, (rs, row) -> new Object[] {rs.getLong(1), rs.getString(2)}, userId);
    }

    public long insertPlaceList(long userId, String name, String color) {
        int next = jdbc.queryForObject("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM place_lists WHERE user_id = ?", Integer.class, userId);
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO place_lists (user_id, name, color, sort_order) VALUES (?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, userId); ps.setString(2, name); ps.setString(3, color); ps.setInt(4, next);
            return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public int updatePlaceList(long userId, long listId, String name, String color) {
        return jdbc.update("UPDATE place_lists SET name = ?, color = ? WHERE id = ? AND user_id = ?", name, color, listId, userId);
    }

    public int deletePlaceList(long userId, long listId) {
        return jdbc.update("DELETE FROM place_lists WHERE id = ? AND user_id = ?", listId, userId);
    }

    /** 이 장소가 들어 있는 리스트를 listIds 로 바꿈 (회원의 리스트만) */
    public void setPlaceListMembership(long userId, String placeKey, List<Long> listIds) {
        jdbc.update("DELETE FROM place_list_items WHERE place_key = ? AND list_id IN (SELECT id FROM place_lists WHERE user_id = ?)", placeKey, userId);
        for (long listId : listIds) jdbc.update("INSERT INTO place_list_items (list_id, place_key) VALUES (?, ?)", listId, placeKey);
    }

    /** 이 장소를 리스트 하나에 더함 (이미 있으면 그대로) */
    public void addToPlaceList(long listId, String placeKey) {
        try {
            jdbc.update("INSERT INTO place_list_items (list_id, place_key) VALUES (?, ?)", listId, placeKey);
        } catch (DuplicateKeyException alreadyIn) {
            // 그대로
        }
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
}

package com.zip.backend.settings;

import java.math.BigDecimal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SettingsRepository {
    private final JdbcTemplate jdbc;
    public SettingsRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Location(String name, String source, BigDecimal lat, BigDecimal lon) {}
    public record Settings(BigDecimal rent, int day, String moveIn, String end, boolean on,
        String home, String regionId, Location location) {}

    public Settings read(long userId) {
        return jdbc.query("""
            SELECT u.region_id, s.* FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ?
            """, (rs, row) -> new Settings(
                rs.getBigDecimal("rent_amount") == null ? BigDecimal.ZERO : rs.getBigDecimal("rent_amount"),
                rs.getObject("rent_day") == null ? 15 : rs.getInt("rent_day"),
                value(rs.getString("move_in_ym")), value(rs.getString("contract_end_ym")),
                rs.getObject("noti_on") == null || rs.getBoolean("noti_on"), value(rs.getString("home_address")),
                rs.getString("region_id"), rs.getString("region_source") == null ? null :
                    new Location(rs.getString("region_name"), rs.getString("region_source"), rs.getBigDecimal("region_lat"), rs.getBigDecimal("region_lon"))), userId)
            .stream().findFirst().orElseThrow(() -> new com.zip.backend.common.ApiException(401, "로그인 정보가 없어요."));
    }

    private static String value(String input) { return input == null ? "" : input; }

    public record Region(String name, String fullName, String shortName) {}
    public Region region(String id) {
        return jdbc.query("""
            SELECT r.name, parent.name AS parent_name FROM regions r
            LEFT JOIN regions parent ON parent.id = r.parent_id WHERE r.id = ?
            """, (rs, row) -> {
                String name = rs.getString("name"), parent = rs.getString("parent_name");
                String full = parent == null ? name : parent + " " + name;
                String shortName = parent == null ? name : parent.replace("특별자치시", "").replace("특별시", "").replace("광역시", "") + " " + name;
                return new Region(name, full, shortName);
            }, Long.parseLong(id)).stream().findFirst().orElseThrow(() -> SettingsInput.bad("존재하지 않는 동네 ID예요."));
    }

    public void save(long userId, Settings settings, boolean resetVerification) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM user_settings WHERE user_id = ?", Long.class, userId) == 0) {
            jdbc.update("INSERT INTO user_settings (user_id) VALUES (?)", userId);
        }
        Location location = settings.location();
        jdbc.update("""
            UPDATE user_settings SET rent_amount = ?, rent_day = ?, move_in_ym = ?, contract_end_ym = ?, noti_on = ?,
            home_address = ?, region_name = ?, region_source = ?, region_lat = ?, region_lon = ? WHERE user_id = ?
            """, settings.rent(), settings.day(), emptyToNull(settings.moveIn()), emptyToNull(settings.end()), settings.on(),
            emptyToNull(settings.home()), location == null ? null : location.name(), location == null ? null : location.source(),
            location == null ? null : location.lat(), location == null ? null : location.lon(), userId);
        jdbc.update("UPDATE users SET region_id = ?" + (resetVerification ? ", region_verified_at = NULL" : "") + " WHERE id = ?",
            settings.regionId(), userId);
    }

    private static String emptyToNull(String value) { return value.isEmpty() ? null : value; }
}

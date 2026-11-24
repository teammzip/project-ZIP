package com.zip.backend.region;

import com.zip.backend.common.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 동네(행정구역) 목록 · 주변 동네 (frontend/API.md 2장 · openapi.yaml "설정 · 동네"). 로그인 없이 볼 수 있는 공개 정보.
 * 데이터는 db/migrations/20261122_01_regions_nationwide.sql(전국 시 · 도 16 · 시 · 군 · 구 233)과
 * 20261122_04_region_neighbors_nationwide.sql(육지 경계가 맞닿은 시 · 군 · 구) — 둘 다 frontend 의 regions.ts 를 기준으로 스크립트가 만듦.
 */
@RestController
public class RegionController {
    private final JdbcTemplate jdbc;

    public RegionController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** 전체 동네: 시 · 도(level 1, parentId null) 다음에 시 · 군 · 구(level 2). [{ id, name, parentId, level }] */
    @GetMapping("/api/regions")
    public List<Map<String, Object>> regions() {
        return jdbc.query("SELECT id, name, parent_id, level FROM regions ORDER BY level, parent_id, id", (rs, row) -> {
            var region = new LinkedHashMap<String, Object>(); // parentId 가 null 일 수 있어서 Map.of 대신
            region.put("id", Long.toString(rs.getLong("id")));
            region.put("name", rs.getString("name"));
            long parent = rs.getLong("parent_id");
            region.put("parentId", rs.wasNull() ? null : Long.toString(parent));
            region.put("level", rs.getInt("level"));
            return region;
        });
    }

    /** 주변 동네(region_neighbors) [{ id, name }]. 커뮤니티 "주변 동네" 탭과 같은 관계. 없는 동네 번호면 404 */
    @GetMapping("/api/regions/{id}/neighbors")
    public List<Map<String, Object>> neighbors(@PathVariable String id) {
        long regionId;
        try { regionId = Long.parseLong(id); } catch (NumberFormatException wrong) { throw new ApiException(404, "동네를 찾을 수 없어요."); }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM regions WHERE id = ?", Integer.class, regionId) == 0) {
            throw new ApiException(404, "동네를 찾을 수 없어요.");
        }
        return jdbc.query("""
            SELECT n.id, n.name FROM region_neighbors x JOIN regions n ON n.id = x.neighbor_region_id
            WHERE x.region_id = ? ORDER BY n.parent_id, n.name""",
            (rs, row) -> Map.<String, Object>of("id", Long.toString(rs.getLong(1)), "name", rs.getString(2)), regionId);
    }
}

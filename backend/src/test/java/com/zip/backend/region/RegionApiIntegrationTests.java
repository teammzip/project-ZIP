package com.zip.backend.region;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

/** 동네 목록 · 주변 동네 API (로그인 없이): 시 · 도 먼저, 주변 동네는 region_neighbors 그대로, 없는 번호는 404 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql("/auth-fixture.sql")
class RegionApiIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test void listsRegionsWithoutLoginProvincesFirst() throws Exception {
        // auth-fixture: 1 = 서울특별시(level 1), 2 = 마포구, 3 = 용산구
        mvc.perform(get("/api/regions")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].id").value("1")).andExpect(jsonPath("$[0].level").value(1)).andExpect(jsonPath("$[0].parentId").isEmpty())
            .andExpect(jsonPath("$[1].name").value("마포구")).andExpect(jsonPath("$[1].parentId").value("1")).andExpect(jsonPath("$[1].level").value(2));
    }

    @Test void neighborsOfARegion() throws Exception {
        jdbc.update("INSERT INTO region_neighbors VALUES (2, 3), (3, 2)");
        mvc.perform(get("/api/regions/2/neighbors")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value("3")).andExpect(jsonPath("$[0].name").value("용산구"));
        mvc.perform(get("/api/regions/1/neighbors")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/regions/999/neighbors")).andExpect(status().isNotFound());
        mvc.perform(get("/api/regions/abc/neighbors")).andExpect(status().isNotFound());
    }
}

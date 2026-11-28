package com.zip.backend.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@Tag("mysql")
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MySqlIntegrationTests {
    private static final String FRESH = "zip_fresh";
    private static final String LEGACY = "zip_legacy";
    private static final String INCOMPLETE = "zip_incomplete";
    private static final List<String> BASELINE_SCRIPTS = List.of("V1__schema.sql", "V2__nationwide_regions.sql",
        "V3__nationwide_trash_schedules.sql", "V4__nationwide_region_neighbors.sql");

    @Container
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0.46")
        .withDatabaseName(FRESH)
        .withUsername("root")
        .withPassword(UUID.randomUUID().toString())
        .withUrlParam("allowPublicKeyRetrieval", "true")
        .withUrlParam("sslMode", "DISABLED");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) throws SQLException {
        // Migrate the empty container database before the application connects to it.
        runMigration("migrate", FRESH);
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;

    @Test
    void freshDatabaseInstallsSchemaAndDataAndCanMigrateAgain() throws SQLException {
        List<String> installed = history(jdbc);
        assertThat(installed).startsWith("1:SQL", "2:SQL", "3:SQL", "4:SQL");
        assertReferenceData(jdbc);

        runMigration("migrate", FRESH);

        assertThat(history(jdbc)).isEqualTo(installed);
        assertReferenceData(jdbc);
    }

    @Test
    void baselineKeepsExistingRowsAndAppliesOnlyLaterVersions() throws SQLException {
        JdbcTemplate legacy = createDatabase(LEGACY);
        loadLegacyScripts(LEGACY, BASELINE_SCRIPTS);
        legacy.update("INSERT INTO users (id, login_id, password_hash, nickname) VALUES (500, 'legacy500', ?, '기존 회원')",
            passwords.encode(UUID.randomUUID().toString()));
        legacy.update("INSERT INTO memo_folders (id, user_id, name) VALUES (600, 500, '기존 폴더')");
        legacy.update("INSERT INTO memos (id, user_id, folder_id, body) VALUES (700, 500, 600, '이전 메모')");

        assertThat(historyTableCount(legacy)).isZero();
        runMigration("baseline", LEGACY);
        assertThat(history(legacy)).containsExactly("4:BASELINE");

        runMigration("migrate", LEGACY);
        List<String> freshHistory = history(jdbc);
        List<String> laterMigrations = freshHistory.subList(BASELINE_SCRIPTS.size(), freshHistory.size());
        List<String> legacyHistory = history(legacy);
        assertThat(legacyHistory).startsWith("4:BASELINE");
        assertThat(legacyHistory.subList(1, legacyHistory.size())).containsExactlyElementsOf(laterMigrations);
        assertThat(legacy.queryForObject("""
            SELECT CONCAT(u.nickname, '/', f.name, '/', m.body)
            FROM memos m JOIN memo_folders f ON f.id = m.folder_id JOIN users u ON u.id = m.user_id
            WHERE m.id = 700 AND f.id = 600 AND u.id = 500
            """, String.class)).isEqualTo("기존 회원/기존 폴더/이전 메모");
        assertReferenceData(legacy);
    }

    @Test
    void rejectsIncompleteLegacyDatabaseWithoutRecordingHistory() throws SQLException {
        JdbcTemplate incomplete = createDatabase(INCOMPLETE);
        loadLegacyScripts(INCOMPLETE, BASELINE_SCRIPTS.subList(0, 1));

        assertThatThrownBy(() -> runMigration("baseline", INCOMPLETE))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("nationwide reference data");
        assertThatThrownBy(() -> runMigration("migrate", INCOMPLETE))
            .isInstanceOf(FlywayException.class).hasMessageContaining("baseline");
        assertThat(historyTableCount(incomplete)).isZero();
    }

    @Test
    void memoFoldersEnforceOwnershipAndUniqueNamesAndKeepMemosAfterDeletion() throws Exception {
        String owner = login("mysqlowner");
        String other = login("mysqlother");

        String folder = id(call(owner, post("/api/memo-folders"), """
            {"name":"생활"}
            """).andExpect(status().isCreated()));
        call(owner, post("/api/memo-folders"), """
            {"name":" 생활 "}
            """).andExpect(status().isConflict());
        call(other, get("/api/memo-folders"), null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        call(other, patch("/api/memo-folders/{id}", folder), """
            {"name":"다른 회원"}
            """).andExpect(status().isNotFound());
        call(other, delete("/api/memo-folders/{id}", folder), null).andExpect(status().isNotFound());
        call(other, post("/api/memo-folders"), """
            {"name":"생활"}
            """).andExpect(status().isCreated());

        String anotherFolder = id(call(owner, post("/api/memo-folders"), """
            {"name":"서류"}
            """).andExpect(status().isCreated()));
        call(owner, patch("/api/memo-folders/{id}", anotherFolder), """
            {"name":"생활"}
            """).andExpect(status().isConflict());
        call(owner, patch("/api/memo-folders/{id}", folder), """
            {"name":"집 관리"}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("집 관리"));
        call(owner, get("/api/memo-folders"), null).andExpect(status().isOk())
            .andExpect(content().json("""
                [{"id":"%s","name":"집 관리"},{"id":"%s","name":"서류"}]
                """.formatted(folder, anotherFolder), JsonCompareMode.LENIENT));

        String memo = id(call(owner, post("/api/memos"), """
            {"body":"관리비 확인","folderId":"%s"}
            """.formatted(folder)).andExpect(status().isCreated()).andExpect(jsonPath("$.folderId").value(folder)));
        call(owner, delete("/api/memo-folders/{id}", folder), null).andExpect(status().isNoContent());
        call(owner, get("/api/memo-folders"), null).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(anotherFolder));
        call(owner, get("/api/memos"), null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(memo)).andExpect(jsonPath("$[0].folderId").isEmpty())
            .andExpect(jsonPath("$[0].body").value("관리비 확인"));
        assertThat(jdbc.queryForObject("SELECT folder_id FROM memos WHERE id = ?", Long.class, Long.parseLong(memo))).isNull();
    }

    private static JdbcTemplate createDatabase(String database) {
        new JdbcTemplate(dataSource(FRESH)).execute("CREATE DATABASE " + database + " CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        return new JdbcTemplate(dataSource(database));
    }

    private static void loadLegacyScripts(String database, List<String> scripts) {
        // A pre-Flyway backup at the cutoff has the same schema and reference data, without Flyway history.
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.setSqlScriptEncoding("UTF-8");
        scripts.forEach(script -> populator.addScript(new ClassPathResource("db/migration/" + script)));
        populator.execute(dataSource(database));
    }

    private static DriverManagerDataSource dataSource(String database) {
        return new DriverManagerDataSource(url(database), MYSQL.getUsername(), MYSQL.getPassword());
    }

    private static String url(String database) {
        return MYSQL.getJdbcUrl().replace("/" + FRESH, "/" + database);
    }

    private static void runMigration(String command, String database) throws SQLException {
        DatabaseMigration.run(command, url(database), MYSQL.getUsername(), MYSQL.getPassword());
    }

    private static List<String> history(JdbcTemplate database) {
        assertThat(database.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE NOT success", Integer.class)).isZero();
        return database.queryForList("SELECT CONCAT(version, ':', type) FROM flyway_schema_history ORDER BY installed_rank", String.class);
    }

    private static int historyTableCount(JdbcTemplate database) {
        return database.queryForObject("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = 'flyway_schema_history'
            """, Integer.class);
    }

    private static void assertReferenceData(JdbcTemplate database) {
        assertThat(database.queryForObject("SELECT COUNT(*) FROM regions", Integer.class)).isEqualTo(249);
        assertThat(database.queryForObject("SELECT COUNT(*) FROM trash_schedules", Integer.class)).isEqualTo(6218);
        assertThat(database.queryForObject("SELECT COUNT(*) FROM region_neighbors", Integer.class)).isEqualTo(1286);
    }

    private String login(String loginId) throws Exception {
        String password = UUID.randomUUID().toString().substring(0, 16);
        jdbc.update("INSERT INTO users (login_id, password_hash, nickname) VALUES (?, ?, ?)", loginId, passwords.encode(password), loginId);
        var response = call(null, post("/api/auth/login"), """
            {"loginId":"%s","password":"%s"}
            """.formatted(loginId, password)).andExpect(status().isOk()).andReturn().getResponse();
        return JsonPath.read(response.getContentAsString(), "$.accessToken");
    }

    private ResultActions call(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(body == null ? request : request.contentType("application/json").content(body));
    }

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }
}

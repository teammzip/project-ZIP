package com.zip.backend.tools;

import java.sql.SQLException;
import org.flywaydb.core.Flyway;

/** Run schema changes as a deployment step with a dedicated MySQL account. */
public final class DatabaseMigration {
    private static final String BASELINE = "4";

    private DatabaseMigration() {}

    public static void main(String[] args) throws SQLException {
        var url = required("ZIP_MIGRATION_DB_URL");
        if (!url.startsWith("jdbc:mysql://")) {
            throw new IllegalArgumentException("ZIP_MIGRATION_DB_URL must be a MySQL JDBC URL.");
        }
        var flyway = Flyway.configure()
            .dataSource(url, required("ZIP_MIGRATION_DB_USER"), required("ZIP_MIGRATION_DB_PASSWORD"))
            .locations("classpath:db/migration")
            .failOnMissingLocations(true)
            .validateMigrationNaming(true)
            .placeholderReplacement(false)
            .createSchemas(false)
            .cleanDisabled(true)
            .baselineOnMigrate(false)
            .baselineVersion(BASELINE)
            .baselineDescription("ZIP schema and reference data through 2026-11-27")
            .load();

        switch (args.length == 1 ? args[0] : "") {
            case "info" -> {
                for (var migration : flyway.info().all()) {
                    System.out.printf("%s  %s  %s%n", migration.getVersion(), migration.getState(), migration.getDescription());
                }
            }
            case "baseline" -> {
                verifyLegacyDatabase(flyway);
                flyway.baseline();
            }
            case "migrate" -> flyway.migrate();
            default -> throw new IllegalArgumentException("Use info, baseline, or migrate.");
        }
    }

    private static void verifyLegacyDatabase(Flyway flyway) throws SQLException {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection();
             var statement = connection.createStatement()) {
            try (var schema = statement.executeQuery("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name IN
                  ('memo_folders', 'events', 'region_neighbors', 'trash_schedules', 'terms_documents')
                """)) {
                if (!schema.next() || schema.getInt(1) != 5) {
                    throw new IllegalStateException("Baseline requires the current legacy ZIP schema. Run migrate for an empty database.");
                }
            }
            try (var data = statement.executeQuery("""
                SELECT (SELECT COUNT(*) FROM regions) >= 249
                    AND (SELECT COUNT(*) FROM trash_schedules) = 6218
                    AND (SELECT COUNT(*) FROM region_neighbors) = 1286
                    AND EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = DATABASE() AND table_name = 'memos' AND column_name = 'folder_id')
                    AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
                        AND table_name = 'events' AND column_name IN ('is_anniversary', 'repeat_yearly')) = 2
                """)) {
                if (!data.next() || !data.getBoolean(1)) {
                    throw new IllegalStateException("Baseline requires the final legacy migrations and nationwide reference data.");
                }
            }
        }
    }

    private static String required(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Set " + name + " for the migration database.");
        return value;
    }
}

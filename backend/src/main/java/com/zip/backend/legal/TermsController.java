package com.zip.backend.legal;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TermsController {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public TermsController(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }

    public record Terms(String docType, String version, String title, String content, String consentKind, boolean required) {}

    @GetMapping("/api/terms")
    public List<Terms> current() {
        var now = Timestamp.from(clock.instant());
        return jdbc.query("""
            SELECT t.* FROM terms_documents t WHERE t.effective_at <= ?
            AND NOT EXISTS (SELECT 1 FROM terms_documents newer WHERE newer.doc_type = t.doc_type
                AND newer.effective_at <= ? AND (newer.effective_at > t.effective_at
                    OR (newer.effective_at = t.effective_at AND newer.id > t.id)))
            ORDER BY CASE t.doc_type WHEN 'SERVICE' THEN 1 WHEN 'PRIVACY' THEN 2 ELSE 3 END
            """, (rs, row) -> new Terms(rs.getString("doc_type"), rs.getString("version"),
            rs.getString("title"), rs.getString("content"), rs.getString("consent_kind"),
            rs.getBoolean("is_required")), now, now);
    }
}

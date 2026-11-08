package com.zip.backend.bills;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class BillRepository {
    private final JdbcTemplate jdbc;
    public BillRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Item(long id, String name, long defaultAmount, String tag, boolean active, Instant createdAt) {}
    public record Payment(long amount, Instant paidAt) {}
    public record Row(Item item, Payment payment) {}

    private Item item(ResultSet rs) throws SQLException {
        return new Item(rs.getLong("id"), rs.getString("name"), rs.getLong("default_amount"),
            rs.getString("tag"), rs.getBoolean("is_active"), rs.getTimestamp("created_at").toInstant());
    }

    private Payment payment(ResultSet rs) throws SQLException {
        if (rs.getObject("payment_id") == null) return null;
        var paidAt = rs.getTimestamp("paid_at");
        return new Payment(rs.getLong("amount"), paidAt == null ? null : paidAt.toInstant());
    }

    public List<Row> list(long userId, YearMonth month) {
        return jdbc.query("""
            SELECT b.*, p.id AS payment_id, p.amount, p.paid_at FROM bill_items b
            LEFT JOIN bill_payments p ON p.bill_item_id = b.id AND p.period_ym = ?
            WHERE b.user_id = ? ORDER BY b.id
            """, (rs, row) -> new Row(item(rs), payment(rs)), month.toString(), userId);
    }

    public Item find(long userId, long id) {
        return jdbc.query("SELECT * FROM bill_items WHERE id = ? AND user_id = ?", (rs, row) -> item(rs), id, userId)
            .stream().findFirst().orElseThrow(() -> new com.zip.backend.common.ApiException(404, "고정 지출 항목이 없어요."));
    }

    public Payment payment(long id, YearMonth month) {
        return jdbc.query("SELECT id AS payment_id, amount, paid_at FROM bill_payments WHERE bill_item_id = ? AND period_ym = ?",
            (rs, row) -> payment(rs), id, month.toString()).stream().findFirst().orElse(null);
    }

    public boolean duplicate(long userId, String name, String tag, long excludingId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM bill_items WHERE user_id = ? AND name = ? AND tag = ? AND is_active = 1 AND id <> ?",
            Long.class, userId, name, tag, excludingId) > 0;
    }

    public long create(long userId, String name, long amount, String tag, Instant now) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var ps = connection.prepareStatement("INSERT INTO bill_items (user_id, name, default_amount, tag, created_at) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setLong(1, userId); ps.setString(2, name); ps.setLong(3, amount); ps.setString(4, tag);
            ps.setTimestamp(5, Timestamp.from(now)); return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void update(long userId, long id, String name, long amount, String tag) {
        jdbc.update("UPDATE bill_items SET name = ?, default_amount = ?, tag = ? WHERE id = ? AND user_id = ?", name, amount, tag, id, userId);
    }

    public void insertPayment(long id, YearMonth month, long amount, Instant paidAt) {
        jdbc.update("INSERT INTO bill_payments (bill_item_id, period_ym, amount, paid_at) VALUES (?, ?, ?, ?)",
            id, month.toString(), amount, paidAt == null ? null : Timestamp.from(paidAt));
    }

    public void updatePayment(long id, YearMonth month, long amount, Instant paidAt) {
        jdbc.update("UPDATE bill_payments SET amount = ?, paid_at = ? WHERE bill_item_id = ? AND period_ym = ?",
            amount, paidAt == null ? null : Timestamp.from(paidAt), id, month.toString());
    }

    public void deactivate(long userId, long id) {
        jdbc.update("UPDATE bill_items SET is_active = 0 WHERE id = ? AND user_id = ?", id, userId);
    }
}

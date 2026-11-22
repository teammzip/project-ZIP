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
    private final com.zip.backend.memo.LedgerMemoWriter memos;
    public BillRepository(JdbcTemplate jdbc) { this(jdbc,new com.zip.backend.memo.LedgerMemoWriter(jdbc,java.time.Clock.systemUTC())); }
    @org.springframework.beans.factory.annotation.Autowired
    public BillRepository(JdbcTemplate jdbc,com.zip.backend.memo.LedgerMemoWriter memos) { this.jdbc = jdbc; this.memos=memos; }

    public record Item(long id, String name, long defaultAmount, String tag, boolean active, Instant createdAt, String homeContractKind, java.time.LocalDate terminationDate) {
        public Item(long id,String name,long defaultAmount,String tag,boolean active,Instant createdAt) { this(id,name,defaultAmount,tag,active,createdAt,null,null); }
    }
    public record Payment(long amount, Instant paidAt, java.time.LocalDate dueDate, String memo, Instant deletedAt) {
        public Payment(long amount, Instant paidAt, java.time.LocalDate dueDate, String memo) { this(amount, paidAt, dueDate, memo, null); }
        public Payment(long amount, Instant paidAt) { this(amount, paidAt, null, null); }
    }
    public record Row(Item item, Payment payment) {}

    private Item item(ResultSet rs) throws SQLException {
        return new Item(rs.getLong("id"), rs.getString("name"), rs.getLong("default_amount"),
            rs.getString("tag"), rs.getBoolean("is_active"), rs.getTimestamp("created_at").toInstant(),rs.getString("home_contract_kind"),rs.getDate("termination_date")==null?null:rs.getDate("termination_date").toLocalDate());
    }

    private Payment payment(ResultSet rs) throws SQLException {
        if (rs.getObject("payment_id") == null) return null;
        var paidAt = rs.getTimestamp("paid_at");
        var due = rs.getDate("due_date");
        var deleted = rs.getTimestamp("deleted_at");
        return new Payment(rs.getLong("amount"), paidAt == null ? null : paidAt.toInstant(), due == null ? null : due.toLocalDate(), rs.getString("memo"), deleted == null ? null : deleted.toInstant());
    }

    public List<Row> list(long userId, YearMonth month) {
        return jdbc.query("""
            SELECT b.*, p.id AS payment_id, p.amount, p.paid_at, p.due_date, p.memo, p.deleted_at FROM bill_items b
            LEFT JOIN bill_payments p ON p.bill_item_id = b.id AND p.period_ym = ?
            WHERE b.user_id = ? AND p.deleted_at IS NULL ORDER BY b.id
            """, (rs, row) -> new Row(item(rs), payment(rs)), month.toString(), userId);
    }

    public Item find(long userId, long id) {
        return jdbc.query("SELECT * FROM bill_items WHERE id = ? AND user_id = ?", (rs, row) -> item(rs), id, userId)
            .stream().findFirst().orElseThrow(() -> new com.zip.backend.common.ApiException(404, "고정 지출 항목이 없어요."));
    }

    public Row activeRow(long userId, long id, YearMonth month) {
        return jdbc.query("""
            SELECT b.*, p.id AS payment_id, p.amount, p.paid_at, p.due_date, p.memo, p.deleted_at FROM bill_items b
            LEFT JOIN bill_payments p ON p.bill_item_id = b.id AND p.period_ym = ?
            WHERE b.id = ? AND b.user_id = ? AND b.is_active = 1 AND p.deleted_at IS NULL
            """, (rs, row) -> new Row(item(rs), payment(rs)), month.toString(), id, userId)
            .stream().findFirst().orElse(null);
    }

    public Payment payment(long id, YearMonth month) {
        return jdbc.query("SELECT id AS payment_id, amount, paid_at, due_date, memo, deleted_at FROM bill_payments WHERE bill_item_id = ? AND period_ym = ?",
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
            // DATETIME(0) must not round an immediately saved row into the future.
            ps.setTimestamp(5, Timestamp.from(now.truncatedTo(java.time.temporal.ChronoUnit.SECONDS))); return ps;
        }, keys);
        return keys.getKey().longValue();
    }

    public void update(long userId, long id, String name, long amount, String tag) {
        jdbc.update("UPDATE bill_items SET name = ?, default_amount = ?, tag = ? WHERE id = ? AND user_id = ?", name, amount, tag, id, userId);
    }

    public void insertPayment(long id, YearMonth month, long amount, Instant paidAt) {
        jdbc.update("INSERT INTO bill_payments (bill_item_id, period_ym, amount, paid_at) VALUES (?, ?, ?, ?)",
            id, month.toString(), amount, paidAt == null ? null : Timestamp.from(paidAt.truncatedTo(java.time.temporal.ChronoUnit.SECONDS)));
    }

    public void updatePayment(long id, YearMonth month, long amount, Instant paidAt) {
        jdbc.update("UPDATE bill_payments SET amount = ?, paid_at = ? WHERE bill_item_id = ? AND period_ym = ?",
            amount, paidAt == null ? null : Timestamp.from(paidAt.truncatedTo(java.time.temporal.ChronoUnit.SECONDS)), id, month.toString());
    }

    public void deleteMonthly(long id, YearMonth month, Instant now) {
        jdbc.update("UPDATE bill_payments SET deleted_at=? WHERE bill_item_id=? AND period_ym=? AND deleted_at IS NULL",
            Timestamp.from(now.truncatedTo(java.time.temporal.ChronoUnit.SECONDS)), id, month.toString());
    }

    public void deactivate(long userId, long id) {
        jdbc.update("UPDATE bill_items SET is_active = 0 WHERE id = ? AND user_id = ?", id, userId);
    }

    public Long matchingActive(long userId, String name, String tag) {
        return jdbc.query("SELECT id FROM bill_items WHERE user_id=? AND name=? AND tag=? AND is_active=1 ORDER BY id", (rs, n) -> rs.getLong(1), userId, name, tag).stream().findFirst().orElse(null);
    }
    public Long matchingUnregistered(long userId, String name, String tag, YearMonth month) {
        return jdbc.query("SELECT b.id FROM bill_items b WHERE b.user_id=? AND b.name=? AND b.tag=? AND b.is_active=1 AND NOT EXISTS (SELECT 1 FROM bill_payments p WHERE p.bill_item_id=b.id AND p.period_ym=?) ORDER BY b.id", (rs,n)->rs.getLong(1), userId,name,tag,month.toString()).stream().findFirst().orElse(null);
    }

    public boolean documentExists(long userId, String hash) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM bill_document_keys WHERE user_id=? AND document_hash=?",Long.class,userId,hash)>0;
    }
    public void rememberDocument(long userId,String hash,long id) {
        jdbc.update("INSERT INTO bill_document_keys(user_id,document_hash,bill_item_id) VALUES (?,?,?)",userId,hash,id);
    }

    public void monthlyDetails(long id, YearMonth month, long amount, java.time.LocalDate dueDate) {
        jdbc.update("UPDATE bill_payments SET amount=?, due_date=? WHERE bill_item_id=? AND period_ym=?", amount, java.sql.Date.valueOf(dueDate), id, month.toString());
    }
    public void monthlyMemo(long id, YearMonth month, String memo) {
        String before=jdbc.queryForObject("SELECT memo FROM bill_payments WHERE bill_item_id=? AND period_ym=?",String.class,id,month.toString());
        jdbc.update("UPDATE bill_payments SET memo=? WHERE bill_item_id=? AND period_ym=?",memo,id,month.toString());
        if(java.util.Objects.equals(before,memo)) return;
        var item=jdbc.queryForMap("SELECT user_id,name FROM bill_items WHERE id=?",id);
        memos.save(((Number)item.get("user_id")).longValue(),"bill",id+":"+month,"고정 지출 · "+month+" · "+item.get("name"),memo);
    }
    public void attachMemo(long user,long id,YearMonth month,String memoId) {
        var linked=memos.attach(user,"bill",id+":"+month,memoId,"고정 지출 · "+month+" · "+find(user,id).name());
        jdbc.update("UPDATE bill_payments SET memo=? WHERE bill_item_id=? AND period_ym=?",linked.body().substring(0,Math.min(200,linked.body().length())),id,month.toString());
    }
    public java.util.Map<String,Object> memoReference(long id,YearMonth month) {
        var rows=jdbc.queryForList("SELECT m.id,m.title FROM memos m JOIN bill_items b ON b.user_id=m.user_id WHERE b.id=? AND m.ledger_source='bill' AND m.ledger_key=?",id,id+":"+month);
        return rows.isEmpty()?java.util.Map.of():java.util.Map.of("memoId",rows.get(0).get("id").toString(),"memoTitle",java.util.Objects.toString(rows.get(0).get("title"),""));
    }

    public void propagateMonthly(long user,long id,YearMonth editedMonth,long amount,java.time.LocalDate due,java.time.LocalDate today,boolean changeAmount,boolean changeDue) {
        var home=housing(user);
        long offset=java.time.temporal.ChronoUnit.MONTHS.between(editedMonth,YearMonth.from(due));
        var rows=jdbc.query("SELECT period_ym,due_date,amount FROM bill_payments WHERE bill_item_id=? AND period_ym<>? AND paid_at IS NULL AND deleted_at IS NULL AND due_date>=?",
            (rs,n)->new FuturePayment(YearMonth.parse(rs.getString(1)),rs.getDate(2).toLocalDate(),rs.getLong(3)),id,editedMonth.toString(),java.sql.Date.valueOf(today));
        for(var row:rows) {
            var month=row.month();
            var dueMonth=changeDue?month.plusMonths(offset):YearMonth.from(row.due());
            var date=changeDue?dueMonth.atDay(Math.min(due.getDayOfMonth(),dueMonth.lengthOfMonth())):row.due();
            if(home!=null && (!home.includes(month) || !home.includes(dueMonth))) continue;
            if(date.isBefore(today)) throw BillInput.bad("변경한 납부일이 오늘 이전인 미납 기록이 있어요. 오늘 이후 날짜를 선택해 주세요.");
            monthlyDetails(id,month,changeAmount?amount:row.amount(),date);
        }
    }
    private record FuturePayment(YearMonth month,java.time.LocalDate due,long amount) {}

    public void propagateAmount(long user,long id,long amount,java.time.LocalDate today) {
        var home=housing(user);
        var rows=jdbc.query("SELECT period_ym,due_date FROM bill_payments WHERE bill_item_id=? AND paid_at IS NULL AND deleted_at IS NULL AND due_date>=?",
            (rs,n)->new DatedMonth(YearMonth.parse(rs.getString(1)),YearMonth.from(rs.getDate(2).toLocalDate())),id,java.sql.Date.valueOf(today));
        for(var row:rows) {
            if(home!=null && (!home.includes(row.month()) || !home.includes(row.dueMonth()))) continue;
            jdbc.update("UPDATE bill_payments SET amount=? WHERE bill_item_id=? AND period_ym=? AND paid_at IS NULL AND deleted_at IS NULL",amount,id,row.month().toString());
        }
    }
    private record DatedMonth(YearMonth month,YearMonth dueMonth) {}

    public Long photoImport(long userId, String hash) {
        return jdbc.query("SELECT bill_item_id FROM bill_photo_imports WHERE user_id=? AND image_hash=?", (rs, n) -> rs.getLong(1), userId, hash).stream().findFirst().orElse(null);
    }

    public void rememberPhoto(long userId, String hash, long id) {
        jdbc.update("INSERT INTO bill_photo_imports(user_id,image_hash,bill_item_id) VALUES (?,?,?)", userId, hash, id);
    }

    public record Housing(String kind, boolean included, Long managementId, long rent, int rentDay, String moveIn, String end) {
        boolean includes(YearMonth month) {
            return (moveIn==null || !month.isBefore(YearMonth.parse(moveIn)))
                && (end==null || !month.isAfter(YearMonth.parse(end)));
        }

        boolean canRegister(YearMonth month, YearMonth current, java.time.LocalDate effective) {
            if (month.isAfter(current) || !includes(month)) return false;
            if ("monthly".equals(kind) && moveIn!=null && end!=null) return true;
            return month.equals(current) && (effective==null || !month.isBefore(YearMonth.from(effective)));
        }

        boolean manages(Item item) {
            return (managementId!=null && managementId==item.id()) || kind.equals(item.homeContractKind());
        }
    }
    public Housing housing(long user) {
        return jdbc.query("""
            SELECT c.*, s.rent_amount, s.rent_day, s.move_in_ym, s.contract_end_ym
            FROM home_contracts c LEFT JOIN user_settings s ON s.user_id=c.user_id WHERE c.user_id=?
            """, (rs,n)->new Housing(rs.getString("contract_kind"),rs.getBoolean("management_included"),
                rs.getObject("management_bill_id")==null?null:rs.getLong("management_bill_id"),
                rs.getBigDecimal("rent_amount")==null?0:rs.getBigDecimal("rent_amount").movePointRight(4).longValueExact(),
                rs.getObject("rent_day")==null?15:rs.getInt("rent_day"),rs.getString("move_in_ym"),rs.getString("contract_end_ym")),user)
            .stream().findFirst().orElse(null);
    }
    public record Rent(long amount, Instant paidAt, java.time.LocalDate dueDate) {}
    public Rent rent(long user, YearMonth month) {
        return jdbc.query("SELECT amount,paid_at,due_date FROM rent_payments WHERE user_id=? AND period_ym=?",(rs,n)->
            new Rent(rs.getLong("amount"),rs.getTimestamp("paid_at")==null?null:rs.getTimestamp("paid_at").toInstant(),rs.getDate("due_date")==null?null:rs.getDate("due_date").toLocalDate()),user,month.toString())
            .stream().findFirst().orElse(null);
    }
    public record Interest(String id, java.time.LocalDate date, long amount, Instant paidAt) {
        public Interest(String id,java.time.LocalDate date,long amount) { this(id,date,amount,null); }
    }
    public List<Interest> interest(long user, YearMonth month) {
        return jdbc.query("""
            SELECT c.loan_id,c.charge_date,c.amount,c.paid_at FROM loan_interest_charges c
            JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=? AND c.charge_date>=? AND c.charge_date<?
            """,(rs,n)->new Interest(rs.getString("loan_id"),rs.getDate("charge_date").toLocalDate(),rs.getLong("amount"),rs.getTimestamp("paid_at")==null?null:rs.getTimestamp("paid_at").toInstant()),
            user,java.sql.Date.valueOf(month.atDay(1)),java.sql.Date.valueOf(month.plusMonths(1).atDay(1)));
    }
    public Interest expectedInterest(long user, YearMonth month) {
        return jdbc.query("SELECT * FROM housing_loans WHERE user_id=? AND is_active=1",(rs,n)->{
            var date=month.atDay(Math.min(rs.getInt("payment_day"),month.lengthOfMonth()));
            if(date.isBefore(rs.getDate("start_date").toLocalDate())) return null;
            long amount=java.math.BigDecimal.valueOf(rs.getLong("principal")).multiply(rs.getBigDecimal("annual_rate"))
                .divide(java.math.BigDecimal.valueOf(1200),0,java.math.RoundingMode.HALF_UP).longValueExact();
            return new Interest(rs.getString("id"),date,amount);
        },user).stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }

    public boolean managed(long user,long id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM bill_items b WHERE b.user_id=? AND b.id=? AND (b.home_contract_kind IS NOT NULL OR EXISTS (SELECT 1 FROM home_contracts c WHERE c.user_id=b.user_id AND c.management_bill_id=b.id))",Long.class,user,id)>0;
    }
    public record AutoOwner(long user,String zone) {}
    public List<AutoOwner> autoOwners() {
        return jdbc.query("SELECT user_id,billing_time_zone FROM home_contracts WHERE billing_time_zone IS NOT NULL",(rs,n)->new AutoOwner(rs.getLong(1),rs.getString(2)));
    }
    public String savedZone(long user) {
        return jdbc.query("SELECT billing_time_zone FROM home_contracts WHERE user_id=?",(rs,n)->rs.getString(1),user).stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }
    public void rememberZone(long user,String zone) {
        jdbc.update("UPDATE home_contracts SET billing_time_zone=? WHERE user_id=?",zone,user);
    }
    public java.time.LocalDate paymentEffectiveFrom(long user) {
        return jdbc.query("SELECT payment_effective_from FROM home_contracts WHERE user_id=?",(rs,n)->rs.getDate(1)==null?null:rs.getDate(1).toLocalDate(),user).stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }
    public java.time.LocalDate managementDue(long user,YearMonth month,Housing home) {
        int day="jeonse".equals(home.kind())?jdbc.query("SELECT payment_day FROM housing_loans WHERE user_id=? AND is_active=1",(rs,n)->rs.getInt(1),user).stream().findFirst().orElse(15):home.rentDay();
        return month.atDay(Math.min(day,month.lengthOfMonth()));
    }
    public void autoRegister(long user,YearMonth month,YearMonth current) {
        var home=housing(user);
        if(home==null || !home.canRegister(month,current,paymentEffectiveFrom(user))) return;
        if("monthly".equals(home.kind()) && home.rent()>0 && rent(user,month)==null) {
            var due=month.atDay(Math.min(home.rentDay(),month.lengthOfMonth()));
            jdbc.update("INSERT INTO rent_payments(user_id,period_ym,amount,due_date,paid_at) VALUES (?,?,?,?,NULL)",
                user,month.toString(),home.rent(),java.sql.Date.valueOf(due));
        }
        if(!home.included() && home.managementId()!=null && payment(home.managementId(),month)==null
            && list(user,month).stream().noneMatch(row -> row.payment()!=null && home.manages(row.item()))) {
            var item=find(user,home.managementId());
            if(item.active() && item.defaultAmount()>0) {
                var due=managementDue(user,month,home);
                jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount,due_date,paid_at,memo) VALUES (?,?,?,?,NULL,?)",
                    item.id(),month.toString(),item.defaultAmount(),java.sql.Date.valueOf(due),"내 집 정보에서 자동 등록");
            }
        }
        if("jeonse".equals(home.kind()) && interest(user,month).isEmpty()) {
            var expected=expectedInterest(user,month);
            if(expected!=null) jdbc.update("""
                INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount)
                SELECT id,?,principal,annual_rate,? FROM housing_loans WHERE id=? AND user_id=? AND is_active=1
                """,java.sql.Date.valueOf(expected.date()),expected.amount(),expected.id(),user);
        }
    }
}

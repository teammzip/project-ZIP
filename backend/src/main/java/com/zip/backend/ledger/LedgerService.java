package com.zip.backend.ledger;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillInput;
import com.zip.backend.common.ApiException;
import com.zip.backend.memo.LedgerMemoWriter;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerService {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    private final LedgerMemoWriter memos;
    private final SalaryService salary;
    private final LedgerCategoryService categories;

    public LedgerService(JdbcTemplate jdbc, AuthRepository auth, Clock clock, LedgerMemoWriter memos,
                         SalaryService salary, LedgerCategoryService categories) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.clock = clock;
        this.memos = memos;
        this.salary = salary;
        this.categories = categories;
    }

    private boolean income(String kind) {
        if (!Set.of("income", "spend").contains(kind)) throw bad("수입 또는 기타 지출을 선택해 주세요.");
        return kind.equals("income");
    }

    private String type(String value) {
        if (!Set.of("fixed", "other").contains(value)) throw bad("수입 유형을 확인해 주세요.");
        return value.toUpperCase(Locale.ROOT);
    }

    private LocalDate today(String zone) {
        try {
            return LocalDate.now(clock.withZone(ZoneId.of(zone)));
        } catch (DateTimeException e) {
            throw bad("시간대를 확인해 주세요.");
        }
    }

    private void lock(long user, long session) {
        auth.lockUser(user);
        if (!auth.sessionActive(session, user, clock.instant())) {
            throw new ApiException(401, "다시 로그인해 주세요.");
        }
    }

    public List<Map<String, Object>> list(long userId, String kind, String month, String timeZone, String incomeType) {
        boolean in = income(kind);
        var selected = BillInput.month(month);
        var now = today(timeZone);
        if (selected.isAfter(YearMonth.from(now))) throw bad("미래 월은 조회할 수 없어요.");
        String selectedIncomeType = in ? type(incomeType) : null;
        if (in) salary.sync(userId, timeZone);
        var through = selected.atEndOfMonth().isAfter(now) ? now : selected.atEndOfMonth();
        var args = new ArrayList<Object>(List.of(kind, userId, java.sql.Date.valueOf(selected.atDay(1)), java.sql.Date.valueOf(through)));
        if (in) args.add(selectedIncomeType);
        boolean fixed = "FIXED".equals(selectedIncomeType);
        String salaryLabel = fixed ? categories.salaryLabel(userId) : "월급";

        String dateColumn = in ? "r.income_date" : "r.expense_date";
        String recordsTable = in ? "incomes" : "expenses";
        String salaryManaged = in ? "s.income_id IS NOT NULL" : "FALSE";
        String salaryJoin = in ? "LEFT JOIN salary_records s ON s.user_id = r.user_id AND s.income_id = r.id" : "";
        String incomeFilter = in ? "AND r.income_type = ?" : "";
        String sql = """
            SELECT r.id, r.amount, %1$s AS record_date, r.memo, c.name,
                   %2$s AS salary_managed, m.id AS memo_id, m.title AS memo_title
            FROM %3$s r
            JOIN ledger_categories c ON c.id = r.category_id
            LEFT JOIN memos m ON m.user_id = r.user_id AND m.ledger_source = ?
                             AND m.ledger_key = CONCAT(r.id, '')
            %4$s
            WHERE r.user_id = ? AND %1$s >= ? AND %1$s <= ?
            %5$s
            ORDER BY %1$s DESC, r.id DESC
            """.formatted(dateColumn, salaryManaged, recordsTable, salaryJoin, incomeFilter);

        return jdbc.query(sql, (rs, n) -> {
            String category = rs.getString("name");
            boolean salaryCategory = fixed && category.equals("월급");
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", rs.getString("id"));
            row.put("amount", rs.getLong("amount"));
            row.put("date", rs.getDate("record_date").toString());
            row.put("cat", salaryCategory ? salaryLabel : category);
            row.put("memo", Objects.toString(rs.getString("memo"), ""));
            row.put("salaryCategory", salaryCategory);
            row.put("salaryManaged", rs.getBoolean("salary_managed"));
            String memoId = rs.getString("memo_id");
            if (memoId != null) {
                row.put("memoId", memoId);
                row.put("memoTitle", Objects.toString(rs.getString("memo_title"), ""));
            }
            return row;
        }, args.toArray());
    }

    @Transactional
    public void create(long user, long session, String kind, String timeZone, Map<String, Object> body) {
        save(user, session, kind, null, timeZone, body);
    }

    @Transactional
    public void update(long user, long session, String kind, String id, String timeZone, Map<String, Object> body) {
        save(user, session, kind, BillInput.id(id), timeZone, body);
    }

    private void save(long user, long session, String kind, Long id, String zone, Map<String, Object> body) {
        boolean in = income(kind);
        var allowed = in ? Set.of("amount", "date", "cat", "memo", "incomeType", "memoId")
            : Set.of("amount", "date", "cat", "memo", "memoId");
        if (!allowed.containsAll(body.keySet())) throw bad("입력 항목을 확인해 주세요.");
        long amount = BillInput.amount(body.get("amount"));
        if (amount <= 0 || amount > (in ? 999999999L : 99999999L)) throw bad("금액 범위를 확인해 주세요.");
        LocalDate date;
        try {
            date = LocalDate.parse(Objects.toString(body.get("date"), ""));
            if (date.getYear() < 1 || date.getYear() > 9999) throw new DateTimeException("date");
        } catch (DateTimeException e) {
            throw bad("날짜를 확인해 주세요.");
        }
        var now = today(zone);
        if (date.isAfter(now)) throw bad("오늘 이후의 기록은 등록할 수 없어요.");
        String cat = BillInput.text(body.get("cat"), "분류", 24);
        Object rawMemo = body.getOrDefault("memo", "");
        if (!(rawMemo instanceof String memo) || memo.length() > 100) throw bad("메모는 100자 이내로 입력해 주세요.");
        String memoText = memo.strip();
        String incomeType = in ? type(Objects.toString(body.get("incomeType"), "")) : null;

        lock(user, session);
        boolean ledgerSalary = in && "FIXED".equals(incomeType) && ("월급".equals(cat) || categories.salaryLabel(user).equals(cat));
        if (ledgerSalary) {
            if (id != null) throw new ApiException(409, "월급은 마이페이지의 수입 정보에서 설정해 주세요.");
            salary.requireFirstLedgerSalary(user, date);
        }
        if (in && id != null && salary.managed(user, id)) {
            throw new ApiException(409, "자동 등록 월급은 계정·설정의 수입 정보에서 변경해 주세요.");
        }
        String table = in ? "incomes" : "expenses";
        if (id != null && jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE id=? AND user_id=?", Integer.class, id, user) == 0) {
            throw new ApiException(404, "기록을 찾을 수 없어요.");
        }
        String beforeMemo = id == null ? null
            : jdbc.queryForObject("SELECT memo FROM " + table + " WHERE id=? AND user_id=?", String.class, id, user);
        long category = categories.resolveCategoryId(in ? "INCOME" : "EXPENSE", ledgerSalary ? "월급" : cat);
        String dateColumn = in ? "income_date" : "expense_date";
        var args = new ArrayList<Object>(List.of(category, amount, java.sql.Date.valueOf(date), memoText));
        if (in) args.add(incomeType);
        if (id == null) {
            args.add(user);
            jdbc.update("INSERT INTO " + table + " (category_id,amount," + dateColumn + ",memo" + (in ? ",income_type" : "")
                + ",user_id) VALUES (?,?,?,?" + (in ? ",?" : "") + ",?)", args.toArray());
            id = jdbc.queryForObject("SELECT MAX(id) FROM " + table + " WHERE user_id=?", Long.class, user);
        } else {
            args.add(id);
            args.add(user);
            jdbc.update("UPDATE " + table + " SET category_id=?,amount=?," + dateColumn + "=?,memo=?" + (in ? ",income_type=?" : "")
                + " WHERE id=? AND user_id=?", args.toArray());
        }
        String label = (in ? (incomeType.equals("FIXED") ? "고정 수입" : "기타 수입") : "기타 지출") + " · " + date + " · " + cat;
        if (body.get("memoId") != null) {
            var linked = memos.attach(user, kind, id.toString(), body.get("memoId").toString(), label);
            String preview = linked.body().substring(0, Math.min(100, linked.body().length()));
            jdbc.update("UPDATE " + table + " SET memo=? WHERE id=? AND user_id=?", preview, id, user);
        } else if (!Objects.equals(beforeMemo, memoText)) {
            memos.save(user, kind, id.toString(), label, memoText);
        }
        if (ledgerSalary) {
            salary.registerLedgerSalary(user, amount, date, now);
            salary.linkLedgerSalary(user, date, id);
        }
    }

    @Transactional
    public void delete(long user, long session, String kind, String id) {
        boolean in = income(kind);
        long key = BillInput.id(id);
        lock(user, session);
        if (in) salary.clearForLedgerDeletion(user, key);
        if (jdbc.update("DELETE FROM " + (in ? "incomes" : "expenses") + " WHERE id=? AND user_id=?", key, user) == 0) {
            throw new ApiException(404, "기록을 찾을 수 없어요.");
        }
    }

    private ApiException bad(String message) {
        return new ApiException(400, message);
    }

    public Map<String, Long> summary(long user, String timeZone) {
        var now = today(timeZone);
        var from = YearMonth.from(now).minusMonths(11).atDay(1);
        salary.sync(user, timeZone);
        Map<String, Long> result = new LinkedHashMap<>();
        jdbc.query("SELECT income_date,amount FROM incomes WHERE user_id=? AND income_date>=? AND income_date<=?", rs -> {
            String month = rs.getDate("income_date").toLocalDate().toString().substring(0, 7);
            result.merge(month, rs.getLong("amount"), Long::sum);
        }, user, java.sql.Date.valueOf(from), java.sql.Date.valueOf(now));
        return result;
    }
}

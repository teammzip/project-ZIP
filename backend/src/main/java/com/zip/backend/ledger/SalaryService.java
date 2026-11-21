package com.zip.backend.ledger;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillInput;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** 월급 설정과 월별 실제 수령 기록. 이미 생성된 기록은 설정 변경으로 덮어쓰지 않는다. */
@Service
public class SalaryService {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    private final JsonMapper json;
    public SalaryService(JdbcTemplate jdbc, AuthRepository auth, Clock clock, JsonMapper json) {
        this.jdbc=jdbc; this.auth=auth; this.clock=clock; this.json=json;
    }
    private LocalDate today(String zone) {
        try { return LocalDate.now(clock.withZone(ZoneId.of(zone))); }
        catch (DateTimeException | NullPointerException error) { throw new ApiException(400,"시간대를 확인해 주세요."); }
    }
    public Map<String,Object> get(long user) {
        return jdbc.query("SELECT amount,income_period,payment_day,start_month FROM salary_settings WHERE user_id=?", (rs,n) -> {
            Map<String,Object> result=new LinkedHashMap<>();
            long amount=rs.getLong("amount"); String period=rs.getString("income_period");
            result.put("amount",amount); result.put("incomePeriod",period); result.put("monthlyAmount",period.equals("annual")?amount/12:amount); result.put("paymentDay",rs.getInt("payment_day")); result.put("startMonth",rs.getString("start_month"));
            return result;
        },user).stream().findFirst().orElseGet(() -> Map.of("amount",0L,"incomePeriod","monthly","monthlyAmount",0L,"paymentDay",25,"startMonth",""));
    }
    @Transactional
    public Map<String,Object> getWithDraft(long user) {
        auth.lockUser(user);
        var settings = get(user);
        String draft = jdbc.queryForObject("SELECT housing_salary_draft FROM users WHERE id=?", String.class, user);
        if (draft == null && settings.get("startMonth").equals("") && !hasDeletedSalary(user)) {
            var latest = jdbc.query("""
                SELECT i.amount,i.income_date FROM incomes i JOIN ledger_categories c ON c.id=i.category_id
                WHERE i.user_id=? AND i.income_type='FIXED' AND c.kind='INCOME' AND c.name='월급'
                  AND i.amount BETWEEN 1 AND 999999999
                ORDER BY i.income_date DESC,i.id DESC LIMIT 1
                """, (rs,n) -> new LegacySalary(rs.getLong("amount"), rs.getDate("income_date").toLocalDate()), user);
            if (!latest.isEmpty()) {
                var record = latest.get(0);
                registerLedgerSalary(user, record.amount(), record.date(), LocalDate.now(clock));
                settings = get(user);
            }
        }
        var result = new LinkedHashMap<>(settings);
        if (draft != null) result.put("draft", json.readTree(draft));
        return result;
    }

    private record LegacySalary(long amount, LocalDate date) {}

    // The ledger save and legacy import both hold the account lock.
    void requireFirstLedgerSalary(long user, LocalDate date) {
        var month = YearMonth.from(date);
        if (jdbc.queryForObject("""
            SELECT COUNT(*) FROM users u WHERE u.id=? AND (
                u.housing_salary_draft IS NOT NULL
                OR EXISTS (SELECT 1 FROM salary_settings s WHERE s.user_id=u.id)
                OR EXISTS (SELECT 1 FROM incomes i JOIN ledger_categories c ON c.id=i.category_id
                           WHERE i.user_id=u.id AND i.income_type='FIXED' AND c.kind='INCOME' AND c.name='월급'
                             AND (?=0 OR (i.income_date>=? AND i.income_date<?))))
            """, Integer.class, user, hasDeletedSalary(user) ? 1 : 0, month.atDay(1), month.plusMonths(1).atDay(1)) > 0) {
            throw new ApiException(409,"이미 월급 정보가 있어요. 마이페이지의 수입 정보에서 수정해 주세요.");
        }
    }

    private boolean hasDeletedSalary(long user) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE user_id=? AND income_id IS NULL", Integer.class, user) > 0;
    }

    void linkLedgerSalary(long user, LocalDate date, long id) {
        String month = YearMonth.from(date).toString();
        if (jdbc.update("UPDATE salary_records SET income_id=? WHERE user_id=? AND period_ym=? AND income_id IS NULL", id, user, month) == 0) {
            jdbc.update("INSERT INTO salary_records(user_id,period_ym,income_id) VALUES (?,?,?)", user, month, id);
        }
    }

    void clearForLedgerDeletion(long user, long id) {
        var months = jdbc.query("""
            SELECT i.income_date FROM incomes i JOIN ledger_categories c ON c.id=i.category_id
            WHERE i.id=? AND i.user_id=? AND i.income_type='FIXED' AND c.kind='INCOME' AND c.name='월급'
            """, (rs,n) -> YearMonth.from(rs.getDate("income_date").toLocalDate()).toString(), id, user);
        if (months.isEmpty()) return;
        String month = months.get(0);
        jdbc.update("UPDATE salary_records SET income_id=NULL WHERE user_id=? AND income_id=?", user, id);
        if (jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE user_id=? AND period_ym=?", Integer.class, user, month) == 0) {
            jdbc.update("INSERT INTO salary_records(user_id,period_ym,income_id) VALUES (?,?,NULL)", user, month);
        }
        jdbc.update("DELETE FROM salary_settings WHERE user_id=?", user);
        jdbc.update("UPDATE users SET housing_salary_draft=NULL WHERE id=?", user);
    }

    void registerLedgerSalary(long user, long amount, LocalDate received, LocalDate now) {
        jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,?,'monthly',?,?)",
            user, amount, received.getDayOfMonth(), YearMonth.from(now).toString());
    }

    // 설문 트랜잭션에서 호출한다. 수령일까지 입력하기 전에는 자동 등록을 시작하지 않는다.
    public void saveOnboarding(long user, long session, String zone, Map<String,Object> input) {
        if (input.keySet().equals(Set.of("amount", "incomePeriod"))) {
            var salary = validate(Map.of("amount", input.get("amount"), "incomePeriod", input.get("incomePeriod"), "paymentDay", 1));
            var draft = json.writeValueAsString(Map.of("amount", salary.amount(), "incomePeriod", salary.period()));
            jdbc.update("UPDATE users SET housing_salary_draft=? WHERE id=?", draft, user);
        } else {
            save(user, session, zone, input);
        }
    }

    private record Terms(long amount, String period, long day) {}

    private static Terms validate(Map<String,Object> input) {
        if(!input.keySet().equals(Set.of("amount","paymentDay","incomePeriod"))) throw new ApiException(400,"월급 금액과 수령일을 확인해 주세요.");
        String period=Objects.toString(input.get("incomePeriod"),"");
        if(!Set.of("monthly","annual").contains(period)) throw new ApiException(400,"월·연 수입 기준을 확인해 주세요.");
        long amount=BillInput.amount(input.get("amount")), day=BillInput.amount(input.get("paymentDay"));
        if(amount>(period.equals("annual")?11999999988L:999999999L) || (amount>0 && period.equals("annual") && amount<12) || day<1 || day>31) throw new ApiException(400,"월 환산 금액은 1~999,999,999원, 수령일은 1~31일로 입력해 주세요. 0원은 자동 등록 중단이에요.");
        return new Terms(amount, period, day);
    }
    @Transactional
    public Map<String,Object> save(long user,long session,String zone,Map<String,Object> input) {
        var terms = validate(input);
        var period = terms.period();
        long amount = terms.amount(), day = terms.day();
        var now=today(zone);
        auth.lockUser(user);
        if(!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"다시 로그인해 주세요.");
        // 변경 전에 기존 설정으로 수령일이 지난 달까지 확정한다.
        syncLocked(user,now);
        var previous=get(user);
        boolean exists=!previous.get("startMonth").toString().isEmpty();
        String start=YearMonth.from(now).toString();
        if(exists) jdbc.update("UPDATE salary_settings SET amount=?,income_period=?,payment_day=?,start_month=? WHERE user_id=?",amount,period,day,start,user);
        else jdbc.update("INSERT INTO salary_settings(user_id,amount,income_period,payment_day,start_month) VALUES (?,?,?,?,?)",user,amount,period,day,start);
        syncLocked(user,now);
        jdbc.update("UPDATE users SET housing_salary_draft=NULL WHERE id=?",user);
        return get(user);
    }
    @Transactional
    public void sync(long user,String zone) {
        var now=today(zone);
        auth.lockUser(user);
        syncLocked(user,now);
    }
    private void syncLocked(long user,LocalDate now) {
        var settings=get(user);
        long original=((Number)settings.get("amount")).longValue();
        if(original==0) return;
        boolean annual=settings.get("incomePeriod").equals("annual");
        int day=((Number)settings.get("paymentDay")).intValue();
        var start=YearMonth.parse(settings.get("startMonth").toString());
        var end=YearMonth.from(now);
        var categories=jdbc.queryForList("SELECT id FROM ledger_categories WHERE kind='INCOME' AND name='월급'",Long.class);
        if(categories.isEmpty()) {
            jdbc.update("INSERT INTO ledger_categories(kind,name,color,sort_order) VALUES ('INCOME','월급','#6485df',0) ON DUPLICATE KEY UPDATE id=id");
            categories=jdbc.queryForList("SELECT id FROM ledger_categories WHERE kind='INCOME' AND name='월급'",Long.class);
        }
        for(var month=start; !month.isAfter(end); month=month.plusMonths(1)) {
            var date=month.atDay(Math.min(day,month.lengthOfMonth()));
            if(date.isAfter(now)) continue;
            if(jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE user_id=? AND period_ym=?",Integer.class,user,month.toString())>0) continue;
            // 기존에 직접 입력한 월급이 있는 달은 자동 생성하지 않아 이중 합산을 막는다.
            if(jdbc.queryForObject("SELECT COUNT(*) FROM incomes i JOIN ledger_categories c ON c.id=i.category_id WHERE i.user_id=? AND i.income_type='FIXED' AND c.kind='INCOME' AND c.name='월급' AND i.income_date>=? AND i.income_date<?",Integer.class,user,java.sql.Date.valueOf(month.atDay(1)),java.sql.Date.valueOf(month.plusMonths(1).atDay(1)))>0) continue;
            long amount=annual?original/12+(month.getMonthValue()==12?original%12:0):original;
            jdbc.update("INSERT INTO incomes(user_id,category_id,amount,income_date,memo,income_type) VALUES (?,?,?,?,'','FIXED')",user,categories.get(0),amount,java.sql.Date.valueOf(date));
            long id=jdbc.queryForObject("SELECT MAX(id) FROM incomes WHERE user_id=?",Long.class,user);
            jdbc.update("INSERT INTO salary_records(user_id,period_ym,income_id) VALUES (?,?,?)",user,month.toString(),id);
        }
    }
    public boolean managed(long user,long id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM salary_records WHERE user_id=? AND income_id=?",Integer.class,user,id)>0;
    }
}

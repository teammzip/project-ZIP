package com.zip.backend.ledger;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillInput;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 월급 설정과 월별 실제 수령 기록. 이미 생성된 기록은 설정 변경으로 덮어쓰지 않는다. */
@Service
public class SalaryService {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    public SalaryService(JdbcTemplate jdbc, AuthRepository auth, Clock clock) {
        this.jdbc=jdbc; this.auth=auth; this.clock=clock;
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
    public Map<String,Object> save(long user,long session,String zone,Map<String,Object> input) {
        if(!input.keySet().equals(Set.of("amount","paymentDay","incomePeriod"))) throw new ApiException(400,"월급 금액과 수령일을 확인해 주세요.");
        String period=Objects.toString(input.get("incomePeriod"),"");
        if(!Set.of("monthly","annual").contains(period)) throw new ApiException(400,"월·연 수입 기준을 확인해 주세요.");
        long amount=BillInput.amount(input.get("amount")), day=BillInput.amount(input.get("paymentDay"));
        if(amount>(period.equals("annual")?11999999988L:999999999L) || (amount>0 && period.equals("annual") && amount<12) || day<1 || day>31) throw new ApiException(400,"월 환산 금액은 1~999,999,999원, 수령일은 1~31일로 입력해 주세요. 0원은 자동 등록 중단이에요.");
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

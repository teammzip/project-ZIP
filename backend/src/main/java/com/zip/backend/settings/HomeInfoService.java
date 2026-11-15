package com.zip.backend.settings;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillService;
import com.zip.backend.common.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HomeInfoService {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final SettingsRepository settings;
    private final SettingsService settingsService;
    private final BillService bills;
    private final Clock clock;
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    public HomeInfoService(JdbcTemplate jdbc, AuthRepository auth, SettingsRepository settings, SettingsService settingsService, BillService bills, Clock clock) {
        this.jdbc=jdbc; this.auth=auth; this.settings=settings; this.settingsService=settingsService; this.bills=bills; this.clock=clock;
    }
    private void lock(long user, long session) {
        auth.lockUser(user);
        if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
    }

    @Transactional
    public Map<String,Object> get(long user,long session) {
        lock(user,session);
        settle(user);
        return response(user);
    }

    @Transactional
    public Map<String,Object> save(long user,long session,HomeInfoInput input) {
        lock(user,session);
        var previous=settings.read(user);
        var contracts=jdbc.query("SELECT management_bill_id FROM home_contracts WHERE user_id=?", (rs,row)->rs.getString(1),user);
        Long managed=contracts.isEmpty() || contracts.get(0)==null ? null : Long.valueOf(contracts.get(0));
        if (managed==null) managed=jdbc.query("SELECT id FROM bill_items WHERE user_id=? AND name='관리비' AND tag='관리비' AND is_active=1 ORDER BY id", (rs,row)->rs.getLong(1),user).stream().findFirst().orElse(null);
        if (managed!=null && jdbc.queryForObject("SELECT COUNT(*) FROM bill_items WHERE id=? AND user_id=? AND is_active=1",Long.class,managed,user)==0) managed=null;
        if (input.fee()>0) {
            if (managed==null) managed=Long.valueOf((String)bills.create(user,session,Map.of("name","관리비","tag","관리비","amount",input.fee())).get("id"));
            else bills.update(user,session,managed,Map.of("amount",input.fee()));
        } else if (managed!=null) bills.remove(user,session,managed);

        settings.save(user,new SettingsRepository.Settings(BigDecimal.valueOf(input.rent(),4),input.rentDay(),input.moveIn(),input.end(),previous.on(),
            input.address()==null?previous.home():input.address(),previous.regionId(),previous.location()),false);
        if (contracts.isEmpty()) jdbc.update("INSERT INTO home_contracts(user_id,contract_kind) VALUES (?,?)",user,input.kind());
        jdbc.update("UPDATE home_contracts SET contract_kind=?,deposit=?,management_included=?,management_fee=?,contract_fee=?,management_bill_id=? WHERE user_id=?",
            input.kind(),input.deposit(),input.included(),input.fee(),input.contractFee(),managed,user);
        // 변경 전 조건의 도래분을 확정하고 이미 기록한 월은 보존한다.
        settle(user);
        var existing=loan(user);
        if (input.loan()==null) jdbc.update("UPDATE housing_loans SET is_active=0 WHERE user_id=?",user);
        else {
            var l=input.loan();
            String id=existing==null?UUID.randomUUID().toString():(String)existing.get("id");
            String start=existing!=null && Boolean.TRUE.equals(existing.get("active"))?(String)existing.get("startDate"):l.start().toString();
            if (existing==null) jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date,is_active) VALUES (?,?,?,?,?,?,1)",id,user,l.principal(),l.rate(),l.day(),start);
            else jdbc.update("UPDATE housing_loans SET principal=?,annual_rate=?,payment_day=?,start_date=?,is_active=1 WHERE user_id=?",l.principal(),l.rate(),l.day(),start,user);
            settle(user);
        }
        return response(user);
    }

    private Map<String,Object> loan(long user) {
        return jdbc.query("SELECT * FROM housing_loans WHERE user_id=?",(rs,row)->{
            var out=new LinkedHashMap<String,Object>();
            out.put("id",rs.getString("id")); out.put("userId",Long.toString(user)); out.put("principal",rs.getLong("principal"));
            out.put("annualRate",rs.getBigDecimal("annual_rate")); out.put("paymentDay",rs.getInt("payment_day"));
            out.put("startDate",rs.getDate("start_date").toLocalDate().toString()); out.put("active",rs.getBoolean("is_active")); return (Map<String,Object>)out;
        },user).stream().findFirst().orElse(null);
    }

    private void settle(long user) {
        var plan=loan(user);
        if (plan==null || !Boolean.TRUE.equals(plan.get("active"))) return;
        String id=(String)plan.get("id");
        LocalDate start=LocalDate.parse((String)plan.get("startDate")),today=LocalDate.now(clock.withZone(KOREA));
        var seen=new HashSet<>(jdbc.query("SELECT charge_date FROM loan_interest_charges WHERE loan_id=?",(rs,row)->YearMonth.from(rs.getDate(1).toLocalDate()),id));
        long amount=BigDecimal.valueOf((Long)plan.get("principal")).multiply((BigDecimal)plan.get("annualRate")).divide(BigDecimal.valueOf(1200),0,RoundingMode.HALF_UP).longValueExact();
        var pending=new ArrayList<Object[]>();
        for (YearMonth month=YearMonth.from(start);!month.isAfter(YearMonth.from(today));month=month.plusMonths(1)) {
            LocalDate date=month.atDay(Math.min((Integer)plan.get("paymentDay"),month.lengthOfMonth()));
            if (date.isBefore(start) || date.isAfter(today) || seen.contains(month)) continue;
            pending.add(new Object[]{id,java.sql.Date.valueOf(date),plan.get("principal"),plan.get("annualRate"),amount});
        }
        if (!pending.isEmpty()) jdbc.batchUpdate("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount) VALUES (?,?,?,?,?)",pending);
    }

    private Map<String,Object> response(long user) {
        var result=new LinkedHashMap<String,Object>();
        result.put("settings",settingsService.get(user));
        var contract=jdbc.query("SELECT * FROM home_contracts WHERE user_id=?",(rs,row)->{
            var c=new LinkedHashMap<String,Object>(); c.put("kind",rs.getString("contract_kind")); c.put("deposit",rs.getLong("deposit"));
            c.put("mgmtIncluded",rs.getBoolean("management_included")); c.put("mgmtFee",rs.getLong("management_fee")); c.put("contractFee",rs.getLong("contract_fee"));
            c.put("managementBillId",rs.getString("management_bill_id")); return (Map<String,Object>)c;
        },user).stream().findFirst().orElse(null);
        result.put("contract",contract); result.put("loan",loan(user));
        result.put("charges",jdbc.query("SELECT c.* FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=? ORDER BY charge_date",(rs,row)->{
            String date=rs.getDate("charge_date").toLocalDate().toString(),id=rs.getString("loan_id");
            return Map.of("id",id+":"+date.substring(0,7),"loanId",id,"userId",Long.toString(user),"date",date,"amount",rs.getLong("amount"),"principal",rs.getLong("principal"),"annualRate",rs.getBigDecimal("annual_rate"));
        },user));
        result.put("managementBill",contract==null || contract.get("managementBillId")==null?null:bills.currentActive(user,Long.parseLong((String)contract.get("managementBillId"))));
        return result;
    }
}

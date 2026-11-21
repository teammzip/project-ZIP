package com.zip.backend.ledger;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.bills.BillInput;
import com.zip.backend.common.ApiException;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/ledger")
public class LedgerController {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    private final com.zip.backend.memo.LedgerMemoWriter memos;
    private final SalaryService salary;
    private final LedgerCategoriesController categories;
    public LedgerController(JdbcTemplate jdbc, AuthRepository auth, Clock clock,com.zip.backend.memo.LedgerMemoWriter memos,SalaryService salary,LedgerCategoriesController categories) { this.jdbc=jdbc; this.auth=auth; this.clock=clock; this.memos=memos; this.salary=salary; this.categories=categories; }
    private long user(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }
    private boolean income(String kind) {
        if(!Set.of("income","spend").contains(kind)) throw bad("수입 또는 기타 지출을 선택해 주세요.");
        return kind.equals("income");
    }
    private String type(String value) {
        if(!Set.of("fixed","other").contains(value)) throw bad("수입 유형을 확인해 주세요.");
        return value.toUpperCase(Locale.ROOT);
    }
    private LocalDate today(String zone) {
        try { return LocalDate.now(clock.withZone(ZoneId.of(zone))); }
        catch(DateTimeException e) { throw bad("시간대를 확인해 주세요."); }
    }
    private void lock(Jwt jwt) {
        auth.lockUser(user(jwt));
        if(!auth.sessionActive(Long.parseLong(jwt.getClaimAsString("sid")),user(jwt),clock.instant())) throw new ApiException(401,"다시 로그인해 주세요.");
    }
    @GetMapping("/{kind}")
    public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt,@PathVariable String kind,@RequestParam String month,@RequestParam String timeZone,@RequestParam(defaultValue="fixed") String incomeType) {
        boolean in=income(kind); var selected=BillInput.month(month); var now=today(timeZone);
        if(selected.isAfter(YearMonth.from(now))) throw bad("미래 월은 조회할 수 없어요.");
        if(in) { type(incomeType); salary.sync(user(jwt),timeZone); }
        var through=selected.atEndOfMonth().isAfter(now)?now:selected.atEndOfMonth();
        String date=in?"income_date":"expense_date";
        var args=new ArrayList<Object>(List.of(user(jwt),java.sql.Date.valueOf(selected.atDay(1)),java.sql.Date.valueOf(through)));
        if(in) args.add(type(incomeType));
        boolean fixed = in && incomeType.equals("fixed");
        String salaryLabel = fixed ? categories.salaryLabel(user(jwt)) : "월급";
        return jdbc.query("SELECT r.id,r.amount,r."+date+" AS record_date,r.memo,c.name FROM "+(in?"incomes":"expenses")+" r JOIN ledger_categories c ON c.id=r.category_id WHERE r.user_id=? AND r."+date+">=? AND r."+date+"<=?"+(in?" AND r.income_type=?":"")+" ORDER BY r."+date+" DESC,r.id DESC",(rs,n)-> {
            String category = rs.getString("name");
            boolean salaryCategory = fixed && category.equals("월급");
            Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getString("id")); row.put("amount",rs.getLong("amount")); row.put("date",rs.getDate("record_date").toString()); row.put("cat",salaryCategory ? salaryLabel : category); row.put("memo",Objects.toString(rs.getString("memo"),"")); row.put("salaryCategory",salaryCategory); row.put("salaryManaged",in && salary.managed(user(jwt),rs.getLong("id"))); row.putAll(memos.reference(user(jwt),kind,rs.getString("id"))); return row;
        },args.toArray());
    }
    @PostMapping("/{kind}")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public void create(@AuthenticationPrincipal Jwt jwt,@PathVariable String kind,@RequestParam String timeZone,@RequestBody Map<String,Object> body) { save(jwt,kind,null,timeZone,body); }
    @PutMapping("/{kind}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void update(@AuthenticationPrincipal Jwt jwt,@PathVariable String kind,@PathVariable String id,@RequestParam String timeZone,@RequestBody Map<String,Object> body) { save(jwt,kind,BillInput.id(id),timeZone,body); }
    private void save(Jwt jwt,String kind,Long id,String zone,Map<String,Object> body) {
        boolean in=income(kind);
        var allowed=in?Set.of("amount","date","cat","memo","incomeType","memoId"):Set.of("amount","date","cat","memo","memoId");
        if(!allowed.containsAll(body.keySet())) throw bad("입력 항목을 확인해 주세요.");
        long amount=BillInput.amount(body.get("amount"));
        if(amount<=0 || amount>(in?999999999L:99999999L)) throw bad("금액 범위를 확인해 주세요.");
        LocalDate date;
        try { date=LocalDate.parse(Objects.toString(body.get("date"),"")); if(date.getYear()<1 || date.getYear()>9999) throw new DateTimeException("date"); }
        catch(DateTimeException e) { throw bad("날짜를 확인해 주세요."); }
        var now=today(zone);
        if(date.isAfter(now)) throw bad("오늘 이후의 기록은 등록할 수 없어요.");
        String cat=BillInput.text(body.get("cat"),"분류",24);
        Object rawMemo=body.getOrDefault("memo","");
        if(!(rawMemo instanceof String memo) || memo.length()>100) throw bad("메모는 100자 이내로 입력해 주세요.");
        String incomeType=in?type(Objects.toString(body.get("incomeType"),"")):null;
        lock(jwt);
        boolean ledgerSalary=in && "FIXED".equals(incomeType) && ("월급".equals(cat) || categories.salaryLabel(user(jwt)).equals(cat));
        if(ledgerSalary) {
            if(id!=null) throw new ApiException(409,"월급은 마이페이지의 수입 정보에서 설정해 주세요.");
            salary.requireFirstLedgerSalary(user(jwt),date);
        }
        if(in && id!=null && salary.managed(user(jwt),id)) throw new ApiException(409,"자동 등록 월급은 계정·설정의 수입 정보에서 변경해 주세요.");
        String table=in?"incomes":"expenses";
        if(id!=null && jdbc.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE id=? AND user_id=?",Integer.class,id,user(jwt))==0) throw new ApiException(404,"기록을 찾을 수 없어요.");
        String beforeMemo=id==null?null:jdbc.queryForObject("SELECT memo FROM "+table+" WHERE id=? AND user_id=?",String.class,id,user(jwt));
        String categoryKind=in?"INCOME":"EXPENSE";
        String storedCategory = ledgerSalary ? "월급" : cat;
        var categories=jdbc.queryForList("SELECT id FROM ledger_categories WHERE kind=? AND name=?",Long.class,categoryKind,storedCategory);
        if(categories.isEmpty()) {
            jdbc.update("INSERT INTO ledger_categories(kind,name,color,sort_order) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE id=id",categoryKind,storedCategory,"#7895cb");
            categories=jdbc.queryForList("SELECT id FROM ledger_categories WHERE kind=? AND name=?",Long.class,categoryKind,storedCategory);
        }
        long category=categories.get(0);
        String dateColumn=in?"income_date":"expense_date";
        var args=new ArrayList<Object>(List.of(category,amount,java.sql.Date.valueOf(date),memo.strip()));
        if(in) args.add(incomeType);
        if(id==null) {
            args.add(user(jwt));
            jdbc.update("INSERT INTO "+table+" (category_id,amount,"+dateColumn+",memo"+(in?",income_type":"")+",user_id) VALUES (?,?,?,?"+(in?",?":"")+",?)",args.toArray());
            id=jdbc.queryForObject("SELECT MAX(id) FROM "+table+" WHERE user_id=?",Long.class,user(jwt));
        } else {
            args.add(id);args.add(user(jwt));
            jdbc.update("UPDATE "+table+" SET category_id=?,amount=?,"+dateColumn+"=?,memo=?"+(in?",income_type=?":"")+" WHERE id=? AND user_id=?",args.toArray());
        }
        String label=(in?(incomeType.equals("FIXED")?"고정 수입":"기타 수입"):"기타 지출")+" · "+date+" · "+cat;
        if(body.get("memoId")!=null) {
            var linked=memos.attach(user(jwt),kind,id.toString(),body.get("memoId").toString(),label);
            String preview=linked.body().substring(0,Math.min(100,linked.body().length()));
            jdbc.update("UPDATE "+table+" SET memo=? WHERE id=? AND user_id=?",preview,id,user(jwt));
        } else if(!Objects.equals(beforeMemo,memo.strip())) memos.save(user(jwt),kind,id.toString(),label,memo.strip());
        if (ledgerSalary) {
            salary.registerLedgerSalary(user(jwt),amount,date,now);
            salary.linkLedgerSalary(user(jwt),date,id);
        }
    }
    @DeleteMapping("/{kind}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt jwt,@PathVariable String kind,@PathVariable String id) {
        boolean in=income(kind); long key=BillInput.id(id); lock(jwt);
        if(in) salary.clearForLedgerDeletion(user(jwt),key);
        if(jdbc.update("DELETE FROM "+(in?"incomes":"expenses")+" WHERE id=? AND user_id=?",key,user(jwt))==0) throw new ApiException(404,"기록을 찾을 수 없어요.");
    }
    private ApiException bad(String message) { return new ApiException(400,message); }

    @GetMapping("/income-summary")
    public Map<String,Long> summary(@AuthenticationPrincipal Jwt jwt,@RequestParam String timeZone) {
        var now=today(timeZone); var from=YearMonth.from(now).minusMonths(11).atDay(1);
        salary.sync(user(jwt),timeZone);
        Map<String,Long> result=new LinkedHashMap<>();
        jdbc.query("SELECT income_date,amount FROM incomes WHERE user_id=? AND income_date>=? AND income_date<=?",rs->{
            String month=rs.getDate("income_date").toLocalDate().toString().substring(0,7);
            result.merge(month,rs.getLong("amount"),Long::sum);
        },user(jwt),java.sql.Date.valueOf(from),java.sql.Date.valueOf(now));
        return result;
    }
}

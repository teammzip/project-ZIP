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
import tools.jackson.databind.json.JsonMapper;

@Service
public class HomeInfoService {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final SettingsRepository settings;
    private final SettingsService settingsService;
    private final BillService bills;
    private final Clock clock;
    private final ContractPaymentChanges paymentChanges;
    private final JsonMapper json;
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    public HomeInfoService(JdbcTemplate jdbc, AuthRepository auth, SettingsRepository settings, SettingsService settingsService, BillService bills, Clock clock, JsonMapper json) {
        this.jdbc=jdbc; this.auth=auth; this.settings=settings; this.settingsService=settingsService; this.bills=bills; this.clock=clock;
        this.paymentChanges=new ContractPaymentChanges(jdbc,clock);
        this.json=json;
    }
    private void lock(long user, long session) {
        auth.lockUser(user);
        if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
    }

    @Transactional
    public HomeInfoResponse get(long user,long session) {
        lock(user,session);
        settle(user);
        return response(user);
    }

    @Transactional
    public HomeInfoResponse save(long user,long session,HomeInfoInput input) {
        lock(user,session);
        var savedZones=jdbc.query("SELECT billing_time_zone FROM home_contracts WHERE user_id=?",(rs,n)->rs.getString(1),user);
        var zone=savedZones.isEmpty() || savedZones.get(0)==null?KOREA:ZoneId.of(savedZones.get(0));
        var today=LocalDate.now(clock.withZone(zone));
        var current=YearMonth.from(today);
        if (!input.moveIn().isEmpty() && current.isBefore(YearMonth.parse(input.moveIn())))
            throw new ApiException(400,"입주 월을 확인해 주세요. 현재 월보다 뒤인 입주 월로는 저장할 수 없어요.");
        if (!input.end().isEmpty() && current.isAfter(YearMonth.parse(input.end())))
            throw new ApiException(400,"계약 종료 월을 확인해 주세요. 현재 월보다 이전인 계약 종료 월로는 저장할 수 없어요.");
        var previous=settings.read(user);
        var oldLoan=loan(user);
        settle(user);
        var oldKinds=jdbc.query("SELECT contract_kind FROM home_contracts WHERE user_id=?",(rs,n)->rs.getString(1),user);
        int oldManagementDay=!oldKinds.isEmpty() && "jeonse".equals(oldKinds.get(0))?(oldLoan==null || !oldLoan.active()?15:oldLoan.paymentDay()):previous.day();
        var contracts=jdbc.query("SELECT management_bill_id FROM home_contracts WHERE user_id=?", (rs,row)->rs.getString(1),user);
        Long managed=contracts.isEmpty() || contracts.get(0)==null ? null : Long.valueOf(contracts.get(0));
        if (managed==null) managed=jdbc.query("SELECT id FROM bill_items WHERE user_id=? AND name='관리비' AND tag='관리비' AND is_active=1 ORDER BY id", (rs,row)->rs.getLong(1),user).stream().findFirst().orElse(null);
        if (managed!=null && jdbc.queryForObject("SELECT COUNT(*) FROM bill_items WHERE id=? AND user_id=? AND is_active=1",Long.class,managed,user)==0) managed=null;
        boolean kindChanged=!oldKinds.isEmpty() && !input.kind().equals(oldKinds.get(0));
        if(managed!=null && !oldKinds.isEmpty()) {
            jdbc.update("UPDATE bill_items SET home_contract_kind=COALESCE(home_contract_kind,?) WHERE id=? AND user_id=?",oldKinds.get(0),managed,user);
            if(kindChanged) {
                // 반대 유형으로 전환한 뒤 되돌아와도 이전 예정분이 중복 합산되지 않게 취소 표시한다.
                jdbc.update("UPDATE bill_payments SET deleted_at=? WHERE bill_item_id=? AND paid_at IS NULL AND deleted_at IS NULL AND due_date>=?",
                    java.sql.Timestamp.from(clock.instant()),managed,java.sql.Date.valueOf(today));
                bills.removeFromHome(user,session,managed);
                managed=null;
                oldManagementDay="monthly".equals(input.kind())?input.rentDay():input.loan()==null?15:input.loan().day();
            }
        }
        // 계약 유형 전환: 오늘 이후 미납 예정분만 취소한다. 과거·납부 완료 기록은 유지한다.
        // 잘못 남아 있는 반대 유형의 예정분도 저장 시 함께 정리한다.
        if ("jeonse".equals(input.kind()))
            jdbc.update("DELETE FROM rent_payments WHERE user_id=? AND paid_at IS NULL AND due_date>=?",user,java.sql.Date.valueOf(today));
        else
            jdbc.update("DELETE FROM loan_interest_charges WHERE loan_id IN (SELECT id FROM housing_loans WHERE user_id=?) AND paid_at IS NULL AND charge_date>=?",user,java.sql.Date.valueOf(today));
        if (input.fee()>0) {
            if (managed==null) managed=Long.valueOf(bills.createFromHome(user,session,Map.of("name","관리비","tag","관리비","amount",input.fee())).id());
            else bills.updateFromHome(user,session,managed,Map.of("amount",input.fee()));
        } else if (managed!=null) bills.removeFromHome(user,session,managed);
        if(managed!=null) jdbc.update("UPDATE bill_items SET home_contract_kind=? WHERE id=? AND user_id=?",input.kind(),managed,user);

        settings.save(user,new SettingsRepository.Settings(BigDecimal.valueOf(input.rent(),4),input.rentDay(),input.moveIn(),input.end(),previous.on(),
            input.address()==null?previous.home():input.address(),previous.regionId(),previous.location()),false);
        if (contracts.isEmpty()) jdbc.update("INSERT INTO home_contracts(user_id,contract_kind) VALUES (?,?)",user,input.kind());
        jdbc.update("UPDATE home_contracts SET contract_kind=?,deposit=?,management_included=?,management_fee=?,contract_fee=?,management_bill_id=?,payment_effective_from=? WHERE user_id=?",
            input.kind(),input.deposit(),input.included(),input.fee(),input.contractFee(),managed,java.sql.Date.valueOf(today),user);
        // 계약 기간에 포함되는 이번 달 지출을 등록하고 이미 저장된 기록은 보존한다.
        writeLoan(user,input.loan(),oldLoan,today);
        paymentChanges.apply(user,input,previous,oldLoan,managed,oldManagementDay);
        bills.autoRegisterSavedZone(user);
        jdbc.update("UPDATE users SET housing_loan_draft=NULL WHERE id=?", user);
        return response(user);
    }

    @Transactional
    public HomeInfoResponse saveLoan(long user,long session,HomeInfoInput.Loan plan) {
        lock(user,session);
        var previous=settings.read(user);
        var homes=jdbc.query("""
            SELECT management_bill_id, management_fee, billing_time_zone
            FROM home_contracts WHERE user_id=? AND contract_kind='jeonse'
            """, (rs,row)->new LoanHome(rs.getObject("management_bill_id",Long.class),rs.getLong("management_fee"),
                rs.getString("billing_time_zone")),user);
        if (homes.isEmpty()) throw new ApiException(400,"내 집 정보에서 전세 계약을 먼저 저장해 주세요.");
        var home=homes.get(0);
        var today=LocalDate.now(clock.withZone(home.zone()==null?KOREA:ZoneId.of(home.zone())));
        var month=YearMonth.from(today);
        if (plan!=null && ((!previous.moveIn().isEmpty() && month.isBefore(YearMonth.parse(previous.moveIn())))
            || (!previous.end().isEmpty() && month.isAfter(YearMonth.parse(previous.end()))))) {
            throw new ApiException(400,"현재 날짜가 계약 기간 밖이에요. 내 집 정보를 확인해 주세요.");
        }
        var oldLoan=loan(user);
        settle(user);
        writeLoan(user,plan,oldLoan,today);
        var input=new HomeInfoInput("jeonse",0,0,previous.day(),false,home.fee(),0,
            previous.moveIn(),previous.end(),null,plan);
        int oldDay=oldLoan!=null && oldLoan.active()?oldLoan.paymentDay():15;
        paymentChanges.apply(user,input,previous,oldLoan,home.managementBill(),oldDay);
        bills.autoRegisterSavedZone(user);
        jdbc.update("UPDATE users SET housing_loan_draft=NULL WHERE id=?", user);
        return response(user);
    }

    private record LoanHome(Long managementBill,long fee,String zone) {}

    private void writeLoan(long user,HomeInfoInput.Loan plan,HomeInfoResponse.Loan existing,LocalDate today) {
        if (plan==null) {
            if (existing==null) return;
            jdbc.update("UPDATE housing_loans SET is_active=0 WHERE user_id=?",user);
            jdbc.update("DELETE FROM loan_interest_charges WHERE loan_id=? AND paid_at IS NULL AND charge_date>?",
                existing.id(),java.sql.Date.valueOf(today));
            return;
        }
        if (existing==null) {
            jdbc.update("INSERT INTO housing_loans(id,user_id,principal,annual_rate,payment_day,start_date,is_active) VALUES (?,?,?,?,?,?,1)",
                UUID.randomUUID().toString(),user,plan.principal(),plan.rate(),plan.day(),plan.start().toString());
        } else {
            String start=existing.active()?existing.startDate():plan.start().toString();
            jdbc.update("UPDATE housing_loans SET principal=?,annual_rate=?,payment_day=?,start_date=?,is_active=1 WHERE user_id=?",
                plan.principal(),plan.rate(),plan.day(),start,user);
        }
        settle(user);
    }

    private HomeInfoResponse.Loan loan(long user) {
        return jdbc.query("SELECT * FROM housing_loans WHERE user_id=?", (rs, row) ->
            new HomeInfoResponse.Loan(rs.getString("id"), Long.toString(user), rs.getLong("principal"),
                rs.getBigDecimal("annual_rate"), rs.getInt("payment_day"), rs.getDate("start_date").toLocalDate().toString(),
                rs.getBoolean("is_active")), user).stream().findFirst().orElse(null);
    }

    private void settle(long user) {
        var plan=loan(user);
        if (plan==null || !plan.active()) return;
        var homes=jdbc.query("""
            SELECT c.contract_kind,c.billing_time_zone,s.move_in_ym,s.contract_end_ym,c.payment_effective_from
            FROM home_contracts c LEFT JOIN user_settings s ON s.user_id=c.user_id WHERE c.user_id=?
            """,(rs,n)->new InterestTerm(rs.getString("contract_kind"),rs.getString("billing_time_zone"),
                rs.getString("move_in_ym"),rs.getString("contract_end_ym"),rs.getDate("payment_effective_from")==null?null:rs.getDate("payment_effective_from").toLocalDate()),user);
        if(homes.isEmpty() || !"jeonse".equals(homes.get(0).kind())) return;
        var term=homes.get(0);
        var zone=term.zone()==null?KOREA:ZoneId.of(term.zone());
        String id=plan.id();
        LocalDate start=LocalDate.parse(plan.startDate()),today=LocalDate.now(clock.withZone(zone));
        YearMonth current=YearMonth.from(today),first=YearMonth.from(start),last=current;
        if(term.effective()!=null && first.isBefore(YearMonth.from(term.effective()))) first=YearMonth.from(term.effective());
        if(term.from()!=null && first.isBefore(YearMonth.parse(term.from()))) first=YearMonth.parse(term.from());
        if(term.through()!=null && last.isAfter(YearMonth.parse(term.through()))) last=YearMonth.parse(term.through());
        var seen=new HashSet<>(jdbc.query("SELECT charge_date FROM loan_interest_charges WHERE loan_id=?",(rs,row)->YearMonth.from(rs.getDate(1).toLocalDate()),id));
        long amount=BigDecimal.valueOf(plan.principal()).multiply(plan.annualRate()).divide(BigDecimal.valueOf(1200),0,RoundingMode.HALF_UP).longValueExact();
        var pending=new ArrayList<Object[]>();
        for (YearMonth month=first;!month.isAfter(last);month=month.plusMonths(1)) {
            LocalDate date=month.atDay(Math.min(plan.paymentDay(),month.lengthOfMonth()));
            if (date.isBefore(start) || date.isAfter(today) || seen.contains(month)) continue;
            if (!month.equals(current) && term.effective()!=null && date.isBefore(term.effective())) continue;
            pending.add(new Object[]{id,java.sql.Date.valueOf(date),plan.principal(),plan.annualRate(),amount});
        }
        if (!pending.isEmpty()) jdbc.batchUpdate("INSERT INTO loan_interest_charges(loan_id,charge_date,principal,annual_rate,amount) VALUES (?,?,?,?,?)",pending);
    }

    private record InterestTerm(String kind,String zone,String from,String through,LocalDate effective) {}

    private HomeInfoResponse response(long user) {
        var responseSettings = settingsService.get(user);
        var contract = jdbc.query("SELECT * FROM home_contracts WHERE user_id=?", (rs, row) ->
            new HomeInfoResponse.Contract(rs.getString("contract_kind"), rs.getLong("deposit"),
                rs.getBoolean("management_included"), rs.getLong("management_fee"), rs.getLong("contract_fee"),
                rs.getString("management_bill_id")), user).stream().findFirst().orElse(null);
        var loan = loan(user);
        String draft = jdbc.queryForObject("SELECT housing_loan_draft FROM users WHERE id=?", String.class, user);
        var loanDraft = draft == null ? null : json.readValue(draft, HomeInfoResponse.LoanDraft.class);
        var charges = jdbc.query("""
            SELECT c.* FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id
            WHERE l.user_id=? ORDER BY charge_date
            """, (rs, row) -> {
            String date = rs.getDate("charge_date").toLocalDate().toString();
            String id = rs.getString("loan_id");
            return new HomeInfoResponse.InterestCharge(id + ":" + date.substring(0, 7), id, Long.toString(user), date,
                rs.getLong("amount"), rs.getLong("principal"), rs.getBigDecimal("annual_rate"));
        }, user);
        var managementBill = contract == null || contract.managementBillId() == null ? null
            : bills.currentActive(user, Long.parseLong(contract.managementBillId()));
        return new HomeInfoResponse(responseSettings, contract, loan, loanDraft, charges, managementBill);
    }
}

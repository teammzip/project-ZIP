package com.zip.backend.bills;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.sql.Timestamp;
import java.time.*;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Payment status only: never changes amounts, deadlines or contract terms. */
@Service
public class BillSettlementService {
    private final JdbcTemplate jdbc;
    private final BillRepository bills;
    private final AuthRepository auth;
    private final Clock clock;
    public BillSettlementService(JdbcTemplate jdbc,BillRepository bills,AuthRepository auth,Clock clock) {
        this.jdbc=jdbc; this.bills=bills; this.auth=auth; this.clock=clock;
    }
    private void lock(long user,long session) {
        auth.lockUser(user);
        if(!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
    }
    private YearMonth month(String value,String zone) {
        var month=BillInput.month(value);
        try {
            if(month.isAfter(YearMonth.from(clock.instant().atZone(ZoneId.of(zone))))) throw BillInput.bad("미래 월의 납부 상태는 변경할 수 없어요.");
        } catch(DateTimeException | NullPointerException e) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        return month;
    }
    @Transactional
    public void payment(long user,long session,String id,String value,String zone,Map<String,Object> body) {
        if(!body.keySet().equals(java.util.Set.of("paid")) || !(body.get("paid") instanceof Boolean)) throw BillInput.bad("납부 여부 paid만 보내 주세요.");
        var month=month(value,zone); lock(user,session);
        boolean paid=(Boolean)body.get("paid");
        var at=Timestamp.from(clock.instant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
        int count;
        if(id.equals("rent:"+month)) {
            var home=bills.housing(user);
            if(home==null || !"monthly".equals(home.kind())) throw new ApiException(404,"현재 계약 유형의 납부 기록이 아니에요.");
            count=jdbc.update("UPDATE rent_payments SET paid_at="+(paid?"COALESCE(paid_at,?)":"NULL")+" WHERE user_id=? AND period_ym=?",
                paid?new Object[]{at,user,month.toString()}:new Object[]{user,month.toString()});
        } else if(id.startsWith("interest:") && id.endsWith(":"+month)) {
            if(id.length()<18) throw BillInput.bad("납부 항목을 확인해 주세요.");
            var home=bills.housing(user);
            if(home==null || !"jeonse".equals(home.kind())) throw new ApiException(404,"현재 계약 유형의 납부 기록이 아니에요.");
            String loan=id.substring(9,id.length()-8);
            count=jdbc.update("UPDATE loan_interest_charges SET paid_at="+(paid?"COALESCE(paid_at,?)":"NULL")
                +" WHERE loan_id=? AND charge_date>=? AND charge_date<? AND loan_id IN (SELECT id FROM housing_loans WHERE user_id=?)",
                paid?new Object[]{at,loan,java.sql.Date.valueOf(month.atDay(1)),java.sql.Date.valueOf(month.plusMonths(1).atDay(1)),user}
                    :new Object[]{loan,java.sql.Date.valueOf(month.atDay(1)),java.sql.Date.valueOf(month.plusMonths(1).atDay(1)),user});
        } else {
            long itemId=BillInput.id(id);
            var item=bills.find(user,itemId);
            var home=bills.housing(user);
            if(item.homeContractKind()!=null && (home==null || !item.homeContractKind().equals(home.kind()))) throw new ApiException(404,"현재 계약 유형의 납부 기록이 아니에요.");
            var existing=bills.payment(itemId,month);
            if(existing==null || existing.deletedAt()!=null) throw new ApiException(404,"선택한 월에 등록된 기록만 납부 처리할 수 있어요.");
            count=jdbc.update("UPDATE bill_payments SET paid_at="+(paid?"COALESCE(paid_at,?)":"NULL")+" WHERE bill_item_id=? AND period_ym=? AND deleted_at IS NULL",
                paid?new Object[]{at,itemId,month.toString()}:new Object[]{itemId,month.toString()});
            if(!paid && item.terminationDate()!=null) {
                jdbc.update("UPDATE bill_payments SET deleted_at=? WHERE bill_item_id=? AND period_ym=? AND paid_at IS NULL AND deleted_at IS NULL AND (due_date>=? OR (due_date IS NULL AND period_ym>=?))",
                    at,itemId,month.toString(),java.sql.Date.valueOf(item.terminationDate()),YearMonth.from(item.terminationDate()).toString());
            }
            count=1; // Existing row was checked under the user's transaction lock.
        }
        // MySQL may report zero for an idempotent update: distinguish a missing record via a read below.
        if(count==0) {
            boolean exists;
            if(id.equals("rent:"+month)) exists=bills.rent(user,month)!=null;
            else if(id.startsWith("interest:")) exists=bills.interest(user,month).stream().anyMatch(row->id.equals("interest:"+row.id()+":"+month));
            else { var row=bills.payment(BillInput.id(id),month); exists=row!=null && row.deletedAt()==null; }
            if(!exists) throw new ApiException(404,"선택한 월에 등록된 기록만 납부 처리할 수 있어요.");
        }
    }

    @Transactional
    public void terminate(long user,long session,long id,String zone,Map<String,Object> body) {
        if(!body.keySet().equals(java.util.Set.of("effectiveDate"))) throw BillInput.bad("해지 적용일을 입력해 주세요.");
        var date=BillInput.dueDate(body.get("effectiveDate"));
        LocalDate today;
        try { today=LocalDate.now(clock.withZone(ZoneId.of(zone))); }
        catch(DateTimeException | NullPointerException e) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        if(date.isBefore(today)) throw BillInput.bad("해지 적용일은 오늘 이후로 입력해 주세요.");
        lock(user,session);
        var item=bills.find(user,id);
        if(bills.managed(user,id)) throw new ApiException(409,"계약 관리비의 변경·종료는 내 집 정보에서 처리해 주세요.");
        if(!item.active()) throw new ApiException(409,"이미 해지된 항목이에요.");
        if(item.terminationDate()!=null) {
            if(item.terminationDate().equals(date)) return;
            throw new ApiException(409,"이미 해지일이 지정된 항목이에요.");
        }
        jdbc.update("UPDATE bill_items SET termination_date=? WHERE id=? AND user_id=?",java.sql.Date.valueOf(date),id,user);
        // 월별 기록 삭제와 구분하여 해지 이후 미납 예정분만 취소한다.
        jdbc.update("UPDATE bill_payments SET deleted_at=? WHERE bill_item_id=? AND paid_at IS NULL AND deleted_at IS NULL AND (due_date>=? OR (due_date IS NULL AND period_ym>=?))",
            Timestamp.from(clock.instant()),id,java.sql.Date.valueOf(date),YearMonth.from(date).toString());
    }
}

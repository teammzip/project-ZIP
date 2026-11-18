package com.zip.backend.settings;

import java.math.*;
import java.time.*;
import java.sql.Date;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/** Called while the home save owns the user's transaction lock. Paid and past-due snapshots remain immutable. */
public class ContractPaymentChanges {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public ContractPaymentChanges(JdbcTemplate jdbc,Clock clock) { this.jdbc=jdbc; this.clock=clock; }

    private static LocalDate date(YearMonth month,int day) { return month.atDay(Math.min(day,month.lengthOfMonth())); }
    private static boolean within(HomeInfoInput home,YearMonth month) {
        return (home.moveIn().isEmpty() || !month.isBefore(YearMonth.parse(home.moveIn())))
            && (home.end().isEmpty() || !month.isAfter(YearMonth.parse(home.end())));
    }

    public void apply(long user,HomeInfoInput input,SettingsRepository.Settings previous,Map<String,Object> oldLoan,Long managed,long oldFee,int oldManagementDay) {
        var zones=jdbc.query("SELECT billing_time_zone FROM home_contracts WHERE user_id=?",(rs,n)->rs.getString(1),user);
        String zone=zones.isEmpty()?null:zones.get(0);
        LocalDate today=LocalDate.now(clock.withZone(zone==null?ZoneId.of("Asia/Seoul"):ZoneId.of(zone)));
        if("monthly".equals(input.kind())) {
            var rows=jdbc.query("SELECT period_ym,due_date,amount FROM rent_payments WHERE user_id=? AND paid_at IS NULL",
                (rs,n)->new RentMonth(YearMonth.parse(rs.getString(1)),rs.getDate(2)==null?null:rs.getDate(2).toLocalDate(),rs.getLong(3)),user);
            for(var row:rows) {
                var oldDue=row.due()==null?date(row.month(),previous.day()):row.due();
                if(oldDue.isBefore(today) || !within(input,row.month())) continue;
                var due=date(row.month(),input.rentDay());
                // 새 반복 납부일이 이번 달에 이미 지났어도 남아 있는 예정 건의 금액은 갱신한다.
                if(due.isBefore(today)) due=oldDue;
                long amount=input.rent();
                jdbc.update("UPDATE rent_payments SET amount=?,due_date=? WHERE user_id=? AND period_ym=? AND paid_at IS NULL",amount,Date.valueOf(due),user,row.month().toString());
            }
        }
        int managementDay="monthly".equals(input.kind())?input.rentDay():input.loan()==null?15:input.loan().day();
        if(managed!=null) {
            var rows=jdbc.query("SELECT period_ym,due_date,amount FROM bill_payments WHERE bill_item_id=? AND paid_at IS NULL AND deleted_at IS NULL",
                (rs,n)->new RentMonth(YearMonth.parse(rs.getString(1)),rs.getDate(2)==null?null:rs.getDate(2).toLocalDate(),rs.getLong(3)),managed);
            for(var row:rows) {
                var oldDue=row.due()==null?date(row.month(),oldManagementDay):row.due();
                if(oldDue.isBefore(today) || !within(input,row.month())) continue;
                var due=date(row.month(),managementDay);
                if(due.isBefore(today)) due=oldDue;
                jdbc.update("UPDATE bill_payments SET amount=?,due_date=? WHERE bill_item_id=? AND period_ym=? AND paid_at IS NULL AND deleted_at IS NULL",input.fee(),Date.valueOf(due),managed,row.month().toString());
            }
        }
        var loan=input.loan();
        if("jeonse".equals(input.kind()) && loan!=null && oldLoan!=null &&
            (((Number)oldLoan.get("principal")).longValue()!=loan.principal() || ((BigDecimal)oldLoan.get("annualRate")).compareTo(loan.rate())!=0 || ((Number)oldLoan.get("paymentDay")).intValue()!=loan.day())) {
            String id=(String)oldLoan.get("id");
            long amount=BigDecimal.valueOf(loan.principal()).multiply(loan.rate()).divide(BigDecimal.valueOf(1200),0,RoundingMode.HALF_UP).longValueExact();
            var dates=jdbc.query("SELECT charge_date FROM loan_interest_charges WHERE loan_id=? AND paid_at IS NULL AND charge_date>=?",(rs,n)->rs.getDate(1).toLocalDate(),id,Date.valueOf(today));
            for(var oldDue:dates) {
                var month=YearMonth.from(oldDue);
                if(!within(input,month)) continue;
                var due=date(month,loan.day());
                if(due.isBefore(today)) continue;
                if(due.isBefore(loan.start())) continue;
                jdbc.update("UPDATE loan_interest_charges SET principal=?,annual_rate=?,amount=?,charge_date=? WHERE loan_id=? AND charge_date=? AND paid_at IS NULL",
                    loan.principal(),loan.rate(),amount,Date.valueOf(due),id,Date.valueOf(oldDue));
            }
        }
    }
    private record RentMonth(YearMonth month,LocalDate due,long amount) {}
}

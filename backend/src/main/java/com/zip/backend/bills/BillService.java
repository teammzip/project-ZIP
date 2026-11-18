package com.zip.backend.bills;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BillService {
    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private final BillRepository repository;
    private final AuthRepository auth;
    private final Clock clock;
    public BillService(BillRepository repository, AuthRepository auth, Clock clock) {
        this.repository = repository; this.auth = auth; this.clock = clock;
    }

    private YearMonth currentMonth() { return YearMonth.from(clock.instant().atZone(KOREA)); }

    /** 조회 범위와 월 전환은 요청한 지역 시간대로 계산하고 실제 시각은 서버 Clock을 사용한다. */
    @Transactional(readOnly = true)
    public Map<String, Object> monthly(long userId, YearMonth month, String timeZone) {
        ZoneId zone;
        try { zone = ZoneId.of(timeZone); }
        catch (RuntimeException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        Instant asOf = clock.instant();
        YearMonth current = YearMonth.from(asOf.atZone(zone));
        if (month.isAfter(current)) throw BillInput.bad("미래 월은 조회할 수 없어요.");
        var start = month.atDay(1).atStartOfDay(zone).toInstant();
        var through = month.equals(current) ? asOf : month.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant().minusNanos(1);
        var housing = repository.housing(userId);
        var effective=repository.paymentEffectiveFrom(userId);
        boolean outside=housing!=null && ((housing.moveIn()!=null && month.isBefore(YearMonth.parse(housing.moveIn())))
            || (housing.end()!=null && month.isAfter(YearMonth.parse(housing.end()))));
        var items = repository.list(userId, month).stream()
            .filter(row -> row.item().homeContractKind()==null || (housing!=null && row.item().homeContractKind().equals(housing.kind())))
            .filter(row -> row.payment()!=null || housing==null || housing.managementId()==null || row.item().id()!=housing.managementId()
                || effective==null || !repository.managementDue(userId,month,housing).isBefore(effective))
            .filter(row -> row.payment()!=null || housing==null || (!housing.included() && !outside)
                || housing.managementId()==null || row.item().id()!=housing.managementId())
            .filter(row -> !row.item().createdAt().isAfter(asOf))
            .filter(row -> row.payment() != null || (row.item().active() && month.equals(current)
                && !month.isBefore(YearMonth.from(row.item().createdAt().atZone(zone)))))
            .map(row -> {
                var payment = row.payment();
                if (payment != null && payment.paidAt() != null && payment.paidAt().isAfter(asOf)) payment = new BillRepository.Payment(payment.amount(), null, payment.dueDate(), payment.memo());
                var entry=response(row.item(), payment, month);
                entry.put("homeManaged", row.item().homeContractKind()!=null || (housing!=null && housing.managementId()!=null && row.item().id()==housing.managementId()));
                return entry;
            }).toList();
        var result = new LinkedHashMap<String, Object>();
        result.put("month", month.toString()); result.put("currentMonth", current.toString()); result.put("timeZone", zone.getId());
        result.put("periodFrom", start.atZone(zone).toOffsetDateTime().toString());
        result.put("periodThrough", through.atZone(zone).toOffsetDateTime().toString());
        result.put("queriedAt", asOf.atZone(zone).toOffsetDateTime().toString());
        result.put("items", items);
        result.put("contractKind", housing==null?null:housing.kind());
        result.put("managementIncluded", housing!=null && housing.included());
        var contractPeriod = new LinkedHashMap<String,Object>();
        contractPeriod.put("from", housing==null?null:housing.moveIn());
        contractPeriod.put("through", housing==null?null:housing.end());
        contractPeriod.put("outside", outside);
        contractPeriod.put("currentOutside", housing!=null && ((housing.moveIn()!=null && current.isBefore(YearMonth.parse(housing.moveIn())))
            || (housing.end()!=null && current.isAfter(YearMonth.parse(housing.end())))));
        result.put("contractPeriod", contractPeriod);
        result.put("housingItems", housingItems(userId,month,current,asOf,housing));
        return result;
    }

    private List<Map<String,Object>> housingItems(long user, YearMonth month, YearMonth current, Instant asOf, BillRepository.Housing housing) {
        var rows=new java.util.ArrayList<Map<String,Object>>();
        // 현재 선택한 계약 유형으로 조회를 통일한다. 반대 유형의 과거 기록은 DB에 보존한다.
        boolean monthly=housing!=null && "monthly".equals(housing.kind());
        boolean jeonse=housing!=null && "jeonse".equals(housing.kind());
        var effective=repository.paymentEffectiveFrom(user);
        var rentDue=month.atDay(Math.min(housing==null?15:housing.rentDay(),month.lengthOfMonth()));
        var rent=monthly?repository.rent(user,month):null;
        boolean inTerm=housing!=null && (housing.moveIn()==null || month.compareTo(YearMonth.parse(housing.moveIn()))>=0)
            && (housing.end()==null || month.compareTo(YearMonth.parse(housing.end()))<=0);
        if(rent!=null || (month.equals(current) && inTerm && monthly && housing.rent()>0 && (effective==null || !rentDue.isBefore(effective)))) {
            var paid=rent==null?null:rent.paidAt();
            if(paid!=null && paid.isAfter(asOf)) paid=null;
            // 과거 계약의 납부일/관리비 포함 여부는 현재 설정으로 추정하지 않는다.
            var date=rent!=null && rent.dueDate()!=null?rent.dueDate():housing==null || !month.equals(current)?null:month.atDay(Math.min(housing.rentDay(),month.lengthOfMonth()));
            rows.add(housingRow("rent:"+month,"월세"+(housing!=null && month.equals(current) && housing.included()?" · 관리비 포함":""),"월세",
                rent==null?housing.rent():rent.amount(),date,paid,rent!=null,"rent",rent==null?"계약 기준 예정 금액":"저장된 월세 기록"));
        }
        var interest=jeonse?repository.interest(user,month):java.util.List.<BillRepository.Interest>of();
        for(var charge:interest) rows.add(housingRow("interest:"+charge.id()+":"+month,"전세 대출 이자","대출 이자",
            charge.amount(),charge.date(),charge.paidAt()!=null && !charge.paidAt().isAfter(asOf)?charge.paidAt():null,true,"interest","대출 이자 기록"));
        if(interest.isEmpty() && month.equals(current) && inTerm && "jeonse".equals(housing.kind())) {
            var estimate=repository.expectedInterest(user,month);
            if(estimate!=null && (effective==null || !estimate.date().isBefore(effective))) rows.add(housingRow("interest:"+estimate.id()+":"+month,"전세 대출 이자","대출 이자",
                estimate.amount(),estimate.date(),null,false,"interest","대출 조건 기준 예정 금액 · 실제 납부 확인 전"));
        }
        return rows;
    }
    private Map<String,Object> housingRow(String id,String name,String tag,long amount,java.time.LocalDate due,Instant paid,
        boolean snapshot,String source,String memo) {
        var row=new LinkedHashMap<String,Object>();
        row.put("id",id); row.put("name",name); row.put("tag",tag); row.put("amount",amount); row.put("defaultAmount",amount);
        row.put("paid",paid!=null); row.put("paidAt",paid==null?null:paid.toString()); row.put("dueDate",due==null?null:due.toString());
        row.put("month",due==null?id.substring(id.length()-7):YearMonth.from(due).toString());
        row.put("active",true); row.put("snapshot",snapshot); row.put("source",source); row.put("memo",memo);
        return row;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> currentActive(long userId, long id) {
        var month = currentMonth();
        var row = repository.activeRow(userId, id, month);
        return row == null ? null : response(row.item(), row.payment(), month);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(long userId, YearMonth month) {
        YearMonth current = currentMonth();
        var home=repository.housing(userId);
        return repository.list(userId, month).stream()
            .filter(row -> row.item().homeContractKind()==null || (home!=null && row.item().homeContractKind().equals(home.kind())))
            .filter(row -> row.payment() != null || (row.item().active() && !month.isBefore(current)
                && !month.isBefore(YearMonth.from(row.item().createdAt().atZone(KOREA)))))
            .map(row -> response(row.item(), row.payment(), month)).toList();
    }

    private void lock(long userId, long sessionId) {
        auth.lockUser(userId);
        if (!auth.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
    }

    @Transactional
    public void autoRegister(long userId,long sessionId,String timeZone) {
        lock(userId,sessionId);
        autoRegisterForUser(userId,timeZone);
    }
    @Transactional
    public void autoRegisterForUser(long userId,String timeZone) {
        ZoneId zone;
        try { zone=ZoneId.of(timeZone); } catch(RuntimeException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        auth.lockUser(userId);
        repository.rememberZone(userId,zone.getId());
        repository.autoRegister(userId,YearMonth.from(clock.instant().atZone(zone)));
    }
    @Transactional
    public void autoRegisterSavedZone(long userId) {
        auth.lockUser(userId);
        var zone=repository.savedZone(userId);
        if(zone!=null) autoRegisterForUser(userId,zone);
    }
    private void requireManual(long user,long id) {
        if(repository.managed(user,id)) throw new ApiException(409,"계약 관리비는 내 집 정보에서만 수정할 수 있어요.");
    }

    private void requireContractMonth(long user,YearMonth month) {
        var home=repository.housing(user);
        String savedZone=repository.savedZone(user);
        var current=YearMonth.from(clock.instant().atZone(savedZone==null?KOREA:ZoneId.of(savedZone)));
        if(home!=null && home.moveIn()!=null && (current.isBefore(YearMonth.parse(home.moveIn())) || month.isBefore(YearMonth.parse(home.moveIn()))))
            throw BillInput.bad("입주 월을 확인해 주세요. 입주 월 이전에는 고정 지출을 저장할 수 없어요.");
        if(home!=null && home.end()!=null && current.isAfter(YearMonth.parse(home.end())))
            throw BillInput.bad("계약 종료 월을 확인해 주세요. 현재 날짜가 계약 기간 밖이므로 저장할 수 없어요.");
        if(home!=null && ((home.moveIn()!=null && month.isBefore(YearMonth.parse(home.moveIn())))
            || (home.end()!=null && month.isAfter(YearMonth.parse(home.end())))))
            throw BillInput.bad("계약 기간 밖에는 고정 지출을 저장할 수 없어요. 내 집 정보의 계약 기간을 확인해 주세요.");
    }

    private YearMonth writableMonth(String month, String timeZone) {
        var value = BillInput.month(month);
        try {
            if (value.isAfter(YearMonth.from(clock.instant().atZone(ZoneId.of(timeZone)))))
                throw BillInput.bad("미래 월에는 등록할 수 없어요.");
        } catch (java.time.DateTimeException | NullPointerException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        return value;
    }

    @Transactional
    public Map<String, Object> registerMonthly(long userId, long sessionId, String monthValue, String timeZone, Map<String, Object> body) {
        var month = writableMonth(monthValue, timeZone);
        BillInput.monthly(body, true); lock(userId, sessionId);
        requireDueDate(body, timeZone);
        requireContractMonth(userId,month);
        requireContractMonth(userId,YearMonth.from(BillInput.dueDate(body.get("dueDate"))));
        String tag = BillInput.text(body.get("tag"), "분류", 24);
        String name = body.containsKey("name") ? BillInput.text(body.get("name"), "이름", 30) : tag;
        long amount = BillInput.amount(body.get("amount"));
        Long id = repository.matchingUnregistered(userId, name, tag, month);
        if (id != null) requireManual(userId,id);
        if (id == null) id = repository.create(userId, name, amount, tag, clock.instant());
        if (repository.payment(id, month) != null) throw new ApiException(409, "이 월에 이미 등록된 항목이에요. 수정 버튼을 이용해 주세요.");
        repository.insertPayment(id, month, amount, null);
        repository.monthlyDetails(id, month, amount, BillInput.dueDate(body.get("dueDate")));
        if (body.containsKey("memo")) repository.monthlyMemo(id,month,BillInput.memo(body.get("memo")));
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public Map<String, Object> updateMonthly(long userId, long sessionId, long id, String monthValue, String timeZone, Map<String, Object> body) {
        var month = writableMonth(monthValue, timeZone);
        BillInput.monthly(body, false); lock(userId, sessionId);
        var item = repository.find(userId, id);
        requireManual(userId,id);
        var existing=repository.payment(id,month);
        if (existing == null || existing.deletedAt() != null) throw new ApiException(404, "선택한 월에 등록한 후 수정해 주세요.");
        if(existing.paidAt()!=null) throw new ApiException(409,"납부 완료 기록은 변경할 수 없어요.");
        requireContractMonth(userId,month);
        requireContractMonth(userId,YearMonth.from(BillInput.dueDate(body.get("dueDate"))));
        if (!BillInput.dueDate(body.get("dueDate")).equals(existing.dueDate())) requireDueDate(body,timeZone);
        repository.monthlyDetails(id, month, BillInput.amount(body.get("amount")), BillInput.dueDate(body.get("dueDate")));
        if (body.containsKey("memo")) repository.monthlyMemo(id,month,BillInput.memo(body.get("memo")));
        if(existing.amount()!=BillInput.amount(body.get("amount")) || !java.util.Objects.equals(existing.dueDate(),BillInput.dueDate(body.get("dueDate")))) {
            repository.propagateMonthly(userId,id,month,BillInput.amount(body.get("amount")),BillInput.dueDate(body.get("dueDate")),
                java.time.LocalDate.ofInstant(clock.instant(),ZoneId.of(timeZone)),existing.amount()!=BillInput.amount(body.get("amount")),
                !java.util.Objects.equals(existing.dueDate(),BillInput.dueDate(body.get("dueDate"))));
            repository.update(userId,id,item.name(),BillInput.amount(body.get("amount")),item.tag());
        }
        return response(repository.find(userId,id), repository.payment(id, month), month);
    }

    @Transactional
    public void deleteMonthly(long userId, long sessionId, long id, String monthValue, String timeZone) {
        var month = writableMonth(monthValue, timeZone);
        lock(userId, sessionId);
        repository.find(userId, id);
        requireManual(userId,id);
        var payment = repository.payment(id, month);
        if (payment == null) throw new ApiException(404, "선택한 월에 등록된 기록이 없어요.");
        if (payment.deletedAt() == null) repository.deleteMonthly(id, month, clock.instant());
    }

    @Transactional
    public Map<String, Object> registerPhoto(long userId, long sessionId, String month, String timeZone, String hash, Map<String, Object> body) {
        return registerPhoto(userId,sessionId,month,timeZone,hash,null,body);
    }

    private void requireDueDate(Map<String,Object> body, String timeZone) {
        var today=java.time.LocalDate.ofInstant(clock.instant(),ZoneId.of(timeZone));
        if (BillInput.dueDate(body.get("dueDate")).isBefore(today)) throw BillInput.bad("납부 기한은 해당 시간대의 오늘 이후로 입력해 주세요.");
    }

    @Transactional
    public Map<String, Object> registerPhoto(long userId, long sessionId, String month, String timeZone, String hash, String documentHash, Map<String, Object> body) {
        lock(userId, sessionId);
        if (repository.photoImport(userId, hash) != null) throw new ApiException(409, "이미 등록한 사진이에요. 등록된 내역을 확인해 주세요.");
        if (documentHash != null && repository.documentExists(userId,documentHash)) throw new ApiException(409,"이미 등록된 고지서예요. 등록된 내역을 수정해 주세요.");
        var result = registerMonthly(userId, sessionId, month, timeZone, body);
        repository.rememberPhoto(userId, hash, Long.parseLong((String)result.get("id")));
        if (documentHash != null) repository.rememberDocument(userId,documentHash,Long.parseLong((String)result.get("id")));
        return result;
    }

    @Transactional
    public Map<String, Object> create(long userId, long sessionId, Map<String, Object> body) {
        BillInput.item(body, true); lock(userId, sessionId);
        String name = BillInput.text(body.get("name"), "이름", 30), tag = BillInput.text(body.get("tag"), "분류", 24);
        checkDuplicate(userId, name, tag, 0);
        long amount = BillInput.amount(body.get("amount"));
        var now = clock.instant();
        var month = YearMonth.from(now.atZone(KOREA));
        requireContractMonth(userId,month);
        long id = repository.create(userId, name, amount, tag, now);
        repository.insertPayment(id, month, amount, null);
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public Map<String,Object> createFromHome(long userId,long sessionId,Map<String,Object> body) {
        BillInput.item(body,true); lock(userId,sessionId);
        String name=BillInput.text(body.get("name"),"이름",30),tag=BillInput.text(body.get("tag"),"분류",24);
        checkDuplicate(userId,name,tag,0);
        long id=repository.create(userId,name,BillInput.amount(body.get("amount")),tag,clock.instant());
        return response(repository.find(userId,id),null,currentMonth());
    }

    @Transactional
    public Map<String, Object> update(long userId, long sessionId, long id, Map<String, Object> body) {
        lock(userId,sessionId);
        requireContractMonth(userId,currentMonth());
        requireManual(userId,id);
        freezeCurrent(active(repository.find(userId,id)),currentMonth());
        var result=updateFromHome(userId,sessionId,id,body);
        if(body.containsKey("amount")) {
            var zone=repository.savedZone(userId);
            repository.propagateAmount(userId,id,BillInput.amount(body.get("amount")),java.time.LocalDate.ofInstant(clock.instant(),zone==null?KOREA:ZoneId.of(zone)));
            return response(repository.find(userId,id),repository.payment(id,currentMonth()),currentMonth());
        }
        return result;
    }

    @Transactional
    public Map<String,Object> updateFromHome(long userId,long sessionId,long id,Map<String,Object> body) {
        BillInput.item(body, false); lock(userId, sessionId);
        var item = active(repository.find(userId, id));
        String name = body.containsKey("name") ? BillInput.text(body.get("name"), "이름", 30) : item.name();
        String tag = body.containsKey("tag") ? BillInput.text(body.get("tag"), "분류", 24) : item.tag();
        long amount = body.containsKey("amount") ? BillInput.amount(body.get("amount")) : item.defaultAmount();
        checkDuplicate(userId, name, tag, id);
        var zone=repository.savedZone(userId);
        var month = YearMonth.from(clock.instant().atZone(zone==null?KOREA:ZoneId.of(zone)));
        // Existing monthly snapshots stay unchanged; home save registers only after the new term is saved.
        repository.update(userId, id, name, amount, tag);
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public Map<String, Object> pay(long userId, long sessionId, long id, YearMonth month, Map<String, Object> body) {
        BillInput.payment(body); lock(userId, sessionId);
        if(body.containsKey("amount")) requireManual(userId,id);
        var current = currentMonth();
        if (month.isAfter(current)) throw BillInput.bad("미래 월의 납부 기록은 저장할 수 없어요.");
        var item = repository.find(userId, id);
        var payment = repository.payment(id, month);
        requireContractMonth(userId,month);
        if (payment != null && payment.deletedAt() != null) throw new ApiException(404, "삭제된 월별 기록이에요.");
        if(payment!=null && payment.paidAt()!=null && body.containsKey("amount") && BillInput.amount(body.get("amount"))!=payment.amount())
            throw new ApiException(409,"납부 완료 기록의 금액은 변경할 수 없어요.");
        if (payment == null && !item.active()) throw new ApiException(404, "해지된 항목에 새 청구를 만들 수 없어요.");
        if (payment == null && month.isBefore(current) && !body.containsKey("amount")) {
            throw BillInput.bad("기록이 없는 과거 월은 당시 금액 amount를 함께 입력해 주세요.");
        }
        long amount = body.containsKey("amount") ? BillInput.amount(body.get("amount")) : payment == null ? item.defaultAmount() : payment.amount();
        java.time.Instant paidAt = payment == null ? null : payment.paidAt();
        if (body.containsKey("paid")) {
            if (Boolean.TRUE.equals(body.get("paid"))) { if (paidAt == null) paidAt = clock.instant(); }
            else paidAt = null;
        }
        if (payment == null) repository.insertPayment(id, month, amount, paidAt);
        else repository.updatePayment(id, month, amount, paidAt);
        return response(item, repository.payment(id, month), month);
    }

    @Transactional
    public void remove(long userId, long sessionId, long id) {
        lock(userId,sessionId);
        requireManual(userId,id);
        var item=repository.find(userId,id);
        if(item.active()) freezeCurrent(item,currentMonth());
        removeFromHome(userId,sessionId,id);
    }
    @Transactional
    public void removeFromHome(long userId,long sessionId,long id) {
        lock(userId, sessionId);
        var item = repository.find(userId, id);
        if (item.active()) repository.deactivate(userId, id);
    }

    private void freezeCurrent(BillRepository.Item item, YearMonth month) {
        // Preserve this month's previous default before future defaults change or an item is stopped.
        if (repository.payment(item.id(), month) == null) repository.insertPayment(item.id(), month, item.defaultAmount(), null);
    }

    private void checkDuplicate(long userId, String name, String tag, long id) {
        if (repository.duplicate(userId, name, tag, id)) throw new ApiException(409, "같은 이름·분류의 고정 지출 항목이 이미 있어요.");
    }

    private BillRepository.Item active(BillRepository.Item item) {
        if (!item.active()) throw new ApiException(404, "해지된 항목은 수정할 수 없어요.");
        return item;
    }

    private Map<String, Object> response(BillRepository.Item item, BillRepository.Payment payment, YearMonth month) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(item.id())); result.put("name", item.name()); result.put("tag", item.tag());
        result.put("amount", payment == null ? item.defaultAmount() : payment.amount());
        result.put("paid", payment != null && payment.paidAt() != null);
        result.put("paidAt", payment == null || payment.paidAt() == null ? null : payment.paidAt().toString());
        result.put("month", month.toString()); result.put("defaultAmount", item.defaultAmount());
        result.put("active", item.active()); result.put("snapshot", payment != null);
        result.put("dueDate", payment == null || payment.dueDate() == null ? null : payment.dueDate().toString());
        result.put("memo", payment == null || payment.memo() == null ? "" : payment.memo());
        return result;
    }
}

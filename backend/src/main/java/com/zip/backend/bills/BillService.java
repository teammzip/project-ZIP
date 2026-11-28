package com.zip.backend.bills;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    public BillResponse.Monthly monthly(long userId, YearMonth month, String timeZone) {
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
        boolean outside=housing!=null && !housing.includes(month);
        boolean canRegister=housing!=null && housing.canRegister(month,current,effective);
        var rows=repository.list(userId,month);
        boolean managementRecorded=housing!=null && rows.stream().anyMatch(row -> row.payment()!=null && housing.manages(row.item()));
        var items = rows.stream()
            .filter(row -> row.payment()!=null || row.item().terminationDate()==null || asOf.atZone(zone).toLocalDate().isBefore(row.item().terminationDate()))
            .filter(row -> row.item().homeContractKind()==null || (housing!=null && row.item().homeContractKind().equals(housing.kind())))
            .filter(row -> !row.item().createdAt().isAfter(asOf))
            .filter(row -> {
                if (row.payment()!=null) return true;
                if (!row.item().active()) return false;
                if (housing!=null && housing.manages(row.item())) {
                    return canRegister && !managementRecorded && !housing.included() && housing.managementId()!=null
                        && housing.managementId()==row.item().id() && row.item().defaultAmount()>0;
                }
                return month.equals(current) && !month.isBefore(YearMonth.from(row.item().createdAt().atZone(zone)));
            })
            .map(row -> {
                var item = row.item();
                var payment = row.payment();
                if (payment != null && payment.paidAt() != null && payment.paidAt().isAfter(asOf)) payment = new BillRepository.Payment(payment.amount(), null, payment.dueDate(), payment.memo());
                boolean active = item.active() && (item.terminationDate() == null || asOf.atZone(zone).toLocalDate().isBefore(item.terminationDate()));
                boolean management = housing != null && housing.manages(item);
                LocalDate estimatedDueDate = payment == null && management ? repository.managementDue(userId, month, housing) : null;
                return response(item, payment, month, active, item.homeContractKind() != null || management, estimatedDueDate);
            }).toList();
        var contractPeriod = new BillResponse.ContractPeriod(housing == null ? null : housing.moveIn(),
            housing == null ? null : housing.end(), outside, housing != null && !housing.includes(current));
        return new BillResponse.Monthly(month.toString(), current.toString(), zone.getId(),
            start.atZone(zone).toOffsetDateTime().toString(), through.atZone(zone).toOffsetDateTime().toString(),
            asOf.atZone(zone).toOffsetDateTime().toString(), housing == null ? null : housing.kind(),
            housing != null && housing.included(), contractPeriod, housingItems(userId, month, current, asOf, housing, canRegister), items);
    }

    private List<BillResponse.HousingItem> housingItems(long user, YearMonth month, YearMonth current, Instant asOf, BillRepository.Housing housing, boolean canRegister) {
        var rows = new ArrayList<BillResponse.HousingItem>();
        // 현재 선택한 계약 유형으로 조회를 통일한다. 반대 유형의 과거 기록은 DB에 보존한다.
        boolean monthly=housing!=null && "monthly".equals(housing.kind());
        boolean jeonse=housing!=null && "jeonse".equals(housing.kind());
        var rent=monthly?repository.rent(user,month):null;
        if(rent!=null || (monthly && canRegister && housing.rent()>0)) {
            var paid=rent==null?null:rent.paidAt();
            if(paid!=null && paid.isAfter(asOf)) paid=null;
            // 기존 기록에 기한이 없으면 현재 설정으로 과거 기한을 덮어 쓰지 않는다.
            var date=rent!=null && rent.dueDate()!=null?rent.dueDate():rent!=null && !month.equals(current)?null:month.atDay(Math.min(housing.rentDay(),month.lengthOfMonth()));
            rows.add(housingRow("rent:"+month,"월세"+(housing!=null && month.equals(current) && housing.included()?" · 관리비 포함":""),"월세",
                rent==null?housing.rent():rent.amount(),date,paid,rent!=null,"rent",rent==null?"계약 기준 예정 금액":"저장된 월세 기록"));
        }
        var interest=jeonse?repository.interest(user,month):java.util.List.<BillRepository.Interest>of();
        for(var charge:interest) rows.add(housingRow("interest:"+charge.id()+":"+month,"전세 대출 이자","대출 이자",
            charge.amount(),charge.date(),charge.paidAt()!=null && !charge.paidAt().isAfter(asOf)?charge.paidAt():null,true,"interest","대출 이자 기록"));
        if(interest.isEmpty() && canRegister && jeonse) {
            var estimate=repository.expectedInterest(user,month);
            if(estimate!=null) rows.add(housingRow("interest:"+estimate.id()+":"+month,"전세 대출 이자","대출 이자",
                estimate.amount(),estimate.date(),null,false,"interest","대출 조건 기준 예정 금액 · 실제 납부 확인 전"));
        }
        return rows;
    }
    private BillResponse.HousingItem housingRow(String id, String name, String tag, long amount, LocalDate due, Instant paid,
        boolean snapshot,String source,String memo) {
        return new BillResponse.HousingItem(id, name, tag, amount, amount, paid != null, Objects.toString(paid, null),
            Objects.toString(due, null), due == null ? id.substring(id.length() - 7) : YearMonth.from(due).toString(),
            true, snapshot, source, memo);
    }

    @Transactional(readOnly = true)
    public BillResponse currentActive(long userId, long id) {
        var month = currentMonth();
        var row = repository.activeRow(userId, id, month);
        return row == null ? null : response(row.item(), row.payment(), month);
    }

    private void lock(long userId, long sessionId) {
        auth.lockUser(userId);
        if (!auth.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
    }

    @Transactional
    public void autoRegister(long userId,long sessionId,String timeZone) {
        autoRegister(userId,sessionId,timeZone,null);
    }
    @Transactional
    public void autoRegister(long userId,long sessionId,String timeZone,YearMonth selectedMonth) {
        lock(userId,sessionId);
        registerContractExpenses(userId,timeZone,selectedMonth);
    }
    @Transactional
    public void autoRegisterForUser(long userId,String timeZone) {
        auth.lockUser(userId);
        registerContractExpenses(userId,timeZone,null);
    }
    private void registerContractExpenses(long userId,String timeZone,YearMonth selectedMonth) {
        ZoneId zone;
        try { zone=ZoneId.of(timeZone); } catch(RuntimeException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        YearMonth current=YearMonth.from(clock.instant().atZone(zone));
        YearMonth month=selectedMonth==null?current:selectedMonth;
        if(month.isAfter(current)) throw BillInput.bad("미래 월은 등록할 수 없어요.");
        if(month.equals(current)) repository.rememberZone(userId,zone.getId());
        repository.autoRegister(userId,month,current);
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

    public YearMonth writableMonth(String month, String timeZone) {
        var value = BillInput.month(month);
        try {
            if (value.isAfter(YearMonth.from(clock.instant().atZone(ZoneId.of(timeZone)))))
                throw BillInput.bad("미래 월에는 등록할 수 없어요.");
        } catch (java.time.DateTimeException | NullPointerException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        return value;
    }

    @Transactional
    public BillResponse registerMonthly(long userId, long sessionId, YearMonth month, String timeZone, BillInput.MonthlyCreate request) {
        lock(userId, sessionId);
        var details = request.details();
        LocalDate dueDate = details.dueDate();
        requireDueDate(dueDate, timeZone);
        requireContractMonth(userId, month);
        requireContractMonth(userId, YearMonth.from(dueDate));
        String tag = request.tag();
        String name = request.name();
        long amount = details.amount();
        Long id = repository.matchingUnregistered(userId, name, tag, month);
        if (id != null) requireManual(userId,id);
        if (id == null) id = repository.create(userId, name, amount, tag, clock.instant());
        requireBeforeTermination(repository.find(userId, id), dueDate);
        if (repository.payment(id, month) != null) throw new ApiException(409, "이 월에 이미 등록된 항목이에요. 수정 버튼을 이용해 주세요.");
        repository.insertPayment(id, month, amount, null);
        repository.monthlyDetails(id, month, amount, dueDate);
        saveMonthlyMemo(userId, id, month, details);
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public BillResponse updateMonthly(long userId, long sessionId, long id, YearMonth month, String timeZone, BillInput.MonthlyDetails request) {
        lock(userId, sessionId);
        LocalDate dueDate = request.dueDate();
        long amount = request.amount();
        var item = repository.find(userId, id);
        requireManual(userId,id);
        requireBeforeTermination(item, dueDate);
        var existing=repository.payment(id,month);
        if (existing == null || existing.deletedAt() != null) throw new ApiException(404, "선택한 월에 등록한 후 수정해 주세요.");
        if(existing.paidAt()!=null) throw new ApiException(409,"납부 완료 기록은 변경할 수 없어요.");
        requireContractMonth(userId, month);
        requireContractMonth(userId, YearMonth.from(dueDate));
        boolean dateChanged = !dueDate.equals(existing.dueDate());
        if (dateChanged) requireDueDate(dueDate, timeZone);
        repository.monthlyDetails(id, month, amount, dueDate);
        saveMonthlyMemo(userId, id, month, request);
        boolean amountChanged = amount != existing.amount();
        if (amountChanged || dateChanged) {
            repository.propagateMonthly(userId, id, month, amount, dueDate,
                LocalDate.ofInstant(clock.instant(), ZoneId.of(timeZone)), amountChanged, dateChanged);
            repository.update(userId, id, item.name(), amount, item.tag());
        }
        return response(repository.find(userId,id), repository.payment(id, month), month);
    }

    private void saveMonthlyMemo(long userId, long id, YearMonth month, BillInput.MonthlyDetails request) {
        if (request.memoId() != null) repository.attachMemo(userId, id, month, request.memoId());
        else if (request.memo() != null) repository.monthlyMemo(id, month, request.memo());
    }

    @Transactional
    public void deleteMonthly(long userId, long sessionId, long id, String monthValue, String timeZone) {
        var month = writableMonth(monthValue, timeZone);
        lock(userId, sessionId);
        repository.find(userId, id);
        requireManual(userId,id);
        var payment = repository.payment(id, month);
        if (payment == null) throw new ApiException(404, "선택한 월에 등록된 기록이 없어요.");
        if (payment.paidAt() != null) throw new ApiException(409, "납부 완료 기록은 삭제할 수 없어요. 납부 취소 후 이번 달 기록을 삭제해 주세요.");
        if (payment.deletedAt() == null) repository.deleteMonthly(id, month, clock.instant());
    }

    @Transactional
    public BillResponse registerPhoto(long userId, long sessionId, String month, String timeZone, String hash, Map<String, Object> body) {
        return registerPhoto(userId,sessionId,month,timeZone,hash,null,body);
    }

    private void requireDueDate(LocalDate dueDate, String timeZone) {
        var today = LocalDate.ofInstant(clock.instant(), ZoneId.of(timeZone));
        if (dueDate.isBefore(today)) throw BillInput.bad("납부 기한은 해당 시간대의 오늘 이후로 입력해 주세요.");
    }

    @Transactional
    public BillResponse registerPhoto(long userId, long sessionId, String month, String timeZone, String hash, String documentHash, Map<String, Object> body) {
        lock(userId, sessionId);
        if (repository.photoImport(userId, hash) != null) throw new ApiException(409, "이미 등록한 사진이에요. 등록된 내역을 확인해 주세요.");
        if (documentHash != null && repository.documentExists(userId,documentHash)) throw new ApiException(409,"이미 등록된 고지서예요. 등록된 내역을 수정해 주세요.");
        var result = registerMonthly(userId, sessionId, writableMonth(month, timeZone), timeZone, BillInput.monthlyCreate(body));
        long id = Long.parseLong(result.id());
        repository.rememberPhoto(userId, hash, id);
        if (documentHash != null) repository.rememberDocument(userId, documentHash, id);
        return result;
    }

    @Transactional
    public BillResponse createFromHome(long userId,long sessionId,Map<String,Object> body) {
        BillInput.item(body,true); lock(userId,sessionId);
        String name=BillInput.text(body.get("name"),"이름",30),tag=BillInput.text(body.get("tag"),"분류",24);
        checkDuplicate(userId,name,tag,0);
        long id=repository.create(userId,name,BillInput.amount(body.get("amount")),tag,clock.instant());
        return response(repository.find(userId,id),null,currentMonth());
    }

    @Transactional
    public BillResponse updateFromHome(long userId,long sessionId,long id,Map<String,Object> body) {
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
    public void removeFromHome(long userId,long sessionId,long id) {
        lock(userId, sessionId);
        var item = repository.find(userId, id);
        if (item.active()) repository.deactivate(userId, id);
    }

    private void checkDuplicate(long userId, String name, String tag, long id) {
        if (repository.duplicate(userId, name, tag, id)) throw new ApiException(409, "같은 이름·분류의 고정 지출 항목이 이미 있어요.");
    }

    private BillRepository.Item active(BillRepository.Item item) {
        if (!item.active()) throw new ApiException(404, "해지된 항목은 수정할 수 없어요.");
        return item;
    }
    private void requireBeforeTermination(BillRepository.Item item,java.time.LocalDate due) {
        if(item.terminationDate()!=null && !due.isBefore(item.terminationDate())) throw new ApiException(409,"해지 적용일 이후에는 고정 지출을 등록·수정할 수 없어요.");
    }

    private BillResponse response(BillRepository.Item item, BillRepository.Payment payment, YearMonth month) {
        return response(item, payment, month, item.active(), null, null);
    }

    private BillResponse response(BillRepository.Item item, BillRepository.Payment payment, YearMonth month,
                                  boolean active, Boolean homeManaged, LocalDate estimatedDueDate) {
        var memo = repository.memoReference(item.id(), month);
        Instant paidAt = payment == null ? null : payment.paidAt();
        LocalDate dueDate = payment == null ? estimatedDueDate : payment.dueDate();
        return new BillResponse(Long.toString(item.id()), item.name(), item.tag(),
            payment == null ? item.defaultAmount() : payment.amount(), paidAt != null, Objects.toString(paidAt, null),
            month.toString(), item.defaultAmount(), active, payment != null, Objects.toString(item.terminationDate(), null),
            Objects.toString(dueDate, null), payment == null ? "" : Objects.toString(payment.memo(), ""),
            memo == null ? null : memo.id(), memo == null ? null : memo.title(), homeManaged);
    }
}

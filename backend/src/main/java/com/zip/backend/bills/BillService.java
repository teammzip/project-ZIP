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
        var items = repository.list(userId, month).stream()
            .filter(row -> !row.item().createdAt().isAfter(asOf))
            .filter(row -> row.payment() != null || (row.item().active() && month.equals(current)
                && !month.isBefore(YearMonth.from(row.item().createdAt().atZone(zone)))))
            .map(row -> {
                var payment = row.payment();
                if (payment != null && payment.paidAt() != null && payment.paidAt().isAfter(asOf)) payment = new BillRepository.Payment(payment.amount(), null, payment.dueDate(), payment.memo());
                return response(row.item(), payment, month);
            }).toList();
        var result = new LinkedHashMap<String, Object>();
        result.put("month", month.toString()); result.put("currentMonth", current.toString()); result.put("timeZone", zone.getId());
        result.put("periodFrom", start.atZone(zone).toOffsetDateTime().toString());
        result.put("periodThrough", through.atZone(zone).toOffsetDateTime().toString());
        result.put("queriedAt", asOf.atZone(zone).toOffsetDateTime().toString());
        result.put("items", items);
        return result;
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
        return repository.list(userId, month).stream()
            .filter(row -> row.payment() != null || (row.item().active() && !month.isBefore(current)
                && !month.isBefore(YearMonth.from(row.item().createdAt().atZone(KOREA)))))
            .map(row -> response(row.item(), row.payment(), month)).toList();
    }

    private void lock(long userId, long sessionId) {
        auth.lockUser(userId);
        if (!auth.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
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
        String tag = BillInput.text(body.get("tag"), "분류", 24);
        String name = body.containsKey("name") ? BillInput.text(body.get("name"), "이름", 30) : tag;
        long amount = BillInput.amount(body.get("amount"));
        Long id = repository.matchingUnregistered(userId, name, tag, month);
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
        var existing=repository.payment(id,month);
        if (existing == null || existing.deletedAt() != null) throw new ApiException(404, "선택한 월에 등록한 후 수정해 주세요.");
        if (!BillInput.dueDate(body.get("dueDate")).equals(existing.dueDate())) requireDueDate(body,timeZone);
        repository.monthlyDetails(id, month, BillInput.amount(body.get("amount")), BillInput.dueDate(body.get("dueDate")));
        if (body.containsKey("memo")) repository.monthlyMemo(id,month,BillInput.memo(body.get("memo")));
        return response(item, repository.payment(id, month), month);
    }

    @Transactional
    public void deleteMonthly(long userId, long sessionId, long id, String monthValue, String timeZone) {
        var month = writableMonth(monthValue, timeZone);
        lock(userId, sessionId);
        repository.find(userId, id);
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
        long id = repository.create(userId, name, amount, tag, now);
        repository.insertPayment(id, month, amount, null);
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public Map<String, Object> update(long userId, long sessionId, long id, Map<String, Object> body) {
        BillInput.item(body, false); lock(userId, sessionId);
        var item = active(repository.find(userId, id));
        String name = body.containsKey("name") ? BillInput.text(body.get("name"), "이름", 30) : item.name();
        String tag = body.containsKey("tag") ? BillInput.text(body.get("tag"), "분류", 24) : item.tag();
        long amount = body.containsKey("amount") ? BillInput.amount(body.get("amount")) : item.defaultAmount();
        checkDuplicate(userId, name, tag, id);
        var month = currentMonth();
        freezeCurrent(item, month);
        repository.update(userId, id, name, amount, tag);
        return response(repository.find(userId, id), repository.payment(id, month), month);
    }

    @Transactional
    public Map<String, Object> pay(long userId, long sessionId, long id, YearMonth month, Map<String, Object> body) {
        BillInput.payment(body); lock(userId, sessionId);
        var current = currentMonth();
        if (month.isAfter(current)) throw BillInput.bad("미래 월의 납부 기록은 저장할 수 없어요.");
        var item = repository.find(userId, id);
        var payment = repository.payment(id, month);
        if (payment != null && payment.deletedAt() != null) throw new ApiException(404, "삭제된 월별 기록이에요.");
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
        lock(userId, sessionId);
        var item = repository.find(userId, id);
        if (item.active()) { freezeCurrent(item, currentMonth()); repository.deactivate(userId, id); }
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

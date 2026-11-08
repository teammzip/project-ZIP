package com.zip.backend.bills;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
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
        return result;
    }
}

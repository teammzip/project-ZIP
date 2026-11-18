package com.zip.backend.memo;

import com.zip.backend.common.ApiException;
import com.zip.backend.common.Sql;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * 메모장 · 홈 메모 위젯 (frontend/API.md 12장). 내 메모만 보고 고칠 수 있어요.
 * 글 메모는 body, 체크리스트는 items([{ text, done }]). 홈에 보일 메모는 최대 3개(user_settings.home_memo_ids, null = 자동).
 */
@Service
public class MemoService {
    static final List<String> COLORS = List.of("노랑", "분홍", "하늘", "초록", "보라", "흰색");
    static final int TITLE_MAX = 60;
    static final int BODY_MAX = 5_000;
    static final int ITEM_MAX = 100;
    static final int ITEMS_MAX = 200;
    static final int MEMOS_MAX = 1_000;
    static final int HOME_MAX = 3;
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern LINE_CONTROL = Pattern.compile("\\p{Cntrl}");

    private final MemoRepository repository;
    private final JsonMapper json;
    private final Clock clock;

    public MemoService(MemoRepository repository, JsonMapper json, Clock clock) {
        this.repository = repository;
        this.json = json;
        this.clock = clock;
    }

    public record Item(String text, Boolean done) {}
    /** 만들 때는 빈 칸이 기본값, 고칠 때는 보낸 칸만 바뀜 (null = 그대로) */
    public record MemoInput(String title, String body, String color, Boolean pinned, Boolean checklist, List<Item> items) {}
    public record HomeInput(List<String> ids) {}

    public List<Map<String, Object>> list(long userId, String q) {
        var keyword = q == null || q.isBlank() ? null : q.strip();
        if (keyword != null && keyword.length() > 40) throw new ApiException(400, "검색어는 40자 이내로 입력해 주세요.");
        return repository.list(userId, keyword == null ? null : Sql.likeContains(keyword)).stream().map(this::memo).toList();
    }

    @Transactional
    public Map<String, Object> create(long userId, MemoInput input) {
        if (repository.count(userId) >= MEMOS_MAX) throw new ApiException(400, "메모는 " + MEMOS_MAX + "개까지 만들 수 있어요. 안 쓰는 메모를 지워 주세요.");
        var now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        var empty = new MemoRepository.MemoRow(0, "", "", "노랑", false, false, "[]", now, now);
        long id = repository.insert(userId, apply(empty, input == null ? new MemoInput(null, null, null, null, null, null) : input));
        return memo(repository.find(userId, id).orElseThrow());
    }

    @Transactional
    public Map<String, Object> update(long userId, String memoId, MemoInput input) {
        var before = repository.find(userId, id(memoId)).orElseThrow(MemoService::notFound);
        if (input == null) throw new ApiException(400, "바꿀 내용을 보내 주세요.");
        var after = apply(before, input);
        repository.update(userId, new MemoRepository.MemoRow(after.id(), after.title(), after.body(), after.color(), after.pinned(), after.checklist(),
            after.items(), after.createdAt(), clock.instant().truncatedTo(ChronoUnit.SECONDS)));
        return memo(repository.find(userId, before.id()).orElseThrow());
    }

    @Transactional
    public void delete(long userId, String memoId) {
        if (repository.delete(userId, id(memoId)) == 0) throw notFound();
    }

    /** 홈 메모: { ids: [...] } 또는 { ids: null } = 자동. 지운 메모는 빼고 돌려줘요 */
    public Map<String, Object> homeMemos(long userId) {
        var saved = repository.homeMemoIds(userId).map(this::parseIds);
        if (saved.isEmpty()) return nullIds();
        var owned = repository.ownedIds(userId, saved.get());
        return Map.of("ids", saved.get().stream().filter(owned::contains).map(String::valueOf).toList());
    }

    @Transactional
    public Map<String, Object> saveHomeMemos(long userId, HomeInput input) {
        if (input == null || input.ids() == null) {
            repository.saveHomeMemoIds(userId, null);
            return nullIds();
        }
        if (input.ids().size() > HOME_MAX) throw new ApiException(400, "홈에는 메모를 " + HOME_MAX + "개까지 보여 줄 수 있어요.");
        var ids = new LinkedHashSet<Long>();
        for (var value : input.ids()) ids.add(idOr400(value));
        if (ids.size() != input.ids().size()) throw new ApiException(400, "같은 메모를 두 번 고를 수 없어요.");
        var list = List.copyOf(ids);
        if (repository.ownedIds(userId, list).size() != list.size()) throw new ApiException(400, "내 메모만 홈에 보여 줄 수 있어요.");
        repository.saveHomeMemoIds(userId, json.writeValueAsString(list.stream().map(String::valueOf).toList()));
        return Map.of("ids", list.stream().map(String::valueOf).toList());
    }

    /** 보낸 칸만 검사해서 바꿈 */
    private MemoRepository.MemoRow apply(MemoRepository.MemoRow m, MemoInput in) {
        var title = m.title();
        if (in.title() != null) {
            title = in.title();
            if (title.length() > TITLE_MAX || LINE_CONTROL.matcher(title).find()) throw new ApiException(400, "제목은 " + TITLE_MAX + "자 이내 한 줄로 입력해 주세요.");
        }
        var body = m.body();
        if (in.body() != null) {
            body = in.body();
            if (body.length() > BODY_MAX || CONTROL.matcher(body).find()) throw new ApiException(400, "메모는 " + String.format("%,d", BODY_MAX) + "자 이내로 입력해 주세요.");
        }
        var color = m.color();
        if (in.color() != null) {
            color = in.color();
            if (!COLORS.contains(color)) throw new ApiException(400, "색은 " + String.join(" · ", COLORS) + " 중 하나예요.");
        }
        var items = m.items();
        if (in.items() != null) {
            if (in.items().size() > ITEMS_MAX) throw new ApiException(400, "체크 항목은 " + ITEMS_MAX + "개까지예요.");
            var clean = new ArrayList<Map<String, Object>>();
            for (var item : in.items()) {
                if (item == null || item.text() == null || item.text().length() > ITEM_MAX || LINE_CONTROL.matcher(item.text()).find()) {
                    throw new ApiException(400, "체크 항목은 한 줄 " + ITEM_MAX + "자 이내로 입력해 주세요.");
                }
                var row = new LinkedHashMap<String, Object>();
                row.put("text", item.text());
                row.put("done", Boolean.TRUE.equals(item.done()));
                clean.add(row);
            }
            items = json.writeValueAsString(clean);
        }
        return new MemoRepository.MemoRow(m.id(), title, body, color, in.pinned() == null ? m.pinned() : in.pinned(),
            in.checklist() == null ? m.checklist() : in.checklist(), items, m.createdAt(), m.updatedAt());
    }

    private List<Long> parseIds(String text) {
        try {
            List<String> raw = json.readValue(text, new TypeReference<List<String>>() {});
            return raw.stream().filter(v -> v != null && ID.matcher(v).matches()).map(Long::parseLong).toList();
        } catch (RuntimeException broken) {
            return List.of(); // 잘못 저장된 값이면 없는 것으로
        }
    }

    private static Map<String, Object> nullIds() {
        var result = new LinkedHashMap<String, Object>();
        result.put("ids", null);
        return result;
    }

    private static long id(String value) {
        if (value == null || !ID.matcher(value).matches()) throw notFound();
        return Long.parseLong(value);
    }

    private static long idOr400(String value) {
        if (value == null || !ID.matcher(value).matches()) throw new ApiException(400, "메모 번호를 확인해 주세요.");
        return Long.parseLong(value);
    }

    private static ApiException notFound() {
        return new ApiException(404, "메모를 찾을 수 없어요.");
    }

    private Map<String, Object> memo(MemoRepository.MemoRow m) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(m.id()));
        result.put("title", m.title());
        result.put("body", m.body());
        result.put("color", m.color());
        result.put("pinned", m.pinned());
        result.put("checklist", m.checklist());
        result.put("items", json.readValue(m.items() == null ? "[]" : m.items(), new TypeReference<List<Map<String, Object>>>() {}));
        result.put("createdAt", m.createdAt().toString());
        result.put("updatedAt", m.updatedAt().toString());
        return result;
    }
}

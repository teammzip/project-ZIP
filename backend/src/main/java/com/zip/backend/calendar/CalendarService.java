package com.zip.backend.calendar;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.RegionMatcher;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 일정 · 일정 카테고리 · 항목 버튼 (frontend/API.md 3장). 내 것만 보고 고칠 수 있어요.
 * - 일정의 category 는 카테고리 이름(없으면 null = 분류 없음). 기념일(anniv)은 시간 · 카테고리 · 완료가 없고, 매년 반복(yearly)은 기념일만.
 * - 카테고리는 처음 쓸 때 기본 5개 + 미분류를 만들어 줘요. 미분류는 이름을 바꾸거나 지울 수 없고, 지운 카테고리의 일정 · 직접 만든 항목은 미분류로 가요.
 */
@Service
public class CalendarService {
    static final int TITLE_MAX = 60;
    static final int CATEGORY_MAX = 20;
    static final int EVENTS_MAX = 10_000;
    static final int RANGE_MAX_DAYS = 400;
    static final int SEARCH_MAX = 100;
    private static final Set<String> SOURCES = Set.of("USER", "RENT");
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final Pattern TIME = Pattern.compile("([01][0-9]|2[0-3]):[0-5][0-9]");
    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");

    private final CalendarRepository repository;
    private final AuthRepository auth;
    private final Clock clock;

    public CalendarService(CalendarRepository repository, AuthRepository auth, Clock clock) {
        this.repository = repository;
        this.auth = auth;
        this.clock = clock;
    }

    /** 일정 입력: 만들 때 빈 칸은 기본값, 고칠 때는 보낸 칸만 바뀜. category: 이름, "" = 분류 없음 */
    public record EventInput(String date, String time, String title, String category, Boolean anniv, Boolean yearly, Boolean done, String source) {}
    public record DoneInput(Boolean done) {}
    public record NameInput(String name) {}
    public record PresetInput(String title, String category) {}

    // ---------- 일정 ----------

    public List<Map<String, Object>> events(long userId, String from, String to) {
        LocalDate start = null, end = null;
        if (from != null || to != null) {
            start = date(from, "from");
            end = date(to, "to");
            if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > RANGE_MAX_DAYS) {
                throw new ApiException(400, "기간은 " + RANGE_MAX_DAYS + "일 이내로 골라 주세요.");
            }
        }
        return repository.events(userId, start, end, EVENTS_MAX).stream().map(CalendarService::event).toList();
    }

    public List<Map<String, Object>> search(long userId, String q) {
        var keyword = q == null ? "" : q.strip();
        if (keyword.isEmpty() || keyword.length() > 40) throw new ApiException(400, "검색어는 1~40자로 입력해 주세요.");
        return repository.search(userId, keyword, SEARCH_MAX).stream().map(CalendarService::event).toList();
    }

    @Transactional
    public Map<String, Object> createEvent(long userId, EventInput input) {
        if (input == null) throw new ApiException(400, "일정 내용을 보내 주세요.");
        repository.ensureDefaults(userId);
        if (repository.countEvents(userId) >= EVENTS_MAX) throw new ApiException(400, "일정은 " + String.format("%,d", EVENTS_MAX) + "개까지 만들 수 있어요.");
        var blank = new CalendarRepository.EventRow(0, null, null, null, null, false, "USER", false, false);
        var values = values(userId, blank, input, true);
        long id = repository.insertEvent(userId, values, now());
        return event(repository.event(userId, id).orElseThrow());
    }

    @Transactional
    public Map<String, Object> updateEvent(long userId, String eventId, EventInput input) {
        long id = id(eventId, "일정");
        var before = repository.event(userId, id).orElseThrow(() -> notFound("일정"));
        if (input == null) throw new ApiException(400, "바꿀 내용을 보내 주세요.");
        repository.updateEvent(userId, id, values(userId, before, input, false), now());
        return event(repository.event(userId, id).orElseThrow());
    }

    @Transactional
    public Map<String, Object> setDone(long userId, String eventId, DoneInput input) {
        if (input == null || input.done() == null) throw new ApiException(400, "done 을 보내 주세요.");
        return updateEvent(userId, eventId, new EventInput(null, null, null, null, null, null, input.done(), null));
    }

    @Transactional
    public void deleteEvent(long userId, String eventId) {
        if (repository.deleteEvent(userId, id(eventId, "일정")) == 0) throw notFound("일정");
    }

    /** 보낸 칸만 검사해서 바꿈 */
    private CalendarRepository.EventValues values(long userId, CalendarRepository.EventRow e, EventInput in, boolean creating) {
        var date = in.date() == null ? e.date() : date(in.date(), "date");
        if (date == null) throw new ApiException(400, "날짜(date)를 보내 주세요.");
        var title = e.title();
        if (in.title() != null) {
            title = in.title().strip();
            int length = title.codePointCount(0, title.length());
            if (length == 0 || length > TITLE_MAX || CONTROL.matcher(title).find()) throw new ApiException(400, "제목은 " + TITLE_MAX + "자 이내 한 줄로 입력해 주세요.");
        }
        if (title == null) throw new ApiException(400, "제목(title)을 보내 주세요.");
        var time = e.time();
        if (in.time() != null) {
            if (!in.time().isEmpty() && !TIME.matcher(in.time()).matches()) throw new ApiException(400, "시간은 HH:MM 이에요 (종일이면 빈 값).");
            time = in.time().isEmpty() ? null : LocalTime.parse(in.time());
        }
        Long categoryId = e.category() == null ? null : repository.categoryByName(userId, e.category()).map(CalendarRepository.CategoryRow::id).orElse(null);
        if (in.category() != null) {
            categoryId = in.category().isEmpty() ? null
                : repository.categoryByName(userId, in.category()).orElseThrow(() -> new ApiException(400, "없는 카테고리예요: " + in.category())).id();
        }
        boolean anniv = in.anniv() == null ? e.anniv() : in.anniv();
        boolean yearly = in.yearly() == null ? e.yearly() : in.yearly();
        boolean done = in.done() == null ? e.done() : in.done();
        if (yearly && !anniv) throw new ApiException(400, "매년 반복은 기념일만 할 수 있어요.");
        if (anniv) {
            // 기념일은 끝낼 할 일이 아니라서 시간 · 카테고리 · 완료가 없음
            time = null;
            categoryId = null;
            done = false;
        }
        var source = e.source();
        if (creating && in.source() != null) {
            if (!SOURCES.contains(in.source())) throw new ApiException(400, "source 는 USER 또는 RENT 예요.");
            source = in.source();
        }
        return new CalendarRepository.EventValues(date, time, title, categoryId, done, source, anniv, yearly);
    }

    // ---------- 카테고리 ----------

    @Transactional
    public List<Map<String, Object>> categories(long userId) {
        repository.ensureDefaults(userId);
        var presets = repository.presets(userId);
        return repository.categories(userId).stream().map(c -> {
            var result = new LinkedHashMap<String, Object>();
            result.put("id", Long.toString(c.id()));
            result.put("name", c.name());
            result.put("ico", c.ico());
            result.put("system", c.system());
            // 기본 항목 버튼 (직접 만든 항목은 /api/event-presets)
            result.put("items", presets.stream().filter(p -> !p.custom() && p.categoryId() == c.id()).map(CalendarRepository.PresetRow::title).toList());
            return (Map<String, Object>) result;
        }).toList();
    }

    @Transactional
    public Map<String, Object> createCategory(long userId, NameInput input) {
        repository.ensureDefaults(userId);
        var name = categoryName(input);
        long id = repository.insertCategory(userId, name, CalendarDefaults.CUSTOM_ICO, null, repository.nextCategoryOrder(userId));
        if (id == 0) throw new ApiException(409, "같은 이름의 카테고리가 이미 있어요.");
        return categories(userId).stream().filter(c -> c.get("id").equals(Long.toString(id))).findFirst().orElseThrow();
    }

    @Transactional
    public void renameCategory(long userId, String categoryId, NameInput input) {
        var category = repository.category(userId, id(categoryId, "카테고리")).orElseThrow(() -> notFound("카테고리"));
        if (category.system()) throw new ApiException(400, "미분류는 이름을 바꿀 수 없어요.");
        var name = categoryName(input);
        try {
            repository.renameCategory(userId, category.id(), name);
        } catch (DuplicateKeyException exists) {
            throw new ApiException(409, "같은 이름의 카테고리가 이미 있어요.");
        }
    }

    @Transactional
    public void deleteCategory(long userId, String categoryId) {
        var category = repository.category(userId, id(categoryId, "카테고리")).orElseThrow(() -> notFound("카테고리"));
        if (category.system()) throw new ApiException(400, "미분류는 삭제할 수 없어요.");
        repository.deleteCategory(userId, category.id(), repository.uncategorizedId(userId));
    }

    private static String categoryName(NameInput input) {
        var name = input == null || input.name() == null ? "" : input.name().strip();
        int length = name.codePointCount(0, name.length());
        if (length == 0 || length > CATEGORY_MAX || CONTROL.matcher(name).find()) throw new ApiException(400, "카테고리 이름은 " + CATEGORY_MAX + "자 이내로 입력해 주세요.");
        if (name.equals(CalendarDefaults.UNCATEGORIZED)) throw new ApiException(409, "같은 이름의 카테고리가 이미 있어요.");
        return name;
    }

    // ---------- 항목 버튼 (직접 만든 것) ----------

    @Transactional
    public List<Map<String, Object>> presets(long userId) {
        repository.ensureDefaults(userId);
        return repository.presets(userId).stream().filter(CalendarRepository.PresetRow::custom).map(CalendarService::preset).toList();
    }

    /** 같은 카테고리에 같은 이름이 이미 있으면 새로 만들지 않고 그것을 돌려줘요 */
    @Transactional
    public Map<String, Object> createPreset(long userId, PresetInput input) {
        repository.ensureDefaults(userId);
        var title = presetTitle(input);
        long categoryId = presetCategory(userId, input);
        var existing = repository.presetByTitle(userId, categoryId, title);
        if (existing.isPresent()) return preset(existing.get());
        long id = repository.insertPreset(userId, categoryId, title);
        return preset(repository.preset(userId, id).orElseThrow());
    }

    @Transactional
    public Map<String, Object> updatePreset(long userId, String presetId, PresetInput input) {
        var before = repository.preset(userId, id(presetId, "항목")).filter(CalendarRepository.PresetRow::custom).orElseThrow(() -> notFound("항목"));
        var title = presetTitle(input);
        long categoryId = presetCategory(userId, input);
        var clash = repository.presetByTitle(userId, categoryId, title).filter(p -> p.id() != before.id());
        if (clash.isPresent()) throw new ApiException(409, "같은 카테고리에 같은 이름의 항목이 있어요.");
        repository.updatePreset(userId, before.id(), categoryId, title);
        return preset(repository.preset(userId, before.id()).orElseThrow());
    }

    @Transactional
    public void deletePreset(long userId, String presetId) {
        if (repository.deletePreset(userId, id(presetId, "항목")) == 0) throw notFound("항목");
    }

    private static String presetTitle(PresetInput input) {
        var title = input == null || input.title() == null ? "" : input.title().strip();
        int length = title.codePointCount(0, title.length());
        if (length == 0 || length > TITLE_MAX || CONTROL.matcher(title).find()) throw new ApiException(400, "항목 이름은 " + TITLE_MAX + "자 이내로 입력해 주세요.");
        return title;
    }

    private long presetCategory(long userId, PresetInput input) {
        var name = input == null || input.category() == null || input.category().isBlank() ? CalendarDefaults.UNCATEGORIZED : input.category();
        return repository.categoryByName(userId, name).orElseThrow(() -> new ApiException(400, "없는 카테고리예요: " + name)).id();
    }

    // ---------- 쓰레기 배출표 ----------

    public record MyTrashSchedule(String regionName, List<Map<String, Object>> items) {}

    public MyTrashSchedule myTrashSchedule(long userId) {
        var addresses = repository.trashAddresses(userId);
        if (addresses.home() == null && addresses.address() == null) return new MyTrashSchedule(null, List.of());
        var districts = auth.districts();
        // 내 집 주소로 못 찾으면(직접 입력이라 시군구가 빠지는 등) 회원 주소로 다시 찾음 — 쓰레기 배출 알림과 같은 규칙
        return RegionMatcher.matchFirst(districts, addresses.home(), addresses.address())
            .flatMap(regionId -> districts.stream().filter(district -> district.id().equals(regionId)).findFirst())
            .map(district -> new MyTrashSchedule(district.displayName(), trashSchedules(district.id())))
            .orElseGet(() -> new MyTrashSchedule(null, List.of()));
    }

    public List<Map<String, Object>> trashSchedules(String regionId) {
        // [{ place, general: { days: [1,3,5], startTime: "18:00" } | null, food, recycle }]
        return repository.trashSchedules(id(regionId, "동네")).stream().<Map<String, Object>>map(t -> {
            var row = new LinkedHashMap<String, Object>();
            row.put("place", t.place());
            row.put("general", trashKind(t.general()));
            row.put("food", trashKind(t.food()));
            row.put("recycle", trashKind(t.recycle()));
            return row;
        }).toList();
    }

    private static Map<String, Object> trashKind(CalendarRepository.TrashKind kind) {
        return kind == null ? null : Map.of("days", kind.days(), "startTime", kind.startTime());
    }

    // ---------- 공통 ----------

    private java.time.Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.SECONDS); // MySQL DATETIME 반올림 대비
    }

    private static LocalDate date(String value, String what) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new ApiException(400, what + " 는 YYYY-MM-DD 날짜예요.");
        try {
            var date = LocalDate.parse(value);
            if (date.getYear() < 1900 || date.getYear() > 2200) throw new ApiException(400, what + " 날짜를 확인해 주세요.");
            return date;
        } catch (DateTimeParseException wrong) {
            throw new ApiException(400, what + " 날짜를 확인해 주세요.");
        }
    }

    private static long id(String value, String what) {
        if (value == null || !ID.matcher(value).matches()) throw notFound(what);
        return Long.parseLong(value);
    }

    private static ApiException notFound(String what) {
        return new ApiException(404, what + "을(를) 찾을 수 없어요.");
    }

    private static Map<String, Object> event(CalendarRepository.EventRow e) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", Long.toString(e.id()));
        result.put("date", e.date().toString());
        result.put("time", e.time() == null ? "" : e.time().toString().substring(0, 5));
        result.put("title", e.title());
        result.put("category", e.category());
        result.put("done", e.done());
        result.put("source", e.source());
        result.put("anniv", e.anniv());
        result.put("yearly", e.yearly());
        return result;
    }

    private static Map<String, Object> preset(CalendarRepository.PresetRow p) {
        return Map.of("id", Long.toString(p.id()), "title", p.title(), "category", p.category());
    }
}

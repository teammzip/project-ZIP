package com.zip.backend.ledger;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.time.Clock;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.core.type.TypeReference;

@RestController
@RequestMapping("/api/me/ledger-categories")
public class LedgerCategoriesController {
    private static final Map<String, List<String>> DEFAULTS = Map.of(
        "fixed-income", List.of("월급", "이자", "연금", "임대 수입", "기타 고정 수입"),
        "other-income", List.of("아르바이트", "용돈", "부수입", "환급·정산", "기타"),
        "spend", List.of("식비", "생활용품", "교통", "건강·의료", "문화·여가", "기타"),
        "bill", List.of("공과금", "통신", "구독", "관리비", "기타")
    );
    private static final List<String> COLORS = List.of("#6485df", "#68b6a0", "#d884aa", "#ef9b66", "#a28ad6", "#91a2b5");

    public record Category(String name, String color) {}
    public record Selection(List<Category> custom, List<String> order, List<String> hidden, String salaryLabel) {
        public Selection {
            custom = custom == null ? List.of() : List.copyOf(custom);
            order = order == null ? List.of() : List.copyOf(order);
            hidden = hidden == null ? List.of() : List.copyOf(hidden);
        }
    }
    public record Change(String action, String name, String target, Selection previous) {}

    private static final Selection EMPTY = new Selection(null, null, null, null);
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final JsonMapper json;
    private final Clock clock;

    public LedgerCategoriesController(JdbcTemplate jdbc, AuthRepository auth, JsonMapper json, Clock clock) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.json = json;
        this.clock = clock;
    }

    @GetMapping
    public Selection read(@AuthenticationPrincipal Jwt jwt, @RequestParam String scope) {
        defaults(scope);
        return settings(Long.parseLong(jwt.getSubject())).getOrDefault(scope, EMPTY);
    }

    @PostMapping
    @Transactional
    public Selection change(@AuthenticationPrincipal Jwt jwt, @RequestParam String scope, @RequestBody Change change) {
        List<String> defaults = defaults(scope);
        long user = Long.parseLong(jwt.getSubject());
        auth.lockUser(user);
        if (!auth.sessionActive(Long.parseLong(jwt.getClaimAsString("sid")), user, clock.instant())) {
            throw new ApiException(401, "다시 로그인해 주세요.");
        }
        Map<String, Selection> settings = settings(user);
        Selection existing = settings.get(scope);
        Selection current = existing == null ? EMPTY : existing;
        Selection next = switch (Objects.toString(change.action(), "")) {
            case "import" -> existing == null ? importPrevious(defaults, change.previous()) : existing;
            case "add", "rename", "delete", "move" -> apply(scope, defaults, current, change);
            default -> throw bad("카테고리 작업을 확인해 주세요.");
        };
        if (next.equals(existing)) return next;
        if ("rename".equals(change.action())) {
            String from = name(change.name()), to = name(change.target());
            if (!from.equals(to) && !(scope.equals("fixed-income") && from.equals(salaryLabel(current)))) {
                renameTransactions(user, scope, from, to);
            }
        }
        settings.put(scope, next);
        String serialized = json.writeValueAsString(settings);
        if (jdbc.update("UPDATE user_settings SET ledger_category_settings = ? WHERE user_id = ?", serialized, user) == 0) {
            jdbc.update("INSERT INTO user_settings (user_id, ledger_category_settings) VALUES (?, ?)", user, serialized);
        }
        return next;
    }

    String salaryLabel(long user) {
        return salaryLabel(settings(user).getOrDefault("fixed-income", EMPTY));
    }

    private static String salaryLabel(Selection selection) {
        return Objects.requireNonNullElse(selection.salaryLabel(), "월급");
    }

    private void renameTransactions(long user, String scope, String from, String to) {
        if (scope.equals("bill")) {
            jdbc.update("UPDATE bill_items SET tag=? WHERE user_id=? AND tag=?", to, user, from);
            return;
        }
        boolean expense = scope.equals("spend");
        String kind = expense ? "EXPENSE" : "INCOME";
        var source = jdbc.queryForList("SELECT id FROM ledger_categories WHERE kind=? AND name=?", Long.class, kind, from);
        if (source.isEmpty()) return;
        jdbc.update("INSERT INTO ledger_categories(kind,name,color,sort_order) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE id=id",
            kind, to, "#7895cb");
        long target = jdbc.queryForObject("SELECT id FROM ledger_categories WHERE kind=? AND name=?", Long.class, kind, to);
        if (expense) {
            jdbc.update("UPDATE expenses SET category_id=? WHERE user_id=? AND category_id=?", target, user, source.get(0));
        } else {
            jdbc.update("UPDATE incomes SET category_id=? WHERE user_id=? AND category_id=? AND income_type=?",
                target, user, source.get(0), scope.equals("fixed-income") ? "FIXED" : "OTHER");
        }
    }

    private Map<String, Selection> settings(long user) {
        String value = jdbc.query("SELECT ledger_category_settings FROM user_settings WHERE user_id = ?",
            rs -> rs.next() ? rs.getString(1) : null, user);
        return value == null ? new LinkedHashMap<>() : json.readValue(value, new TypeReference<LinkedHashMap<String, Selection>>() {});
    }

    private static Selection apply(String scope, List<String> defaults, Selection state, Change change) {
        var custom = new ArrayList<>(state.custom());
        var hidden = new LinkedHashSet<>(state.hidden());
        var order = visibleOrder(defaults, state);
        String name = name(change.name());
        String action = change.action();
        String salaryLabel = state.salaryLabel();
        if (scope.equals("fixed-income") && action.equals("rename") && name(change.target()).equals("월급")
            && !name.equals(salaryLabel(state))) {
            throw new ApiException(409, "월급 이름은 월급 카테고리에서 변경해 주세요.");
        }
        if (scope.equals("fixed-income") && salaryLabel != null && !salaryLabel.equals("월급")) {
            String destination = action.equals("add") ? name : action.equals("rename") ? name(change.target()) : "";
            if (destination.equals("월급") && !(action.equals("rename") && name.equals(salaryLabel))) {
                if (order.contains(salaryLabel)) throw new ApiException(409, "월급 카테고리의 이름을 변경해 주세요.");
                salaryLabel = null;
            }
        }
        if (action.equals("add")) {
            add(defaults, custom, hidden, order, order.size(), name, null);
        } else {
            int index = order.indexOf(name);
            if (index < 0) throw new ApiException(409, "카테고리 목록이 바뀌었어요. 다시 열어 주세요.");
            switch (action) {
                case "move" -> {
                    int target = order.indexOf(name(change.target()));
                    if (target < 0) throw new ApiException(409, "카테고리 목록이 바뀌었어요. 다시 열어 주세요.");
                    order.remove(index);
                    order.add(target, name);
                }
                case "delete", "rename" -> {
                    order.remove(index);
                    String color = custom.stream().filter(cat -> cat.name().equals(name)).map(Category::color).findFirst().orElse(null);
                    custom.removeIf(cat -> cat.name().equals(name));
                    if (defaults.contains(name)) hidden.add(name);
                    if (action.equals("rename")) {
                        String target = name(change.target());
                        if (target.equals(name)) return state;
                        add(defaults, custom, hidden, order, index, target, color);
                        if (scope.equals("fixed-income") && name.equals(salaryLabel(state))) salaryLabel = target;
                    }
                }
            }
        }
        return new Selection(custom, order, List.copyOf(hidden), salaryLabel);
    }

    private static void add(List<String> defaults, List<Category> custom, Set<String> hidden, List<String> order,
                            int index, String name, String color) {
        if (order.stream().anyMatch(name::equalsIgnoreCase)) throw new ApiException(409, "이미 있는 카테고리예요.");
        if (defaults.contains(name)) {
            hidden.remove(name);
        } else {
            custom.add(new Category(name, color == null ? COLORS.get(custom.size() % COLORS.size()) : color));
        }
        order.add(index, name);
    }

    private static Selection importPrevious(List<String> defaults, Selection previous) {
        if (previous == null) return EMPTY;
        var custom = new ArrayList<Category>();
        var hidden = new LinkedHashSet<String>();
        var order = new ArrayList<>(defaults);
        for (Category category : previous.custom()) {
            String name = name(category.name());
            if (order.stream().noneMatch(name::equalsIgnoreCase)) {
                String color = category.color();
                add(defaults, custom, hidden, order, order.size(), name, color != null && COLORS.contains(color) ? color : null);
            }
        }
        var imported = new Selection(custom, previous.order(), List.of(), null);
        return new Selection(custom, visibleOrder(defaults, imported), List.of(), null);
    }

    private static ArrayList<String> visibleOrder(List<String> defaults, Selection selection) {
        var available = new LinkedHashSet<>(defaults);
        available.removeAll(selection.hidden());
        selection.custom().forEach(cat -> available.add(cat.name()));
        var order = new ArrayList<String>();
        for (String name : selection.order()) {
            if (available.remove(name)) order.add(name);
        }
        order.addAll(available);
        return order;
    }

    private static List<String> defaults(String scope) {
        var names = DEFAULTS.get(scope);
        if (names == null) throw bad("가계부 분류를 확인해 주세요.");
        return names;
    }

    private static String name(String input) {
        String name = Objects.toString(input, "").replaceAll("(?U)\\s+", " ").strip();
        if (name.isEmpty() || name.length() > 24 || name.codePoints().anyMatch(Character::isISOControl)) {
            throw bad("카테고리 이름은 1~24자로 입력해 주세요.");
        }
        return name;
    }

    private static ApiException bad(String message) {
        return new ApiException(400, message);
    }
}

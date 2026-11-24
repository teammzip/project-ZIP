package com.zip.backend.settings;

import com.fasterxml.jackson.annotation.JsonCreator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public final class HousingOnboardingRequest {
    private static final Set<String> SAVE_FIELDS = Set.of("action", "address", "birth", "salary", "timeZone", "home");
    private static final Object OMITTED = new Object();
    private final Submission submission;

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public HousingOnboardingRequest(Map<String, Object> body) {
        // Preserve omission and raw JSON types for validation after the completed-survey check.
        var action = body.get("action");
        if ("skip".equals(action) && body.size() == 1) {
            submission = new Skip();
        } else if ("save".equals(action) && SAVE_FIELDS.containsAll(body.keySet())) {
            submission = new Save(body.getOrDefault("address", OMITTED), body.getOrDefault("birth", OMITTED),
                body.getOrDefault("salary", OMITTED), body.getOrDefault("timeZone", OMITTED), body.getOrDefault("home", OMITTED));
        } else {
            submission = null;
        }
    }

    Submission submission() {
        if (submission == null) throw SettingsInput.bad("설문 항목을 확인해 주세요.");
        return submission;
    }

    sealed interface Submission permits Skip, Save {}

    record Skip() implements Submission {}

    record Save(Object rawAddress, Object rawBirth, Object rawSalary, Object rawTimeZone, Object rawHome) implements Submission {
        String address() {
            return rawAddress == OMITTED ? null : SettingsInput.text(rawAddress, "집 주소", 200, false);
        }

        String birth() {
            return rawBirth == OMITTED ? null : SettingsInput.text(rawBirth, "생년월일", 10, false);
        }

        boolean hasSalary() { return rawSalary != OMITTED; }

        String salaryTimeZone() {
            return rawTimeZone == OMITTED ? "Asia/Seoul" : SettingsInput.text(rawTimeZone, "시간대", 100, false);
        }

        Map<String, Object> salaryFields() { return fields(rawSalary); }

        HomeAnswers home() { return rawHome == OMITTED ? null : HomeAnswers.from(fields(rawHome)); }
    }

    record HomeAnswers(Object kind, Object deposit, Object rent, Object mgmtIncluded, Object mgmtFee,
        Object contractFee, Object loan) {
        private static final Set<String> ALLOWED = Set.of("kind", "deposit", "rent", "mgmtIncluded", "mgmtFee", "contractFee", "loan");

        static HomeAnswers from(Map<String, Object> fields) {
            if (!ALLOWED.containsAll(fields.keySet())) throw SettingsInput.bad("계약 정보를 확인해 주세요.");
            return new HomeAnswers(fields.get("kind"), fields.get("deposit"), fields.get("rent"), fields.get("mgmtIncluded"),
                fields.get("mgmtFee"), fields.get("contractFee"), fields.get("loan"));
        }
    }

    static Map<String, Object> fields(Object value) {
        if (!(value instanceof Map<?, ?> map)) throw SettingsInput.bad("설문 항목을 확인해 주세요.");
        var fields = new LinkedHashMap<String, Object>();
        map.forEach((key, field) -> {
            if (!(key instanceof String name) || field == null) throw SettingsInput.bad("설문 항목을 확인해 주세요.");
            fields.put(name, field);
        });
        return fields;
    }
}

package com.zip.backend.settings;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.AuthRequests;
import com.zip.backend.auth.AuthService;
import com.zip.backend.common.ApiException;
import com.zip.backend.ledger.SalaryService;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class HousingOnboardingService {
    private final JdbcTemplate jdbc;
    private final AuthRepository accounts;
    private final AuthService auth;
    private final HomeInfoService homes;
    private final SettingsRepository settings;
    private final SalaryService salaries;
    private final Clock clock;
    private final JsonMapper json;

    public HousingOnboardingService(JdbcTemplate jdbc, AuthRepository accounts, AuthService auth, HomeInfoService homes,
            SettingsRepository settings, SalaryService salaries, Clock clock, JsonMapper json) {
        this.jdbc = jdbc;
        this.accounts = accounts;
        this.auth = auth;
        this.homes = homes;
        this.settings = settings;
        this.salaries = salaries;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public Map<String, Object> save(long user, long session, Map<String, Object> input) {
        accounts.lockUser(user);
        if (!accounts.sessionActive(session, user, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        if (!"PENDING".equals(accounts.housingSurveyStatus(user))) return auth.me(user);
        if (accounts.agreedAt(user) == null) throw SettingsInput.bad("먼저 약관에 동의해 주세요.");
        var action = input.get("action");
        if ("skip".equals(action) && input.size() == 1) {
            setStatus(user, "SKIPPED");
            return auth.me(user);
        }
        if (!"save".equals(action) || !Set.of("action", "address", "birth", "salary", "timeZone", "home").containsAll(input.keySet())) {
            throw SettingsInput.bad("설문 항목을 확인해 주세요.");
        }

        String address = input.containsKey("address") ? SettingsInput.text(input.get("address"), "집 주소", 200, false) : null;
        if (address != null) auth.updateMe(user, session, AuthRequests.UpdateMe.from(Map.of("address", address)));
        if (input.containsKey("birth")) {
            var birth = SettingsInput.text(input.get("birth"), "생년월일", 10, false);
            ProfileBirth.save(jdbc, user, ProfileBirth.parse(birth, clock));
        }
        if (input.containsKey("salary")) {
            var zone = input.containsKey("timeZone") ? SettingsInput.text(input.get("timeZone"), "시간대", 100, false) : "Asia/Seoul";
            salaries.saveOnboarding(user, session, zone, fields(input.get("salary")));
        }
        if (input.containsKey("home")) {
            saveHome(user, session, address, fields(input.get("home")));
        } else if (address != null) {
            var previous = settings.read(user);
            settings.save(user, new SettingsRepository.Settings(previous.rent(), previous.day(), previous.moveIn(),
                previous.end(), previous.on(), address, previous.regionId(), previous.location()), false);
        }
        setStatus(user, "COMPLETED");
        return auth.me(user);
    }

    private void saveHome(long user, long session, String address, Map<String, Object> answers) {
        if (!Set.of("kind", "deposit", "rent", "mgmtIncluded", "mgmtFee", "contractFee", "loan").containsAll(answers.keySet()))
            throw SettingsInput.bad("계약 정보를 확인해 주세요.");
        var previous = homes.get(user, session);
        var contract = previous.get("contract") instanceof Map<?, ?> existing ? existing : Map.of();
        var previousSettings = settings.read(user);
        var kind = answers.get("kind");
        boolean sameKind = kind != null && kind.equals(contract.get("kind"));
        var home = new LinkedHashMap<String, Object>();
        home.put("kind", kind);
        for (var key : Set.of("deposit", "mgmtFee", "contractFee", "mgmtIncluded")) {
            var prior = sameKind ? contract.get(key) : null;
            home.put(key, prior != null ? prior : key.equals("mgmtIncluded") ? false : 0);
        }
        home.put("rent", "monthly".equals(kind) && (sameKind || contract.isEmpty()) ? previousSettings.rent().movePointRight(4) : 0);
        home.put("rentDay", previousSettings.day());
        home.put("moveIn", previousSettings.moveIn());
        home.put("contractEnd", previousSettings.end());
        if (address != null) home.put("homeAddress", address);
        home.putAll(answers);

        Map<String, Object> draft = null;
        if (home.get("loan") instanceof Map<?, ?>) {
            if (!"jeonse".equals(kind)) throw SettingsInput.bad("전세 계약에만 대출을 입력할 수 있어요.");
            var loan = fields(home.get("loan"));
            var complete = Map.<String, Object>of("principal", 1, "annualRate", 0, "paymentDay", 1, "startDate", "2000-01-01");
            var validated = new LinkedHashMap<>(complete);
            validated.putAll(loan);
            HomeInfoInput.parseLoan(validated);
            if (loan.size() < complete.size()) {
                draft = loan;
                home.remove("loan");
            }
        }
        if (!home.containsKey("loan") && sameKind && previous.get("loan") instanceof Map<?, ?> loan && Boolean.TRUE.equals(loan.get("active"))) {
            home.put("loan", Map.of("principal", loan.get("principal"), "annualRate", loan.get("annualRate"),
                "paymentDay", loan.get("paymentDay"), "startDate", loan.get("startDate")));
        }
        homes.save(user, session, HomeInfoInput.parse(home));
        if (draft != null) jdbc.update("UPDATE users SET housing_loan_draft=? WHERE id=?", json.writeValueAsString(draft), user);
    }

    private static Map<String, Object> fields(Object value) {
        if (!(value instanceof Map<?, ?> map)) throw SettingsInput.bad("설문 항목을 확인해 주세요.");
        var result = new LinkedHashMap<String, Object>();
        map.forEach((key, field) -> {
            if (!(key instanceof String name) || field == null) throw SettingsInput.bad("설문 항목을 확인해 주세요.");
            result.put(name, field);
        });
        return result;
    }

    private void setStatus(long user, String status) {
        jdbc.update("UPDATE users SET housing_survey_status=? WHERE id=?", status, user);
    }
}

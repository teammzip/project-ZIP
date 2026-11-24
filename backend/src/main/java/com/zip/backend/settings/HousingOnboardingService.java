package com.zip.backend.settings;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.AuthRequests;
import com.zip.backend.auth.AuthService;
import com.zip.backend.common.ApiException;
import com.zip.backend.ledger.SalaryService;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
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
    public Map<String, Object> save(long user, long session, HousingOnboardingRequest input) {
        accounts.lockUser(user);
        if (!accounts.sessionActive(session, user, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        if (!"PENDING".equals(accounts.housingSurveyStatus(user))) return auth.me(user);
        if (accounts.agreedAt(user) == null) throw SettingsInput.bad("먼저 약관에 동의해 주세요.");
        if (input.submission() instanceof HousingOnboardingRequest.Save answers) {
            saveAnswers(user, session, answers);
            setStatus(user, "COMPLETED");
        } else {
            setStatus(user, "SKIPPED");
        }
        return auth.me(user);
    }

    private void saveAnswers(long user, long session, HousingOnboardingRequest.Save answers) {
        String address = answers.address();
        if (address != null) auth.updateMe(user, session, AuthRequests.UpdateMe.from(Map.of("address", address)));
        String birth = answers.birth();
        if (birth != null) {
            ProfileBirth.save(jdbc, user, ProfileBirth.parse(birth, clock));
        }
        if (answers.hasSalary()) {
            salaries.saveOnboarding(user, session, answers.salaryTimeZone(), answers.salaryFields());
        }
        var home = answers.home();
        if (home != null) {
            saveHome(user, session, address, home);
        } else if (address != null) {
            var previous = settings.read(user);
            settings.save(user, new SettingsRepository.Settings(previous.rent(), previous.day(), previous.moveIn(),
                previous.end(), previous.on(), address, previous.regionId(), previous.location()), false);
        }
    }

    private void saveHome(long user, long session, String address, HousingOnboardingRequest.HomeAnswers answers) {
        var previous = homes.get(user, session);
        var contract = previous.contract();
        var previousSettings = previous.settings();
        var kind = answers.kind();
        boolean sameKind = contract != null && contract.kind().equals(kind);
        var home = new LinkedHashMap<String, Object>();
        home.put("kind", kind);
        home.put("deposit", Objects.requireNonNullElse(answers.deposit(), sameKind ? contract.deposit() : 0));
        home.put("mgmtFee", Objects.requireNonNullElse(answers.mgmtFee(), sameKind ? contract.mgmtFee() : 0));
        home.put("contractFee", Objects.requireNonNullElse(answers.contractFee(), sameKind ? contract.contractFee() : 0));
        home.put("mgmtIncluded", Objects.requireNonNullElse(answers.mgmtIncluded(), sameKind && contract.mgmtIncluded()));
        var defaultRent = "monthly".equals(kind) && (sameKind || contract == null) ? previousSettings.rent().movePointRight(4) : 0;
        home.put("rent", Objects.requireNonNullElse(answers.rent(), defaultRent));
        home.put("rentDay", previousSettings.rentDay());
        home.put("moveIn", previousSettings.moveIn());
        home.put("contractEnd", previousSettings.contractEnd());
        if (address != null) home.put("homeAddress", address);
        if (answers.loan() != null) home.put("loan", answers.loan());

        HomeInfoResponse.LoanDraft draft = null;
        if (answers.loan() instanceof Map<?, ?>) {
            if (!"jeonse".equals(kind)) throw SettingsInput.bad("전세 계약에만 대출을 입력할 수 있어요.");
            var loan = HousingOnboardingRequest.fields(answers.loan());
            var complete = Map.<String, Object>of("principal", 1, "annualRate", 0, "paymentDay", 1, "startDate", "2000-01-01");
            var validated = new LinkedHashMap<>(complete);
            validated.putAll(loan);
            var parsed = HomeInfoInput.parseLoan(validated);
            if (loan.size() < complete.size()) {
                draft = new HomeInfoResponse.LoanDraft(loan.containsKey("principal") ? parsed.principal() : null,
                    loan.containsKey("annualRate") ? parsed.rate() : null, loan.containsKey("paymentDay") ? parsed.day() : null,
                    loan.containsKey("startDate") ? parsed.start().toString() : null);
                home.remove("loan");
            }
        }
        var previousLoan = previous.loan();
        if (!home.containsKey("loan") && sameKind && previousLoan != null && previousLoan.active()) {
            home.put("loan", Map.of("principal", previousLoan.principal(), "annualRate", previousLoan.annualRate(),
                "paymentDay", previousLoan.paymentDay(), "startDate", previousLoan.startDate()));
        }
        homes.save(user, session, HomeInfoInput.parse(home));
        if (draft != null) jdbc.update("UPDATE users SET housing_loan_draft=? WHERE id=?", json.writeValueAsString(draft), user);
    }

    private void setStatus(long user, String status) {
        jdbc.update("UPDATE users SET housing_survey_status=? WHERE id=?", status, user);
    }
}

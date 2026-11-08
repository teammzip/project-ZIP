package com.zip.backend.settings;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {
    private final SettingsRepository repository;
    private final AuthRepository auth;
    private final Clock clock;
    public SettingsService(SettingsRepository repository, AuthRepository auth, Clock clock) {
        this.repository = repository; this.auth = auth; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(long userId) { return response(repository.read(userId)); }

    @Transactional
    public Map<String, Object> put(long userId, long sessionId, SettingsInput input) {
        auth.lockUser(userId);
        if (!auth.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        var previous = repository.read(userId);
        var fields = input.fields();
        String id = fields.containsKey("regionId") ? SettingsInput.id(fields.get("regionId")) : previous.regionId();
        var location = previous.location();
        String name = fields.containsKey("regionName") ? SettingsInput.text(fields.get("regionName"), "regionName", 200, true) : null;
        if (fields.containsKey("regionLocation")) {
            location = location(fields.get("regionLocation"));
            if (location == null) {
                // Echoing a GET of legacy registry-only data is valid: explicit ID/name becomes MANUAL.
                // Null without an explicit selection clears the neighborhood altogether.
                if (!fields.containsKey("regionId") && (name == null || name.isEmpty())) id = null;
            } else {
                if (name != null && !name.equals(location.name())) throw SettingsInput.bad("regionName과 regionLocation.region이 달라요.");
                name = location.name();
            }
        }
        // Setting a different free-text neighborhood drops the old registry reference unless an ID was supplied.
        if (name != null && !fields.containsKey("regionId") && !name.equals(displayName(previous))) id = null;
        if (id != null) {
            var region = repository.region(id);
            if (name != null && !java.util.List.of(region.name(), region.fullName(), region.shortName()).contains(name)) throw SettingsInput.bad("동네 ID와 이름이 다른 동네를 가리켜요.");
            if (fields.containsKey("regionId") && (name == null || name.isEmpty())) name = region.fullName();
        }
        if (name != null) {
            if (name.isEmpty()) { id = null; location = null; }
            else if (location == null || !name.equals(location.name())) location = new SettingsRepository.Location(name, "MANUAL", null, null);
        }
        if (location != null && "VERIFIED".equals(location.source()) && !sameLocation(location, previous.location())) {
            throw SettingsInput.bad("동네 인증은 설정 저장으로 부여할 수 없어요. 기존 인증 위치만 유지할 수 있어요.");
        }
        if (location != null && "VERIFIED".equals(location.source()) && !Objects.equals(id, previous.regionId())) {
            throw SettingsInput.bad("동네 ID를 바꾸려면 다시 인증해야 해요.");
        }
        boolean reset = !Objects.equals(id, previous.regionId()) || !sameLocation(location, previous.location());
        String home = fields.containsKey("homeAddress") ? SettingsInput.text(fields.get("homeAddress"), "homeAddress", 200, true) : previous.home();
        repository.save(userId, new SettingsRepository.Settings(input.rent(), input.rentDay(), input.moveIn(), input.contractEnd(),
            input.notiOn(), home, id, location), reset);
        return get(userId);
    }

    private String displayName(SettingsRepository.Settings settings) {
        if (settings.location() != null) return settings.location().name();
        return settings.regionId() == null ? "" : repository.region(settings.regionId()).fullName();
    }

    private Map<String, Object> response(SettingsRepository.Settings settings) {
        var result = new LinkedHashMap<String, Object>();
        result.put("rent", settings.rent()); result.put("rentDay", settings.day());
        result.put("moveIn", settings.moveIn()); result.put("contractEnd", settings.end()); result.put("notiOn", settings.on());
        result.put("homeAddress", settings.home()); result.put("regionId", settings.regionId()); result.put("regionName", displayName(settings));
        var location = settings.location();
        result.put("regionLocation", location == null ? null : locationMap(location));
        return result;
    }

    private Map<String, Object> locationMap(SettingsRepository.Location location) {
        var value = new LinkedHashMap<String, Object>();
        value.put("region", location.name()); value.put("source", location.source().toLowerCase(Locale.ROOT));
        value.put("point", location.lat() == null ? null : Map.of("lat", location.lat(), "lon", location.lon()));
        return value;
    }

    private SettingsRepository.Location location(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof Map<?, ?> fields) || !Set.of("region", "source", "point").containsAll(fields.keySet())) throw SettingsInput.bad("regionLocation 형식을 확인해 주세요.");
        String name = SettingsInput.text(fields.get("region"), "region", 200, false);
        String source = SettingsInput.text(fields.get("source"), "source", 10, false);
        if (name.isEmpty() || !Set.of("manual", "survey", "verified").contains(source)) throw SettingsInput.bad("동네 이름과 출처를 확인해 주세요.");
        BigDecimal lat = null, lon = null;
        if (fields.get("point") != null) {
            if (!(fields.get("point") instanceof Map<?, ?> point) || !point.keySet().equals(Set.of("lat", "lon"))) throw SettingsInput.bad("좌표는 lat·lon 한 쌍으로 보내 주세요.");
            lat = coordinate(point.get("lat"), "lat", 90); lon = coordinate(point.get("lon"), "lon", 180);
        }
        return new SettingsRepository.Location(name, source.toUpperCase(Locale.ROOT), lat, lon);
    }

    private BigDecimal coordinate(Object raw, String key, int max) {
        BigDecimal value = SettingsInput.number(raw, key);
        if (value.abs().compareTo(BigDecimal.valueOf(max)) > 0 || value.stripTrailingZeros().scale() > 6) throw SettingsInput.bad("좌표 범위 또는 소수점 6자리 제한을 확인해 주세요.");
        return value;
    }

    private boolean sameLocation(SettingsRepository.Location a, SettingsRepository.Location b) {
        if (a == null || b == null) return a == b;
        return a.name().equals(b.name()) && a.source().equals(b.source()) && equalNumber(a.lat(), b.lat()) && equalNumber(a.lon(), b.lon());
    }
    private boolean equalNumber(BigDecimal a, BigDecimal b) { return a == null || b == null ? a == b : a.compareTo(b) == 0; }
}

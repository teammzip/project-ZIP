package com.zip.backend.notification;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.RegionMatcher;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 쓰레기 배출일 알림. 회원 주소에서 시군구를 찾고(RegionMatcher), 그 동네 쓰레기 배출표(trash_schedules)에
 * 오늘 요일이 있으면 그날 0시(자정, 한국 시간)에 알림(TRASH)을 하나 만든다.
 * 주소: 마이페이지 내 집 주소(user_settings.home_address)가 있으면 그것, 없으면 회원 주소(users.address — 주거 설문 · 내 정보에서 정함, 예전 회원은 가입 때 적은 주소).
 * 서버가 0시에 꺼져 있었으면 켜진 뒤 그날 안에 만든다(알릴 시각은 그날 0시). 시각은 zip.trash.reminder-hour 로 바꿀 수 있음. 같은 날 두 번 만들지 않는다.
 * 동네는 찾았는데 그 동네 배출표가 아예 없으면(공공데이터에 없는 시군구 13곳) "배출 정보가 없어요" 안내를 (회원, 동네)마다 딱 한 번만 보내고
 * 그 뒤로는 아무 알림도 보내지 않는다. 주소를 다른 동네로 바꾸면 그 동네 기준으로 다시 판단.
 */
@Service
public class TrashReminderService {
    /** 배출표가 한국 공공데이터라서 한국 시간 기준 */
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    static final String TITLE = "오늘은 쓰레기 배출일이에요";
    static final String NO_DATA_TITLE = "우리 동네는 쓰레기 배출 정보가 없어요";
    /** 알림에 보이는 종류 이름 (이 순서로 나열) */
    private static final Map<String, String> TYPE_NAMES = new LinkedHashMap<>();
    static {
        TYPE_NAMES.put("GENERAL", "생활쓰레기");
        TYPE_NAMES.put("FOOD", "음식물");
        TYPE_NAMES.put("RECYCLE", "재활용");
    }

    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final int hour;
    /** 오늘 이미 확인했는데 보낼 것이 없던 회원(회원 번호 + 주소). 매분 다시 찾지 않으려고. 날짜가 바뀌면 비움 */
    private LocalDate checkedDate;
    private final Set<String> checked = new HashSet<>();

    public TrashReminderService(JdbcTemplate jdbc, AuthRepository auth, @Value("${zip.trash.reminder-hour:0}") int hour) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.hour = hour;
    }

    /** 배출표 한 종류 요약: 가장 이른 시작 시각, 장소 개수, (하나뿐일 때) 장소 */
    record TypeSummary(String type, LocalTime start, int places, String place) {}

    /** now 시각에 보낼 알림을 만들고 만든 개수를 돌려줌. 스케줄러가 매분 부름 (테스트는 시각을 직접 넘김) */
    public synchronized int sendDue(Instant now) {
        var local = now.atZone(ZONE);
        if (local.getHour() < hour) return 0;
        LocalDate today = local.toLocalDate();
        if (!today.equals(checkedDate)) { checkedDate = today; checked.clear(); }
        Timestamp notifyAt = Timestamp.from(today.atTime(hour, 0).atZone(ZONE).toInstant());
        int weekday = today.getDayOfWeek().getValue() % 7; // DB 규칙 0=일 ~ 6=토 (Java 는 7=일)

        // 주소(내 집 주소 → 없으면 회원 주소)가 있고, 알림을 켰고, 오늘 쓰레기 알림을 아직 안 받은 회원
        var owners = jdbc.query("""
            SELECT s.user_id, COALESCE(NULLIF(TRIM(s.home_address), ''), TRIM(u.address)) FROM user_settings s JOIN users u ON u.id = s.user_id
            WHERE s.noti_on = TRUE AND COALESCE(NULLIF(TRIM(s.home_address), ''), NULLIF(TRIM(u.address), '')) IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = s.user_id AND n.noti_type = 'TRASH' AND n.notify_at = ?)
            """, (rs, row) -> Map.entry(rs.getLong(1), rs.getString(2)), notifyAt);
        if (owners.isEmpty()) return 0;
        var districts = auth.districts();
        // 이번 확인에서 동네 배출표는 동네마다 한 번만 읽음 (같은 동네 회원이 많아도 DB 를 회원 수만큼 읽지 않게)
        var regionRows = new HashMap<Long, List<KindRow>>();
        int sent = 0;
        for (var owner : owners) {
            String key = owner.getKey() + ":" + owner.getValue();
            if (checked.contains(key)) continue;
            var region = RegionMatcher.match(owner.getValue(), districts);
            if (region.isEmpty()) { checked.add(key); continue; } // 주소에서 동네를 못 찾음
            long regionId = Long.parseLong(region.get());
            var rows = regionRows.computeIfAbsent(regionId, this::kindRows);
            if (rows.isEmpty()) { // 배출표가 아예 없는 동네: 안내를 한 번만 (그 뒤로는 아무것도 안 보냄)
                sent += sendNoDataOnce(owner.getKey(), regionId, districts, now);
                checked.add(key);
                continue;
            }
            var schedules = summaries(rows, weekday);
            if (schedules.isEmpty()) { checked.add(key); continue; } // 오늘은 배출 없음
            int inserted = jdbc.update("""
                INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at, created_at)
                SELECT ?, 'TRASH', ?, ?, NULL, ?, ?, ? FROM user_settings WHERE user_id = ?
                  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = ? AND n.noti_type = 'TRASH' AND n.notify_at = ?)
                """, owner.getKey(), TITLE, body(schedules), regionId, notifyAt, Timestamp.from(now),
                owner.getKey(), owner.getKey(), notifyAt);
            sent += inserted;
        }
        return sent;
    }

    /** "배출 정보가 없어요" 안내: (회원, 동네)마다 한 번만. 회원이 지운 안내도 다시 만들지 않음 */
    private int sendNoDataOnce(long userId, long regionId, List<RegionMatcher.District> districts, Instant now) {
        String name = districts.stream().filter(d -> d.id().equals(String.valueOf(regionId))).findFirst()
            .map(d -> d.parentName().equals(d.name()) ? d.name() : d.parentName() + " " + d.name()).orElse("우리 동네");
        String body = name + "는 공공데이터에 배출 요일 정보가 없어 쓰레기 배출일 알림을 보내지 않아요. 배출 요일은 시 · 군 · 구청 안내를 확인해 주세요.";
        var at = Timestamp.from(now);
        return jdbc.update("""
            INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at, created_at)
            SELECT ?, 'TRASH', ?, ?, NULL, ?, ?, ? FROM user_settings WHERE user_id = ?
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = ? AND n.noti_type = 'TRASH' AND n.title = ? AND n.ref_id = ?)
            """, userId, NO_DATA_TITLE, body, regionId, at, at, userId, userId, NO_DATA_TITLE, regionId);
    }

    /** DB 요일 이름 (SET 값, 0=일 ~ 6=토 순서) */
    private static final List<String> DAY_NAMES = List.of("일", "월", "화", "수", "목", "금", "토");

    /** 동네 배출표 한 줄의 한 종류: 요일 글자("월,수,금") · 시작 시각 · 장소 */
    private record KindRow(String type, String days, LocalTime start, String place) {}

    /** 동네 배출표를 종류별 줄로 (요일이 있는 종류만). 비어 있으면 그 동네는 배출표가 없음 */
    private List<KindRow> kindRows(long regionId) {
        var kinds = new ArrayList<KindRow>();
        jdbc.query("""
            SELECT place, general_days, general_time, food_days, food_time, recycle_days, recycle_time FROM trash_schedules WHERE region_id = ?
            """, rs -> {
            String place = rs.getString(1);
            String[] types = {"GENERAL", "FOOD", "RECYCLE"};
            for (int i = 0; i < types.length; i++) {
                String days = rs.getString(2 + i * 2);
                var time = rs.getTime(3 + i * 2);
                if (days != null && !days.isEmpty() && time != null) kinds.add(new KindRow(types[i], days, time.toLocalTime(), place));
            }
        }, regionId);
        return kinds;
    }

    /** 오늘 요일이 든 종류마다: 가장 이른 시작 시각, 장소 개수, (하나뿐일 때) 장소 */
    private static List<TypeSummary> summaries(List<KindRow> kinds, int weekday) {
        String today = DAY_NAMES.get(weekday);
        var ordered = new ArrayList<TypeSummary>();
        for (String type : TYPE_NAMES.keySet()) {
            var todays = kinds.stream().filter(k -> k.type().equals(type) && List.of(k.days().split(",")).contains(today)).toList();
            if (todays.isEmpty()) continue;
            var places = todays.stream().map(KindRow::place).distinct().toList();
            var start = todays.stream().map(KindRow::start).min(LocalTime::compareTo).orElseThrow();
            ordered.add(new TypeSummary(type, start, places.size(), places.get(0)));
        }
        return ordered;
    }

    /**
     * 알림 설명 예: "생활쓰레기 · 음식물 · 재활용 · 18:00부터 · 내 집 혹은 내 점포 앞"
     * 종류마다 시각이 다르면 "생활쓰레기 18:00 · 재활용 20:00부터". 00:00 은 시간 제한 없음과 섞여 있어서 시각을 빼요.
     * 장소가 여러 곳(마을 · 거점마다 다른 군 지역)이면 장소 대신 "배출장소는 사는 곳마다 달라요".
     */
    static String body(List<TypeSummary> types) {
        var times = types.stream().map(TypeSummary::start).filter(t -> !t.equals(LocalTime.MIDNIGHT)).distinct().toList();
        var parts = new ArrayList<String>();
        if (times.size() <= 1) {
            parts.add(String.join(" · ", types.stream().map(t -> TYPE_NAMES.get(t.type())).toList()));
            if (times.size() == 1) parts.add(times.get(0) + "부터");
        } else {
            parts.add(String.join(" · ", types.stream().map(t -> TYPE_NAMES.get(t.type())
                + (t.start().equals(LocalTime.MIDNIGHT) ? "" : " " + t.start())).toList()) + "부터");
        }
        var places = types.stream().filter(t -> t.places() == 1).map(TypeSummary::place).distinct().toList();
        boolean onePlace = places.size() == 1 && types.stream().allMatch(t -> t.places() == 1);
        parts.add(onePlace ? places.get(0) : "배출장소는 사는 곳마다 달라요");
        String text = String.join(" · ", parts);
        return text.length() <= 200 ? text : text.substring(0, 199) + "…";
    }
}

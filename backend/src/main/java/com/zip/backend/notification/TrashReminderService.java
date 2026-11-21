package com.zip.backend.notification;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.auth.RegionMatcher;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 쓰레기 배출일 아침 알림. 회원이 등록한 집 주소(user_settings.home_address)에서 시군구를 찾고(RegionMatcher),
 * 그 동네 쓰레기 배출표(trash_schedules)에 오늘 요일이 있으면 아침 7시(한국 시간)에 알림(TRASH)을 하나 만든다.
 * 서버가 7시에 꺼져 있었으면 켜진 뒤 그날 안에 만든다(알릴 시각은 그날 7시). 같은 날 두 번 만들지 않는다.
 */
@Service
public class TrashReminderService {
    /** 배출표가 한국 공공데이터라서 한국 시간 기준 */
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    static final String TITLE = "오늘은 쓰레기 배출일이에요";
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
    /** 오늘 이미 확인했는데 배출표가 없던 회원(회원 번호 + 주소). 매분 다시 찾지 않으려고. 날짜가 바뀌면 비움 */
    private LocalDate checkedDate;
    private final Set<String> checked = new HashSet<>();

    public TrashReminderService(JdbcTemplate jdbc, AuthRepository auth, @Value("${zip.trash.reminder-hour:7}") int hour) {
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

        // 집 주소가 있고, 알림을 켰고, 오늘 쓰레기 알림을 아직 안 받은 회원
        var owners = jdbc.query("""
            SELECT s.user_id, s.home_address FROM user_settings s
            WHERE s.home_address IS NOT NULL AND TRIM(s.home_address) <> '' AND s.noti_on = TRUE
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = s.user_id AND n.noti_type = 'TRASH' AND n.notify_at = ?)
            """, (rs, row) -> Map.entry(rs.getLong(1), rs.getString(2)), notifyAt);
        if (owners.isEmpty()) return 0;
        var districts = auth.districts();
        int sent = 0;
        for (var owner : owners) {
            String key = owner.getKey() + ":" + owner.getValue();
            if (checked.contains(key)) continue;
            var region = RegionMatcher.match(owner.getValue(), districts);
            var schedules = region.map(id -> summaries(Long.parseLong(id), weekday)).orElse(List.of());
            if (schedules.isEmpty()) { checked.add(key); continue; } // 주소에서 동네를 못 찾았거나 오늘 배출 없음
            int inserted = jdbc.update("""
                INSERT INTO notifications (user_id, noti_type, title, body, link_view, ref_id, notify_at, created_at)
                SELECT ?, 'TRASH', ?, ?, NULL, ?, ?, ? FROM user_settings WHERE user_id = ?
                  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = ? AND n.noti_type = 'TRASH' AND n.notify_at = ?)
                """, owner.getKey(), TITLE, body(schedules), Long.parseLong(region.get()), notifyAt, Timestamp.from(now),
                owner.getKey(), owner.getKey(), notifyAt);
            sent += inserted;
        }
        return sent;
    }

    /** DB 요일 이름 (SET 값, 0=일 ~ 6=토 순서) */
    private static final List<String> DAY_NAMES = List.of("일", "월", "화", "수", "목", "금", "토");

    /** 동네 배출표 한 줄의 한 종류: 요일 글자("월,수,금") · 시작 시각 · 장소 */
    private record KindRow(String type, String days, LocalTime start, String place) {}

    /** 오늘 요일이 든 종류마다: 가장 이른 시작 시각, 장소 개수, (하나뿐일 때) 장소 */
    private List<TypeSummary> summaries(long regionId, int weekday) {
        String today = DAY_NAMES.get(weekday);
        var kinds = new ArrayList<KindRow>();
        jdbc.query("""
            SELECT place, general_days, general_time, food_days, food_time, recycle_days, recycle_time FROM trash_schedules WHERE region_id = ?
            """, rs -> {
            String place = rs.getString(1);
            String[] types = {"GENERAL", "FOOD", "RECYCLE"};
            for (int i = 0; i < types.length; i++) {
                String days = rs.getString(2 + i * 2);
                var time = rs.getTime(3 + i * 2);
                if (days != null && time != null) kinds.add(new KindRow(types[i], days, time.toLocalTime(), place));
            }
        }, regionId);
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

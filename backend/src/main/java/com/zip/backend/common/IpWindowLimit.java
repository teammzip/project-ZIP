package com.zip.backend.common;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 접속한 곳(IP)마다 "짧은 시간 N번 · 하루 M번"까지만 허락하는 메모리 제한.
 * 로그인 전 API(인증 메일 등)는 회원으로 구분할 수 없어서 IP 로 센다. 서버를 다시 켜면 처음부터 셈(남용 방지용이라 충분).
 * 서버가 여러 대면 각자 따로 세고, 프록시 뒤에서는 진짜 IP 설정(server.forward-headers-strategy)이 있어야 사람마다 나뉜다.
 * 나중에 로그인 IP 제한에도 그대로 쓸 수 있게 일반 클래스로 둠.
 */
public class IpWindowLimit {
    private static final Duration DAY = Duration.ofDays(1);
    // 기억하는 IP 가 너무 많아지면 하루 지난 기록부터 비움 (메모리가 끝없이 늘지 않게)
    private static final int MAX_TRACKED = 10_000;

    public enum Result { OK, SHORT_LIMIT, DAY_LIMIT }

    private final Duration window;
    private final int windowMax;
    private final int dayMax;
    private final Map<String, Deque<Instant>> calls = new ConcurrentHashMap<>();

    public IpWindowLimit(Duration window, int windowMax, int dayMax) {
        if (window.isNegative() || window.isZero() || window.compareTo(DAY) > 0 || windowMax <= 0 || dayMax < windowMax) {
            throw new IllegalArgumentException("IP 제한 설정을 확인해 주세요 (짧은 시간 ≤ 하루, 0 < 짧은 시간 횟수 ≤ 하루 횟수)");
        }
        this.window = window;
        this.windowMax = windowMax;
        this.dayMax = dayMax;
    }

    /** 허락하면 이번 요청을 기록하고 OK. 넘었으면 기록하지 않고 어느 제한에 걸렸는지 돌려줌 */
    public Result acquire(String ip, Instant now) {
        String key = ip == null || ip.isBlank() ? "unknown" : ip;
        if (calls.size() >= MAX_TRACKED) forgetOld(now);
        var list = calls.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (list) {
            while (!list.isEmpty() && !list.peekFirst().plus(DAY).isAfter(now)) list.pollFirst();
            if (list.size() >= dayMax) return Result.DAY_LIMIT;
            long recent = list.stream().filter(at -> at.plus(window).isAfter(now)).count();
            if (recent >= windowMax) return Result.SHORT_LIMIT;
            list.addLast(now);
            return Result.OK;
        }
    }

    private void forgetOld(Instant now) {
        calls.entrySet().removeIf(entry -> {
            synchronized (entry.getValue()) {
                var last = entry.getValue().peekLast();
                return last == null || !last.plus(DAY).isAfter(now);
            }
        });
        if (calls.size() >= MAX_TRACKED) calls.clear(); // 하루 안에 1만 곳 이상이면 기록을 새로 시작 (메모리 우선)
    }
}

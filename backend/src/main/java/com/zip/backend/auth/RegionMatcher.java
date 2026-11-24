package com.zip.backend.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Finds the 구·군 (level-2 region) an address points at, e.g. "서울 마포구 합정동" → 마포구.
 * A district name alone decides when it is unique; names shared by several cities (중구, 동구 …)
 * also need the 시·도 in the address ("서울시", "서울특별시", "서울" all match 서울특별시).
 */
public final class RegionMatcher {
    public record District(String id, String name, String parentName) {
        public String displayName() {
            return parentName == null || parentName.equals(name) ? name : parentName + " " + name;
        }
    }

    private static final List<String> SIDO_SUFFIXES = List.of("특별자치시", "특별자치도", "특별시", "광역시", "시", "도");
    // 전남광주통합 · 광주 · 전라남 · 전남 → 전남광주: 2026-07-01 광주광역시 · 전라남도가 전남광주통합특별시로 통합돼서 예전 이름도 같은 시 · 도로 봄
    private static final Map<String, String> SIDO_SHORT = Map.of(
        "충청북", "충북", "충청남", "충남", "전라북", "전북", "경상북", "경북", "경상남", "경남",
        "전남광주통합", "전남광주", "광주", "전남광주", "전라남", "전남광주", "전남", "전남광주");

    private RegionMatcher() {}

    public static Optional<String> match(String address, List<District> districts) {
        if (address == null || address.isBlank()) return Optional.empty();
        Set<String> tokens = Arrays.stream(address.strip().split("[\\s,]+")).collect(Collectors.toSet());
        var byName = districts.stream().filter(d -> tokens.contains(d.name())).toList();
        if (byName.size() == 1) return Optional.of(byName.get(0).id());
        if (byName.isEmpty()) return Optional.empty();
        Set<String> sido = tokens.stream().map(RegionMatcher::sido).collect(Collectors.toSet());
        var bySido = byName.stream().filter(d -> d.parentName() != null && sido.contains(sido(d.parentName()))).toList();
        return bySido.size() == 1 ? Optional.of(bySido.get(0).id()) : Optional.empty();
    }

    /**
     * 주소 여러 개를 앞에서부터 시도해 처음 찾아지는 동네. 쓰레기 배출 알림 · 배출표 화면이 씀:
     * 내 집 주소(직접 입력이라 "마포 합정동"처럼 시군구가 빠질 수 있음)로 못 찾으면 회원 주소(주거 설문 · 동네 인증)로 다시 찾음
     */
    public static Optional<String> matchFirst(List<District> districts, String... addresses) {
        for (String address : addresses) {
            var found = match(address, districts);
            if (found.isPresent()) return found;
        }
        return Optional.empty();
    }

    /** "서울특별시" · "서울시" · "서울" → "서울", "충청북도" · "충북" → "충북" */
    private static String sido(String name) {
        for (String suffix : SIDO_SUFFIXES) {
            if (name.length() > suffix.length() + 1 && name.endsWith(suffix)) {
                name = name.substring(0, name.length() - suffix.length());
                break;
            }
        }
        return SIDO_SHORT.getOrDefault(name, name);
    }
}

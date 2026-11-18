package com.zip.backend.auth;

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
    public record District(String id, String name, String parentName) {}

    private static final List<String> SIDO_SUFFIXES = List.of("특별자치시", "특별자치도", "특별시", "광역시", "시", "도");
    private static final Map<String, String> SIDO_SHORT = Map.of(
        "충청북", "충북", "충청남", "충남", "전라북", "전북", "전라남", "전남", "경상북", "경북", "경상남", "경남");

    private RegionMatcher() {}

    public static Optional<String> match(String address, List<District> districts) {
        if (address == null || address.isBlank()) return Optional.empty();
        Set<String> tokens = Set.of(address.strip().split("[\\s,]+"));
        var byName = districts.stream().filter(d -> tokens.contains(d.name())).toList();
        if (byName.size() == 1) return Optional.of(byName.get(0).id());
        if (byName.isEmpty()) return Optional.empty();
        Set<String> sido = tokens.stream().map(RegionMatcher::sido).collect(Collectors.toSet());
        var bySido = byName.stream().filter(d -> d.parentName() != null && sido.contains(sido(d.parentName()))).toList();
        return bySido.size() == 1 ? Optional.of(bySido.get(0).id()) : Optional.empty();
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

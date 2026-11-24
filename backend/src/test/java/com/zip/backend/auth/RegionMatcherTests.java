package com.zip.backend.auth;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class RegionMatcherTests {
    private static final List<RegionMatcher.District> DISTRICTS = List.of(
        new RegionMatcher.District("1", "마포구", "서울특별시"),
        new RegionMatcher.District("2", "중구", "서울특별시"),
        new RegionMatcher.District("3", "중구", "부산광역시"),
        new RegionMatcher.District("4", "청주시", "충청북도"),
        new RegionMatcher.District("5", "동구", "대전광역시"),
        new RegionMatcher.District("6", "동구", "대구광역시"));

    private static Optional<String> match(String address) { return RegionMatcher.match(address, DISTRICTS); }

    @Test void matchFirstTriesAddressesInOrder() {
        // 내 집 주소(시군구가 빠짐)로 못 찾으면 회원 주소로, 둘 다 못 찾거나 비면 없음
        assertEquals(Optional.of("4"), RegionMatcher.matchFirst(DISTRICTS, "마포 합정동", "충북 청주시 상당구"));
        assertEquals(Optional.of("1"), RegionMatcher.matchFirst(DISTRICTS, "서울 마포구 합정동", "충북 청주시"));
        assertEquals(Optional.of("1"), RegionMatcher.matchFirst(DISTRICTS, null, "마포구"));
        assertEquals(Optional.empty(), RegionMatcher.matchFirst(DISTRICTS, "마포 합정동", null));
        assertEquals(Optional.empty(), RegionMatcher.matchFirst(DISTRICTS));
    }

    @Test void uniqueDistrictMatchesWithoutCity() {
        assertEquals(Optional.of("1"), match("서울 마포구 합정동 123-4"));
        assertEquals(Optional.of("1"), match("마포구"));
        assertEquals(Optional.of("1"), match("합정동, 마포구, 서울특별시"));
    }

    @Test void sharedDistrictNeedsTheCityInAnyCommonForm() {
        assertEquals(Optional.of("2"), match("서울 중구 명동"));
        assertEquals(Optional.of("2"), match("서울시 중구"));
        assertEquals(Optional.of("3"), match("부산광역시 중구 남포동"));
        assertEquals(Optional.of("3"), match("부산 중구"));
        assertEquals(Optional.of("5"), match("대전 동구"));
        assertEquals(Optional.empty(), match("중구 명동"));
    }

    @Test void provinceAbbreviationsMatch() {
        assertEquals(Optional.of("4"), match("충북 청주시 상당구"));
    }

    // 2026-07-01 광주 · 전남 통합: 새 이름 · 짧은 이름 · 예전 이름 모두 전남광주통합특별시의 구로 찾아야 함
    @Test void mergedGwangjuJeonnamMatchesNewAndOldNames() {
        var districts = List.of(
            new RegionMatcher.District("7", "동구", "전남광주통합특별시"),
            new RegionMatcher.District("5", "동구", "대전광역시"),
            new RegionMatcher.District("8", "광주시", "경기도"));
        assertEquals(Optional.of("7"), RegionMatcher.match("전남광주통합특별시 동구 충장로", districts));
        assertEquals(Optional.of("7"), RegionMatcher.match("전남광주 동구", districts));
        assertEquals(Optional.of("7"), RegionMatcher.match("광주광역시 동구", districts));
        assertEquals(Optional.of("5"), RegionMatcher.match("대전 동구", districts));
        assertEquals(Optional.of("8"), RegionMatcher.match("경기 광주시 오포읍", districts));
    }

    @Test void unknownOrPartialNamesDoNotMatch() {
        assertEquals(Optional.empty(), match("서울 서대문구"));
        assertEquals(Optional.empty(), match("마포구청역 근처"));
        assertEquals(Optional.empty(), match("  "));
        assertEquals(Optional.empty(), match(null));
    }
}

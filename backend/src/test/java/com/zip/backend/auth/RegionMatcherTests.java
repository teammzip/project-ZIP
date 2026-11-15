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

    @Test void unknownOrPartialNamesDoNotMatch() {
        assertEquals(Optional.empty(), match("서울 서대문구"));
        assertEquals(Optional.empty(), match("마포구청역 근처"));
        assertEquals(Optional.empty(), match("  "));
        assertEquals(Optional.empty(), match(null));
    }
}

package com.zip.backend.settings;

import java.math.BigDecimal;

public record SettingsResponse(BigDecimal rent, int rentDay, String moveIn, String contractEnd, boolean notiOn,
    String homeAddress, String regionId, String regionName, RegionLocation regionLocation) {
    public record RegionLocation(String region, String source, Point point) {}
    public record Point(BigDecimal lat, BigDecimal lon) {}
}

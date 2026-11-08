package com.zip.backend.map;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** 카카오 로컬 API (https://developers.kakao.com/docs/latest/ko/local/dev-guide). 키는 서버 설정에만 둠 */
@Component
public class KakaoLocalClient {
    /** 카카오 응답의 장소 한 곳 (필드 이름은 카카오 JSON 그대로) */
    public record Document(String id, String place_name, String category_name, String category_group_code,
        String phone, String address_name, String road_address_name, String x, String y) {}

    record Response(List<Document> documents) {}

    private static final int SIZE = 15; // 한 번에 최대 15곳 (카카오 제한)

    private final RestClient rest;
    private final String key;

    public KakaoLocalClient(@Value("${zip.kakao.rest-key:}") String key) {
        this.key = key == null ? "" : key.trim();
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3_000);
        factory.setReadTimeout(5_000);
        this.rest = RestClient.builder().baseUrl("https://dapi.kakao.com").requestFactory(factory).build();
    }

    public boolean enabled() { return !key.isEmpty(); }

    /** 카테고리 코드로 찾기 (CS2 편의점, PM9 약국 …), 가까운 순 */
    public List<Document> category(String code, double lat, double lon, int radius) {
        return documents(rest.get().uri(u -> u.path("/v2/local/search/category.json")
            .queryParam("category_group_code", code).queryParam("x", lon).queryParam("y", lat)
            .queryParam("radius", radius).queryParam("sort", "distance").queryParam("size", SIZE).build())
            .header("Authorization", "KakaoAK " + key).retrieve().body(Response.class));
    }

    /** 키워드로 찾기 (빨래방, 빵집 …), 반경 안에서 가까운 순 */
    public List<Document> keyword(String query, double lat, double lon, int radius) {
        return documents(rest.get().uri(u -> u.path("/v2/local/search/keyword.json")
            .queryParam("query", query).queryParam("x", lon).queryParam("y", lat)
            .queryParam("radius", radius).queryParam("sort", "distance").queryParam("size", SIZE).build())
            .header("Authorization", "KakaoAK " + key).retrieve().body(Response.class));
    }

    /** 키워드로 찾기, 거리 제한 없이 정확도 순 (멀리 있는 유명한 곳 · 정확한 가게 이름) */
    public List<Document> keywordByAccuracy(String query, double lat, double lon) {
        return documents(rest.get().uri(u -> u.path("/v2/local/search/keyword.json")
            .queryParam("query", query).queryParam("x", lon).queryParam("y", lat)
            .queryParam("sort", "accuracy").queryParam("size", SIZE).build())
            .header("Authorization", "KakaoAK " + key).retrieve().body(Response.class));
    }

    private static List<Document> documents(Response response) {
        return response == null || response.documents() == null ? List.of() : response.documents();
    }
}

# 홈 날씨

- `WeatherCard`는 생활 정보의 `settings.region`으로 지역을 조회한다. 동네 저장 시 생활 정보도 함께 변경된다.
- 첫 로그인에서 저장한 주소로 날씨와 지도를 인증 없이 이용한다. 위치 인증이 성공하면 회원 주소와 생활 정보가 인증한 동네로 변경된다. 커뮤니티만 위치 인증이 필요하다.
- 지역은 Nominatim의 대한민국 주소 검색 결과와 입력한 행정구역이 일치할 때만 사용한다. 결과가 없거나 모호하면 지역 수정 안내를 보여준다. GPS 권한은 요청하지 않는다.
- 위치 검색은 입력할 때마다 실행하지 않는다. 저장한 지역만 검색하며 결과는 `zip-weather-place:<지역>`에 90일 저장한다. 같은 탭의 요청은 직렬화하고 1.1초 이상 간격을 둔다.
- 날씨는 Open-Meteo의 현재 기온·WMO 날씨 코드, 일 최저/최고 기온·최대 강수확률, 시간별 예보를 이용한다. 한국 시간 기준으로 2일을 받아 현재 시각부터 12시간을 표시한다.
- React Query 캐시는 10분, 활성 화면의 자동 갱신은 15분이다. 지역 변경 시 이전 지역 정보를 표시하지 않으며 갱신 실패 시 마지막 정보임을 표시한다. 누락된 수치는 0으로 바꾸지 않는다.
- `VITE_WEATHER_GEOCODING_URL`, `VITE_WEATHER_FORECAST_URL`로 동일 응답 형식의 서버 프록시로 교체할 수 있다. 키가 필요한 경우 서버에서 관리하며 프론트 환경변수에 비밀 키를 넣지 않는다.

## 운영 연결

현재 공개 API 연결은 소규모 비상업 개발용이다. Open-Meteo의 상업용 서비스에는 해당 플랜이 필요하다. Nominatim의 초당 1회 제한은 사용자 전체의 합계이므로 공개 운영 전 서버 캐시·호출 제한을 적용하거나 적합한 지오코딩 서비스로 교체해야 한다. 출처 표시는 카드와 상세 모달에 포함되어 있다.

- [Open-Meteo 예보 API](https://open-meteo.com/en/docs)
- [Nominatim 검색 API](https://nominatim.org/release-docs/latest/api/Search/)
- [Nominatim 이용 정책](https://operations.osmfoundation.org/policies/nominatim/)

검증: `node --test tests/weather.test.mjs`

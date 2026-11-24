# 내 집 정보와 대출

2026-11-24 코드 및 계약 확인 · [수집 기준](../raw/index.md#2026-11-24--api-계약-변경-반영) · [위키 색인](../index.md)

서버 모드에서 내 집 정보 폼, 고정 지출의 전세 대출 카드, 납부 시간대 계산은 `useHomeInfo`를 통해 `GET /api/me/home-info` 조회를 공유합니다. 조회 캐시는 회원 ID와 로그인 세션으로 구분됩니다. 서버는 JWT의 회원 ID로 조회·저장 대상을 정합니다. [API 계약](../../frontend/API.md#내-집-정보-서버-연결-2026-11-15) · [프론트 공통 조회](../../frontend/src/features/life/homeApi.ts) · [서버 컨트롤러](../../backend/src/main/java/com/zip/backend/settings/HomeInfoController.java)

| 입력 화면 | 저장 경로 | 저장 후 조회 |
| --- | --- | --- |
| 첫 주거 설문 | `PUT /api/me/housing-onboarding` | 성공 후 공통 조회를 다시 요청합니다. |
| 내 집 정보 | `PUT /api/me/home-info` | 계약·주소·대출 조건을 저장하고 응답을 공통 캐시에 반영합니다. |
| 전세 대출 카드 | `PUT /api/me/home-info/loan` | `{ loan }`으로 대출 조건을 저장하고 응답을 공통 캐시에 반영합니다. `{ "loan": null }`은 이자 자동 기록을 중지합니다. |

금액 입력은 원 단위이며, 응답의 `settings.rent`는 만원 단위입니다. 내 집 정보나 대출 조건을 사용하는 새 화면도 같은 조회 경로를 사용합니다. [API 계약](../../frontend/API.md#내-집-정보-서버-연결-2026-11-15) · [설문 저장 흐름](../../frontend/src/features/onboarding/SurveyPage.tsx) · [앱 실행 모드](application.md)

로그인과 세션 복원 시 공통 조회를 준비하고, 로그아웃이나 계정 변경 시 이전 세션의 조회 캐시를 제거합니다. 저장 시 진행 중인 기존 조회를 취소해 오래된 응답이 저장 결과를 덮어쓰지 않도록 합니다. [공통 조회와 저장](../../frontend/src/features/life/homeApi.ts) · [세션 전환](../../frontend/src/app/setupApi.ts) · [홈 정보 회귀 테스트](../../frontend/tests/home-api.test.mjs)

내 집 정보 응답의 `managementBill`은 고정 지출과 같은 `BillResponse` 형식을 사용합니다. 입주월과 계약 만료월이 있는 월세 계약의 월별 금액, 납부 상태와 월세 알림은 관련 문서에서 확인할 수 있습니다. [계약 고정 지출과 월세 알림](fixed-expenses.md) · [내 집 정보 응답](../../backend/src/main/java/com/zip/backend/settings/HomeInfoService.java) · [청구 응답 DTO](../../backend/src/main/java/com/zip/backend/bills/BillResponse.java)

### 내 집 정보와 첫 주거 설문의 DTO

- 2026-11-25 적용. 조회와 두 저장 API가 `HomeInfoResponse`를 반환합니다. `settings`는 생활 설정 API와 `SettingsResponse`를 공유합니다. 계약·대출·초안·관리비가 없을 때 명시적 `null`, 이자 기록이 없을 때 빈 배열, 대출 초안에서 생략한 필드를 보존합니다. 첫 주거 설문 서비스는 기존 계약·대출을 DTO에서 읽어 생략된 답변에 적용합니다. [내 집 정보 응답 DTO](../../backend/src/main/java/com/zip/backend/settings/HomeInfoResponse.java) · [공통 생활 설정 DTO](../../backend/src/main/java/com/zip/backend/settings/SettingsResponse.java) · [응답 통합 테스트](../../backend/src/test/java/com/zip/backend/HomeInfoTests.java)
- 설문 컨트롤러는 `HousingOnboardingRequest`로 본문을 받고 건너뛰기 `skip`과 부분 답변 `save`를 구분합니다. 생략과 명시적 `null`을 구별하고, 회원과 설문 상태 확인 뒤 답변을 검증합니다. 계약 저장에는 기존 `HomeInfoInput`을 사용합니다. 완료된 설문 재요청은 기존 값을 보존하며, 설문 처리 중 오류가 발생하면 같은 트랜잭션의 주소·생년월일·월급·계약 저장을 롤백합니다. [설문 요청 DTO](../../backend/src/main/java/com/zip/backend/settings/HousingOnboardingRequest.java) · [설문 저장](../../backend/src/main/java/com/zip/backend/settings/HousingOnboardingService.java) · [설문 통합 테스트](../../backend/src/test/java/com/zip/backend/HousingOnboardingTests.java)

## 주소와 회원 설정

2026-11-25에 `c3ed411`의 화면 코드를 확인했습니다. 첫 주거 설문의 ‘사는 곳’은 읽기 전용 칸입니다. ‘검색’을 열어 동네 이름을 입력한 뒤 OpenStreetMap Nominatim의 검색 결과에서 시·군·구 또는 동·읍·면 단위 주소를 선택합니다. 선택하지 않으면 설문 저장 요청에서 주소가 생략됩니다. 도로명과 상세주소를 적을 때는 마이페이지의 ‘내 집 정보’에 있는 ‘내 집 주소’ 칸에 직접 입력합니다. [설문 화면과 저장 요청](../../frontend/src/features/onboarding/SurveyPage.tsx) · [동네 검색](../../frontend/src/features/onboarding/AddressSearch.tsx) · [검색 결과 처리](../../frontend/src/features/onboarding/addressResult.ts) · [내 집 정보 입력](../../frontend/src/features/life/components/MyInfo.tsx)

주거 설문은 주소·주거 조건·대출 정보를 저장하거나 건너뛸 수 있습니다. 대출 정보가 없는 설문은 `home.loan`을 생략하고, 대출 조건 일부만 입력하면 초안으로 저장합니다. 내 집 주소는 고정 지출과 [배출표](trash-schedules.md)에 쓰입니다. [설문 API 계약](../../frontend/API.md#첫-주거-설문) · [주거 설문 서버](../../backend/src/main/java/com/zip/backend/settings/HousingOnboardingService.java) · [홈 날씨 위치](service-integrations.md#홈-날씨-위치) · [동네 인증](community-operations.md#동네-글과-조회-집계)

프로필 사진·캐릭터·소개와 생활 설정은 로그인한 회원의 API로 관리합니다. 개인 정보 편집, 프로필 꾸미기, 내 집 계약·대출에는 각각의 저장 경로가 있습니다. [개인 정보 API](../../backend/src/main/java/com/zip/backend/settings/ProfileInfoController.java) · [생활 설정 API](../../backend/src/main/java/com/zip/backend/settings/SettingsController.java) · [설정·프로필 API 계약](../../frontend/API.md#프로필-꾸미기-사진--한-줄-소개)

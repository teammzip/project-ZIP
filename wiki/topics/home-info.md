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

입주월과 계약 만료월이 있는 월세 계약의 월별 금액, 납부 상태와 월세 알림은 [계약 고정 지출과 월세 알림](fixed-expenses.md)에서 확인할 수 있습니다.

## 주소와 회원 설정

주거 설문은 주소·주거 조건·대출 정보를 저장하거나 건너뛸 수 있습니다. 내 집 주소는 고정 지출과 [배출표](trash-schedules.md)에 쓰입니다. [주거 설문 서버](../../backend/src/main/java/com/zip/backend/settings/HousingOnboardingService.java) · [홈 날씨 위치](service-integrations.md#홈-날씨-위치) · [동네 인증](community-operations.md#동네-글과-조회-집계)

프로필 사진·캐릭터·소개와 생활 설정은 로그인한 회원의 API로 관리합니다. 개인 정보 편집, 프로필 꾸미기, 내 집 계약·대출에는 각각의 저장 경로가 있습니다. [개인 정보 API](../../backend/src/main/java/com/zip/backend/settings/ProfileInfoController.java) · [생활 설정 API](../../backend/src/main/java/com/zip/backend/settings/SettingsController.java) · [설정·프로필 API 계약](../../frontend/API.md#프로필-꾸미기-사진--한-줄-소개)

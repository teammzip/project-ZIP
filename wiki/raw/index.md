# 원자료 목록

[위키 색인](../index.md)

## 2026-11-25 · PR #138~#142 이력 추가

GitHub `dev`의 `250b8d9` 이후 `c3ed4115470eb3044c3ba8508d6a539744c44812`까지 변경 파일 63개를 확인했습니다. `dev`에 직접 병합된 #138·#139·#141·#142와 변경 파일 없이 `backend`에 병합된 #140을 [전체 PR 원자료](pull-requests.md)에 추가했습니다. [GitHub 비교](https://github.com/teammzip/project-ZIP/compare/250b8d9d740a6edf444a763087ba401cc14acf66...c3ed4115470eb3044c3ba8508d6a539744c44812)

## 2026-11-24 · 전체 PR 이력 수집

[전체 PR 원자료](pull-requests.md)에 PR #1~#137 전부의 원문, 변경 파일, 대상 브랜치, 상태 및 Git 버전을 등록했습니다. `dev` 비교 기준은 `250b8d9d740a6edf444a763087ba401cc14acf66`입니다. `dev` 직접 병합 130건은 첫 번째 부모 기준 변경 파일 목록을 대조했고, 그 밖의 PR 7건은 GitHub 메타데이터와 관련 이력을 확인했습니다. 직접 병합 메시지가 없는 `dev` 커밋 5개도 연결했습니다.

현재 동작에 필요한 내용은 주제에 통합했습니다. 예전 HTML 시안, 폐기된 휴대전화 인증, 변경 전 배출 알림 시각, 중복 브랜치 병합과 이미 정리된 문구·스타일 변경은 원자료의 Git 이력에서 찾을 수 있습니다. [현행 구현](../topics/project-status.md#구현된-부분) · [프로젝트 변경 기록](../../CHANGELOG.md)

## 2026-11-24 · 초기 수집

저장소 자료의 기준은 `b0a937d49fa4b8b4fb77b6d60044e7248768c6ba`입니다. 아래 상대 링크는 현재 파일을 엽니다. 당시 원문이 필요하면 `git show <기준 커밋>:<저장소 상대 경로>`로 읽습니다.

| 원자료 | 확인 내용 |
| --- | --- |
| [README.md](../../README.md) | 제품 범위, 로컬 실행과 기능 상태 |
| [frontend/README.md](../../frontend/README.md) · [apiMode.ts](../../frontend/src/lib/apiMode.ts) · [vite.config.ts](../../frontend/vite.config.ts) | 개발 모드와 프록시 |
| [frontend/API.md](../../frontend/API.md) · [backend/README.md](../../backend/README.md) | API 계약, 서버 구성과 테스트 |
| [db/schema.sql](../../db/schema.sql) · [db/README.md](../../db/README.md) · [마이그레이션 안내](../../db/migrations/README.md) · [DB 검증 안내](../../db/tests/README.md) | DB 생성, 변경, 검증 |
| [CalendarBoard.tsx](../../frontend/src/features/life/components/CalendarBoard.tsx) · [TrashScheduleDisclosure.tsx](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [CalendarController.java](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) | 배출표 화면과 요청 경로 |
| [전국 배출표 데이터 SQL](../../db/migrations/20261122_02_trash_schedules_nationwide.sql) | 전국 배출표를 넣는 데이터 마이그레이션 |

위키 구조의 참고 자료는 2026-11-24에 확인한 [Karpathy의 LLM Wiki 가이드](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)입니다.

## 2026-11-24 · API 계약 변경 반영

[frontend/API.md](../../frontend/API.md)의 최신 변경은 `b0a937d49fa4b8b4fb77b6d60044e7248768c6ba`에 포함되어 있습니다. 초기 수집 이후 파일 내용이 같아, 해당 커밋의 직전 버전(`2f8ba7f909c0e99bfa0246230ad8500dae17e3db`)과 비교했습니다. 코드 근거도 같은 수집 커밋을 기준으로 확인했습니다.

| 계약 변경 | 확인한 코드 |
| --- | --- |
| OAuth 성공 콜백 토큰 | [OAuthLoginHandler.java](../../backend/src/main/java/com/zip/backend/auth/OAuthLoginHandler.java) · [OAuthCallbackPage.tsx](../../frontend/src/pages/auth/OAuthCallbackPage.tsx) |
| 내 집 정보·대출 공통 조회 | [homeApi.ts](../../frontend/src/features/life/homeApi.ts) · [SurveyPage.tsx](../../frontend/src/features/onboarding/SurveyPage.tsx) · [HomeInfoController.java](../../backend/src/main/java/com/zip/backend/settings/HomeInfoController.java) |
| 게시글 수와 브라우저 저장 | [useCommunity.ts](../../frontend/src/features/community/useCommunity.ts) · [CommunityController.java](../../backend/src/main/java/com/zip/backend/community/CommunityController.java) · [CommunityRepository.java](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [일정 동기화](../../frontend/src/features/life/calendarSync.ts) · [메모 동기화](../../frontend/src/features/memo/sync.ts) |

## 2026-11-24 · 변경 기록 수집

원자료는 [작업 트리의 CHANGELOG.md](../../CHANGELOG.md)입니다. Git blob 해시 `0a573afcc333c0154606001084d32fdaf0280009`의 파일을 기준 커밋 `b0a937d49fa4b8b4fb77b6d60044e7248768c6ba`와 비교했습니다. 백엔드·DB·프론트엔드의 2026-11-24 항목 세 건이 미커밋 변경으로 추가되어 있었습니다. 아래 구현 근거는 기준 커밋에서 확인했습니다.

| 변경 기록 | 구현·계약 근거 |
| --- | --- |
| [백엔드](../../CHANGELOG.md#백엔드) · 공개 게시글 수와 카카오 장소 식별자 | [게시글 집계](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [백엔드 장소 키](../../backend/src/main/java/com/zip/backend/map/KakaoPlaceId.java) · [프론트 장소 키](../../frontend/src/features/map/kakaoPlaceId.ts) |
| [DB](../../CHANGELOG.md#db) · 기념일 마이그레이션 통합 | [통합 SQL](../../db/migrations/20261031_02_event_anniversaries.sql) · [마이그레이션 안내](../../db/migrations/README.md#구형-기념일-컬럼-정리) · [격리 MySQL 검사](../../db/tests/run-isolated-mysql.cjs) |
| [프론트엔드](../../CHANGELOG.md#프론트엔드) · 회원별 생활 기록과 가계부 메모, 내 집 정보, OAuth 및 모의 API | [공통 목록 동기화](../../frontend/src/lib/listSync.ts) · [가계부 임시 메모](../../frontend/src/features/life/ledgerMemoNavigation.ts) · [메모 확정](../../frontend/src/features/memo/sync.ts) · [기존 API 계약 수집](#2026-11-24--api-계약-변경-반영) |

## 2026-11-24 · 작업과 검증 이력 보완

2026-11-24 GitHub 비교 응답에서 `dev`는 `250b8d9d740a6edf444a763087ba401cc14acf66`, `backend`는 `b0a937d49fa4b8b4fb77b6d60044e7248768c6ba`임을 확인했습니다. 두 커밋의 트리는 `5608f1cdb98a326316ff30fd3a22ece9edb94743`로 동일합니다. 아래 코드의 확인 기준은 `250b8d9`이며, 이력 비교 기준과 실행 환경은 표에 기록합니다. [GitHub dev 커밋](https://github.com/teammzip/project-ZIP/commit/250b8d9d740a6edf444a763087ba401cc14acf66) · [GitHub backend 커밋](https://github.com/teammzip/project-ZIP/commit/b0a937d49fa4b8b4fb77b6d60044e7248768c6ba)

| 작업 이력 | 현재 코드와 문서 근거 |
| --- | --- |
| DB 정합성 수정 `4f0db63` | [마이그레이션 검사 목록](../../db/tests/migration-path.cjs) · [비교 자료 생성기](../../db/tests/generate-schema-audit.cjs) · [DB 검사 안내](../../db/tests/README.md) |
| PR #132 `49be803` · 인증과 계약 비용·알림 | [인증 세션](../../backend/src/main/java/com/zip/backend/auth/AuthSessions.java) · [계약 월별 비용](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java) · [월세 알림](../../backend/src/main/java/com/zip/backend/notification/RentReminderService.java) · [PR #132](https://github.com/teammzip/project-ZIP/pull/132) |
| PR #133~#135 `ee37f2c`·`e5f04a9`·`1762d93` · 전국 데이터, 지도 리뷰 사진·약관 | [전국 이웃 지역](../../db/migrations/20261122_04_region_neighbors_nationwide.sql) · [리뷰 사진](../../db/migrations/20261122_05_place_review_photos.sql) · [약관 SQL](../../db/migrations/20261122_06_terms_privacy_ai.sql) · [변경 기록](../../CHANGELOG.md) |
| PR #136 `2f8ba7f` · 폴더, 배출표, 내 리뷰, AI 한도·접근성 | [메모 폴더 SQL](../../db/migrations/20261122_07_memo_folders.sql) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [내 리뷰 화면](../../frontend/src/pages/my/MyReviewsPage.tsx) · [AI 가이드](../../frontend/src/features/ai/usageGuide.ts) · [PR #136](https://github.com/teammzip/project-ZIP/pull/136) |
| PR #137 `250b8d9` · 현재 기준 | [API 계약 비교](#2026-11-24--api-계약-변경-반영) · [변경 기록 수집](#2026-11-24--변경-기록-수집) · [PR #137](https://github.com/teammzip/project-ZIP/pull/137) |

| 검증 출처 | 확인 범위 |
| --- | --- |
| 2026-11-24 `250b8d9` 점검 | 백엔드와 격리 MySQL은 이전 실행의 Gradle JUnit XML과 격리 DB 결과에서 재확인했습니다. 프론트 빌드와 모바일 WebKit·모의 API 초안 검증은 같은 트리의 실행 기록을 근거로 합니다. 프론트 테스트·DB 정적 검사·린트는 위키 보완 중 다시 확인했습니다. [검증 결과](../topics/project-status.md#검증된-부분) · [백엔드 테스트 안내](../../backend/README.md) · [프론트 테스트 설정](../../frontend/package.json) · [DB 실제 검증 실행기](../../db/tests/run-isolated-mysql.cjs) |
| 2026-11-23 `2f8ba7f` 점검 | 폴더 목록은 React Query 실행으로 관찰했고, 개수 제한은 합성 계정으로 Spring MockMvc에서 재현했습니다. [재현 결과와 코드](../topics/ledger-memos.md#확인된-폴더-문제) |
| 2026-11-20 로컬 검증 문서 | `REAL_MYSQL_UI_VERIFICATION.md`는 `e5f4495`와 당시 미커밋 작업의 격리 MySQL·실제 서버 화면·계정 격리·금액 일치를 기록합니다. `PRIORITY_2_VERIFICATION.md`는 합성 응답으로 확인한 월급·메모·인증·고지서·위치 범위를 기록합니다. 두 문서와 원본 실행 자료는 로컬 작업 자료입니다. [최신 검증 현황](../topics/project-status.md#검증된-부분) |
| 팀원 실제 검증에 대한 사용자 전달 | 실제 이메일·소셜·Gemini·GPS·Kakao와 두 브라우저·모바일·접근성·린트 관련 팀원 점검을 사용자에게서 전달받았습니다. 실행 커밋·환경 및 개별 결과 자료는 확인하지 못했습니다. [외부 서비스 검증 범위](../topics/service-integrations.md) |

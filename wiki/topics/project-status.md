# 구현·검증 현황

2026-11-24 확인 · GitHub `dev` `250b8d9`, 기존 `backend` `b0a937d` · 두 커밋의 파일 트리 동일. [위키 색인](../index.md) · [PR #137](https://github.com/teammzip/project-ZIP/pull/137) · [수집 및 검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완)

## 구현된 부분

| 영역 | 구현 문서 |
| --- | --- |
| 계정·인증 | [인증과 토큰 재발급](application.md#인증과-토큰-재발급) · [계정 전환과 브라우저 저장](application.md#서버-데이터와-브라우저-저장) |
| 주거·가계부 | [내 집 정보](home-info.md) · [가계부와 메모](ledger-memos.md) · [계약 고정 지출](fixed-expenses.md) |
| 일정·메모·알림 | [일정·알림](calendar-notifications.md) · [배출표](trash-schedules.md) · [폴더와 메모 동기화](ledger-memos.md#폴더와-메모-동기화) |
| 동네·지도 | [동네 글과 조회 집계](community-operations.md#동네-글과-조회-집계) · [지도](map-place-ids.md) · [홈 날씨 위치](service-integrations.md#홈-날씨-위치) |
| 지원·운영 | [문의·공지·회원 제재](community-operations.md#문의공지회원-제재) |
| AI·화면 | 모바일 레이아웃을 반영했습니다. [외부 서비스와 AI](service-integrations.md) · [화면 접근과 공통 모달](application.md#화면-접근과-공통-모달) |
| DB | [데이터베이스와 검증](database.md) · [리뷰 사진과 약관 마이그레이션 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |

PR #137에 해당하는 11월 24일 변경 기록은 `51cfc1a`로 `backend`에 반영됐습니다. [프로젝트 변경 기록](../../CHANGELOG.md) · [수집 당시 기록](../raw/index.md#2026-11-24--변경-기록-수집)

## 구현해야 될 부분

- 출시용 처리방침의 클라우드 업체와 데이터 보관 국가를 확정해야 합니다. [약관 현황](service-integrations.md)
- 2026-11-25 코드 점검에서 출시 전에 보완할 항목을 확인했습니다(구현 변경 없음).
  - **화면 오류 처리**: 같은 날 해결했습니다. 최상위 경로의 `errorElement`가 화면 오류를 안내 화면(새로고침 · 홈으로)으로 바꾸고, 배포 뒤 옛 화면 파일을 받지 못한 오류는 10초에 한 번까지 자동으로 새로고침합니다. [라우터](../../frontend/src/app/router.tsx) · [오류 화면](../../frontend/src/pages/RouteErrorPage.tsx) · [옛 파일 판별](../../frontend/src/lib/staleChunk.ts)
  - **사진 업로드**: 같은 날 회원당 24시간 50장 · 아직 연결하지 않은 사진 20장 제한을 추가했습니다. 연결되지 않은 사진은 기존 정리 작업이 7일 뒤 지웁니다(처음 기록에서 이 정리가 없다고 적은 것을 정정). [업로드와 미사용 사진 정리](../../backend/src/main/java/com/zip/backend/files/ProfileFileService.java) · [검증](../../backend/src/test/java/com/zip/backend/RateLimitTests.java)
  - **인증 메일 발송 제한**: 같은 날 IP별(10분 5통 · 하루 20통)과 서버 전체(시간당 100통 · 하루 400통) 상한을 추가했습니다. 프록시 뒤 실제 IP는 2026-11-27에 `server.forward-headers-strategy=native`를 기본값으로 두어 해결했습니다. 실제 Tomcat 테스트로 사람마다 나뉘는 것과 https 쿠키를 확인했습니다([프록시 헤더](application.md#인증과-토큰-재발급)). 봇 확인(CAPTCHA)·운영 메일 서비스는 출시 때 검토합니다. [발송 제한](application.md#인증과-토큰-재발급) · [이메일 인증](../../backend/src/main/java/com/zip/backend/auth/emailcheck/EmailAuthService.java)
  - **PR 자동 테스트**: 같은 날 [테스트 워크플로](../../.github/workflows/test.yml)를 추가했습니다. `dev` 대상 PR과 `dev` 푸시에서 백엔드 테스트(H2), 프론트 테스트·린트·빌드, DB 정적 검사를 실행합니다. GitHub에서 첫 실행 결과를 확인해야 하며, 병합 조건으로 쓰려면 저장소 관리자가 필수 상태 검사로 지정합니다. [위키 누락 검사](../../.github/workflows/second-brain.yml)는 그대로입니다.
  - **무료 공개 API**: 동네 검색·위치 확인·날씨 지역 찾기가 브라우저에서 OpenStreetMap Nominatim을 직접 호출하고 날씨는 Open-Meteo를 씁니다. 운영 규모의 사용 조건과 처리방침의 외부 전송 항목을 출시 전에 확인합니다. [동네 검색](../../frontend/src/features/onboarding/AddressSearch.tsx) · [날씨 안내](../../frontend/src/features/weather/README.md) · [외부 서비스와 AI](service-integrations.md)
- **다른 기기의 동네 인증이 커뮤니티에 반영되지 않음**(2026-11-26 확인 · 같은 날 해결): 서버 모드의 커뮤니티 입구가 서버 인증 시각과 함께 브라우저 생활 설정의 동네 이름(`settings.region`)을 요구해, 다른 기기에서 인증했거나 브라우저 데이터를 지운 회원에게 다시 인증하라는 안내가 떴습니다. 이제 브라우저의 동네 이름이 비면 로그인 응답의 회원 동네 이름을 씁니다. 임시 DB 서버에서 한 기기로 인증한 뒤 저장소를 비운 브라우저로 로그인해 커뮤니티 입장과 글쓰기를, 인증 시각을 지운 뒤에는 다시 안내가 뜨는 것을 확인했습니다. 같은 날 날씨 · 홈 · 동네 지도도 서버의 동네 인증을 쓰도록 고쳤습니다([홈 날씨 위치](service-integrations.md#홈-날씨-위치)). [동네 인증 규칙](community-operations.md#동네-글과-조회-집계) · [판정 규칙](../../frontend/src/features/life/regionVerification.ts)

## 검증된 부분

| 기준과 환경 | 결과 |
| --- | --- |
| 2026-11-26 `ac23a70` 기준 메모·지도 변경 복구 | 프론트 테스트 198개, 빌드, 경고를 오류로 처리한 린트 통과. 지도와 메모의 `react(set-state-in-effect)` 경고 0건. [지도 검색](map-place-ids.md#장소-검색과-저장-리스트) · [메모 복구](ledger-memos.md) · [복구 기록](../log.md#2026-11-26-record--메모지도-변경-복구와-공용-api-문서-동기화) |
| 2026-11-26 월급 설정 응답 DTO 작업 트리 | H2 백엔드 전체 347개와 월급·설문 관련 프론트 5개 통과. [실행 범위](../log.md#2026-11-26-record--월급-설정-응답에-dto-적용) |
| 2026-11-26 커뮤니티 게시글 응답 DTO 작업 트리 | H2 백엔드 전체 345개, 프론트 전체 195개와 빌드 통과. [실행 범위](../log.md#2026-11-26-record--커뮤니티-게시글-응답에-dto-적용) |
| 2026-11-26 공통 회원 응답 DTO 작업 트리 | H2 백엔드 전체 344개와 인증·설문·내 정보 관련 프론트 20개 통과. [실행 범위](../log.md#2026-11-26-record--공통-회원-응답에-dto-적용) |
| 2026-11-25 내 집 정보·첫 주거 설문 DTO 작업 트리 | H2 백엔드 전체 339개와 내 집 정보·설문·대출·월별 지출 관련 프론트 54개 통과. [실행 범위](../log.md#2026-11-25-record--내-집-정보-응답과-첫-주거-설문에-dto-적용) |
| 2026-11-25 `c3ed411` 기준 작업 트리 재검증 | H2 백엔드 336개, 프론트 195개·빌드·린트 경고 0건, DB 정적 7개·격리 MySQL 9.6 72단계 265개, 모바일 WebKit 모의 API 메모 흐름 통과. [실행 범위와 재시도 기록](../log.md#2026-11-25-record--기능-구현과-테스트-재검증) |
| 2026-11-25 `c3ed411` 기준 작업 트리 | 린트 오류·경고 0건, 프론트 테스트 195개, 타입 검사·빌드, DB 정적 검사 7개 통과. [프론트 검증 명령](../../frontend/README.md#변경-검증) · [DB 검증 안내](../../db/tests/README.md) |
| `250b8d9` 로컬 점검 | 백엔드 320개, 프론트 192개, 프론트 빌드 통과. 린트 종료 코드 0, 경고 2건. [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |
| `250b8d9` DB 정적 검사·격리 MySQL 9.6 | [DB 검사 결과](database.md#db-검증-결과) |
| `250b8d9` 모바일 WebKit, 모의 API | 가계부 초안 나중에 쓰기·복구·확정·복귀·선택 삭제와 금액 보존을 확인. [가계부와 메모](ledger-memos.md) · [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |
| PR #132 당시 WebKit·격리 MySQL 9.6 | [계약월 비용·월세 알림 검증 결과](fixed-expenses.md#검증-결과) |
| 2026-11-20 실제 서버·격리 MySQL | 분리된 화면·API·DB에서 두 계정의 조회·수정 격리와 금액 일치 확인. 당시 작업 트리 기준의 역사적 검증입니다. [기존 검증 기록 출처](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |

## 검증해야 될 부분

- **최신 서버 모드의 두 브라우저·두 계정**에서 폴더 변경·삭제 반영, 연결 오류 후 초안 확정 재시도, 재로그인 후 홈 정보 격리를 확인합니다. 모바일과 키보드 검증은 이번에 바뀐 메모 이어쓰기 화면을 포함합니다. [가계부와 메모](ledger-memos.md) · [내 집 정보](home-info.md)
- **팀 배포 DB의 적용 상태**에서 구형 기념일 컬럼·데이터와 전국 배출표·메모 폴더의 적용 여부를 확인합니다. 월말·연말과 시간대 경계에서는 서버 재기동 전후에 월급·계약 기록과 알림이 보존되고 중복되지 않는지 확인합니다. [데이터베이스와 검증](database.md) · [계약 고정 지출](fixed-expenses.md)
- **최신 배포의 외부 연동**에서 변경된 OAuth 콜백과 카카오 검색→즐겨찾기→리뷰 흐름을 확인합니다. 이메일·Gemini·GPS 등은 환경이나 경로가 변경된 경우 [기존 외부 서비스 검증 범위](service-integrations.md#검증-범위)를 다시 확인합니다.
- **운영 가계부 API 응답 시간**은 측정 대기 중입니다. 2026-11-24에 원격 `dev`·`backend`의 목록 코드가 행별 조회를 사용하는 것을 확인했습니다. 일괄 조회 변경은 로컬 작업 트리에서 확인했습니다. 운영 URL, 인증된 테스트 세션, 배포 버전이 확인되면 같은 회원·월을 기준으로 수입·지출 목록의 성공 응답 시간과 거래 건수를 기록합니다. [원격 목록 코드](https://github.com/teammzip/project-ZIP/blob/dev/backend/src/main/java/com/zip/backend/ledger/LedgerController.java#L42) · [가계부 목록 변경](ledger-memos.md#가계부-기록과-회원별-분류)

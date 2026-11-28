# 구현·검증 현황

2026-11-24 확인 · GitHub `dev` `250b8d9`, 기존 `backend` `b0a937d` · 두 커밋의 파일 트리 동일. [위키 색인](../index.md) · [PR #137](https://github.com/teammzip/project-ZIP/pull/137) · [수집 및 검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완)

## 구현된 부분

| 영역 | 구현 문서 |
| --- | --- |
| 계정·인증 | [인증과 토큰 재발급](application.md#인증과-토큰-재발급) · [계정 전환과 브라우저 저장](application.md#서버-데이터와-브라우저-저장) |
| 주거·가계부 | [내 집 정보](home-info.md) · [가계부와 메모](ledger-memos.md) · [계약 고정 지출](fixed-expenses.md) |
| 일정·메모·알림 | [일정·알림](calendar-notifications.md) · [배출표](trash-schedules.md) · [폴더와 메모 동기화](ledger-memos.md#폴더와-메모-동기화). 2026-11-28 결정으로 쓰레기 배출일 알림을 없앴고(배출표 보기로 대신, [배출일 알림](trash-schedules.md#배출일-알림)), 홈 알림 칸은 안 읽은 알림만 보여 줍니다 |
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
  - **PR 자동 테스트**: 같은 날 [테스트 워크플로](../../.github/workflows/test.yml)를 추가했습니다. `dev` 대상 PR과 `dev` 푸시에서 백엔드 테스트(H2), 프론트 테스트·린트·빌드, DB 정적 검사를 실행합니다. PR #147 첫 실행에서 backend·frontend·db 세 작업이 모두 통과했고, `setup-java`·`setup-node` v4가 지원이 끝나는 Node.js 20 기반이라는 경고가 나와 v5로 올렸습니다(`upload-artifact`도 v5). 병합 조건으로 쓰려면 저장소 관리자가 필수 상태 검사로 지정합니다. [위키 누락 검사](../../.github/workflows/second-brain.yml)는 그대로입니다.
  - **무료 공개 API**: 동네 검색·위치 확인·날씨 지역 찾기가 브라우저에서 OpenStreetMap Nominatim을 직접 호출하고 날씨는 Open-Meteo를 씁니다. 운영 규모의 사용 조건과 처리방침의 외부 전송 항목을 출시 전에 확인합니다. [동네 검색](../../frontend/src/features/onboarding/AddressSearch.tsx) · [날씨 안내](../../frontend/src/features/weather/README.md) · [외부 서비스와 AI](service-integrations.md)
- 2026-11-26 배포 전 전체 점검에서 코드 밖에 남은 항목을 확인했습니다(구현 변경 없음).
  - **운영 빌드의 API 모드**: [API 모드 판정](../../frontend/src/lib/apiMode.ts)은 `VITE_USE_MOCK`이 `false`가 아니면 가짜 API를 씁니다. 2026-11-27 dev(`871f95e`)에서 [Vite 설정](../../frontend/vite.config.ts)이 `npm run build` 때 이 값을 `false`로 고정해 해결됐습니다([프론트 운영 빌드](../../frontend/README.md#운영-빌드)).
  - **배포 구성**: 화면은 API를 상대 경로 `/api`로 부르고, 재발급 쿠키는 `SameSite=Lax`·`/api/auth` 경로입니다. 그래서 화면과 API는 같은 도메인에 둬야 하며, 이 전제와 환경변수는 2026-11-27 dev의 [운영 배포 설정](../../backend/README.md#운영-배포-설정)에 정리됐습니다. 남은 것은 배포 방식(미정)에 따라 달라지는 Dockerfile·웹 서버 설정·자동 재시작 설정입니다.
  - **처리방침 수집 항목**(2026-11-27 다시 확인): 5번 외부 전송은 채워졌습니다. 다만 [약관 문구](../../frontend/src/features/legal/content.ts)의 "서비스 이용 중 입력하는 정보"에는 할 일·일정·가계부·커뮤니티 글과 댓글·AI까지만 있고, 프로필 사진·장소 리뷰와 리뷰 사진·커뮤니티 첨부 사진·메모와 폴더·지도 즐겨찾기가 빠져 있습니다. 문구를 바꾸면 DB 약관도 마이그레이션으로 맞춥니다. [약관·소개 화면](service-integrations.md)
  - **커뮤니티 쓰기 횟수**: 글·댓글에는 글자 수 제한만 있고 회원당 쓰기 횟수 제한은 없습니다. [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java)
  - **메모리 기반 제한**: 인증 메일 IP 제한과 카카오 호출 제한은 서버 메모리에서 셉니다. 2026-11-28에 확인해 보니 동네 인증 시도 제한(`RegionVerifyService.attempts`)도 같은 방식입니다. 그래서 재시작하면 초기화되고, 서버가 여러 대면 대마다 따로 셉니다. 사진·AI 하루 제한은 DB에서 셉니다. [IP 제한](../../backend/src/main/java/com/zip/backend/common/IpWindowLimit.java)
- 2026-11-28 코드베이스 전체 분석에서 코드 근거로 확인한 항목입니다(구현 변경 없음).
  - **AI 질문 대기 시간 불일치**: [API 클라이언트](../../frontend/src/lib/apiClient.ts)의 기본 제한은 10초입니다. AI 질문 요청(`POST /api/ai/conversations/{id}/messages`)도 이 기본값을 씁니다. 반면 [Gemini 클라이언트](../../backend/src/main/java/com/zip/backend/ai/GeminiClient.java)는 응답을 30초까지 기다립니다. 답이 10~30초 걸리면 화면은 연결 오류를 보여 주지만, 서버는 답을 저장하고 하루 사용량도 차감합니다. 고지서 사진 요청은 이미 45초로 늘려 두었습니다. 실제 화면 동작은 아직 확인하지 않았습니다.
  - **조회수 중복 증가**: `POST /api/posts/{id}/views`는 누가 보는지 받지 않고 공개 글의 조회수를 매번 1 올립니다([커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) `recordView`). 화면은 같은 화면 안에서만 한 번으로 막습니다. 조회수는 홈 인기 글과 조회순 정렬에 쓰입니다.
  - 2026-11-28 확인: [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java)에 글 목록 `regionId`(다른 동네 둘러보기)가 추가됐습니다. 읽기 전용 조회라 위의 쓰기 횟수 제한·조회수 중복 증가 항목은 그대로 남아 있습니다.
  - **예약 작업 실패 기록**: 월세 알림, 계약 자동 등록, 데이터 정리 작업은(쓰레기 알림 작업은 2026-11-28 제거) 실패할 때 예외 클래스 이름만 로그에 남깁니다(`getSimpleName()`). 메시지와 스택이 없어 원인을 찾기 어렵습니다. [월세 알림 예약 작업](../../backend/src/main/java/com/zip/backend/notification/RentReminderScheduler.java)
  - **화면에서 호출하지 않는 API**는 `731e329`의 정적 점검에서 17개로 기록했습니다. 이후 `0a25818`의 별도 점검과 [PR #153](https://github.com/teammzip/project-ZIP/pull/153) 반영으로 조회 기준과 호출 경로가 달라졌습니다. 이전 점검과 최신 반영 범위는 [화면에서 호출하지 않는 API](application.md#화면에서-호출하지-않는-api)에서 확인할 수 있습니다.
  - **목록 동기화의 거절 처리**: [목록 동기화 엔진](../../frontend/src/lib/listSync.ts)은 서버가 4xx(401·408·429 제외)로 거절한 메모·일정 변경을 버리고 서버 값을 따릅니다. 엔진에는 사용자에게 알리는 단계가 없습니다. 화면에서 따로 안내하는지는 아직 확인하지 않았습니다.
  - **그 밖**: 업로드한 뒤 어디에도 연결하지 않은 사진은 정기적으로 정리하지 않습니다. 회원당 20장 제한이 상한 역할을 합니다. 재발급 토큰은 매번 교체하지만, 교체 전 토큰이 다시 들어와도 그 세션을 끊지 않습니다. DB 뷰 `v_monthly_income`·`v_monthly_spend_breakdown`은 코드 어디에서도 쓰지 않습니다.
- **다른 기기의 동네 인증이 커뮤니티에 반영되지 않음**(2026-11-26 확인 · 같은 날 해결): 서버 모드의 커뮤니티 입구가 서버 인증 시각과 함께 브라우저 생활 설정의 동네 이름(`settings.region`)을 요구해, 다른 기기에서 인증했거나 브라우저 데이터를 지운 회원에게 다시 인증하라는 안내가 떴습니다. 이제 브라우저의 동네 이름이 비면 로그인 응답의 회원 동네 이름을 씁니다. 임시 DB 서버에서 한 기기로 인증한 뒤 저장소를 비운 브라우저로 로그인해 커뮤니티 입장과 글쓰기를, 인증 시각을 지운 뒤에는 다시 안내가 뜨는 것을 확인했습니다. 같은 날 날씨 · 홈 · 동네 지도도 서버의 동네 인증을 쓰도록 고쳤습니다([홈 날씨 위치](service-integrations.md#홈-날씨-위치)). [동네 인증 규칙](community-operations.md#동네-글과-조회-집계) · [판정 규칙](../../frontend/src/features/life/regionVerification.ts)

## 검증된 부분

| 기준과 환경 | 결과 |
| --- | --- |
| 2026-11-28 `6c6079e` 로컬 | 백엔드 전체 H2 352개, 프론트 전체 227개, 린트·타입 검사·운영 빌드, DB 정적 검사 7개, OpenAPI 구문 검사(111경로)가 통과했습니다. [PR #153 반영 기록](../log.md#2026-11-28-record--dev-pr-153-로컬-반영) |
| 2026-11-27 `front` 작업 트리, H2 | `Map`으로 요청을 받는 API 14곳(내 정보 · 동의, 내 정보 생일, 생활 설정, 내 집 정보 · 대출, 월급, 월별 고정 지출 4, 예전 고정 지출 3, 가계부 메모 초안)을 점검했습니다. 정상 요청에서 칸 하나씩만 이상한 값(다른 타입, 빈 값, 아주 큰 수, 5000자 글, 없는 날짜, 객체 · 배열)으로 바꾸고, 본문이 객체가 아닌 경우도 보냈습니다. 서버 오류(5xx)는 0건이었고, 긴 글은 DB에 닿기 전에 400으로 걸러졌습니다. 백엔드 전체 368개가 통과했습니다. [입력 점검 테스트](../../backend/src/test/java/com/zip/backend/MalformedInputTests.java) |
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

- **PR #153의 새 화면 흐름**은 서버를 연결한 브라우저에서 확인합니다. 알림 스위치의 재접속 복원·저장 실패 복구, AI 대화 한 건 삭제, 지도 저장 리스트의 이름·색 저장, 다른 동네 주변 조회, 소셜 첫 동의 화면을 포함합니다. [변경 기록](../../CHANGELOG.md)
- **최신 서버 모드의 두 브라우저·두 계정**에서 폴더 변경·삭제 반영, 연결 오류 후 초안 확정 재시도, 재로그인 후 홈 정보 격리를 확인합니다. 모바일과 키보드 검증은 이번에 바뀐 메모 이어쓰기 화면을 포함합니다. [가계부와 메모](ledger-memos.md) · [내 집 정보](home-info.md)
- **팀 배포 DB의 적용 상태**에서 구형 기념일 컬럼·데이터와 전국 배출표·메모 폴더의 적용 여부를 확인합니다. 월말·연말과 시간대 경계에서는 서버 재기동 전후에 월급·계약 기록과 알림이 보존되고 중복되지 않는지 확인합니다. [데이터베이스와 검증](database.md) · [계약 고정 지출](fixed-expenses.md)
- **최신 배포의 외부 연동**에서 변경된 OAuth 콜백과 카카오 검색→즐겨찾기→리뷰 흐름을 확인합니다. 이메일·Gemini·GPS 등은 환경이나 경로가 변경된 경우 [기존 외부 서비스 검증 범위](service-integrations.md#검증-범위)를 다시 확인합니다.
- **운영 가계부 API 응답 시간**은 측정 대기 중입니다. 2026-11-24에 원격 `dev`·`backend`의 목록 코드가 행별 조회를 사용하는 것을 확인했습니다. 일괄 조회 변경은 로컬 작업 트리에서 확인했습니다. 운영 URL, 인증된 테스트 세션, 배포 버전이 확인되면 같은 회원·월을 기준으로 수입·지출 목록의 성공 응답 시간과 거래 건수를 기록합니다. [원격 목록 코드](https://github.com/teammzip/project-ZIP/blob/dev/backend/src/main/java/com/zip/backend/ledger/LedgerController.java#L42) · [가계부 목록 변경](ledger-memos.md#가계부-기록과-회원별-분류)

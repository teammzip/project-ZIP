# 앱 구조와 실행 모드

2026-11-24 확인 · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

ZIP의 프론트엔드는 React·TypeScript·Vite로 구성됩니다. 실제 서버 모드에서는 프론트의 `/api` 요청을 Spring Boot 백엔드가 처리하고, 백엔드는 JdbcTemplate으로 MySQL에 접근합니다. 개발 중 Vite는 `/api` 요청을 `VITE_PROXY_TARGET`으로 보내며 기본 대상은 `http://localhost:8080`입니다. [프론트 안내](../../frontend/README.md) · [Vite 설정](../../frontend/vite.config.ts) · [백엔드 안내](../../backend/README.md)

| 실행 목적 | 시작 위치와 설정 |
| --- | --- |
| 화면 개발·데모 | `frontend/`에서 `npm install` 후 `npm run dev`. 프론트 개발 서버는 기본 3000 포트에서 실행되며 모의 API가 기본값입니다. |
| 서버 연동 개발 | [DB를 준비](database.md)하고 백엔드 로컬 설정을 채운 뒤, `backend/`에서 `./gradlew.bat bootRun`을 실행합니다. 프론트의 `.env.local`에 `VITE_USE_MOCK=false`를 지정합니다. |

서버의 로컬 설정에는 DB·JWT와 사용하는 외부 서비스의 환경 변수가 들어갑니다. 실제 설정은 Git에서 제외되는 `application-local.properties` 또는 실행 환경에서 관리합니다. OpenAPI 문서는 [백엔드 OpenAPI](../../backend/openapi.yaml), 화면별 데이터 계약은 [프론트 API 문서](../../frontend/API.md)에서 확인합니다. [백엔드 설정](../../backend/README.md#처음-설정)

## API 데이터 계약과 DTO

로그인·회원가입·일정 요청은 Java `record`를 사용합니다. 월별 고정 지출과 가계부는 검증한 저장 요청과 조회 응답에 `record`를 사용합니다. 가계부 컨트롤러는 저장 JSON도 요청 DTO로 받습니다. 내 집 정보는 응답 DTO를 반환하고, 첫 주거 설문은 요청 DTO를 받습니다. [로그인 요청](../../backend/src/main/java/com/zip/backend/auth/AuthRequests.java) · [가입 요청](../../backend/src/main/java/com/zip/backend/auth/signup/SignupRequests.java) · [일정 요청](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) · [가계부 DTO](ledger-memos.md#가계부-저장-트랜잭션) · [내 집 정보와 설문 DTO](home-info.md#내-집-정보와-첫-주거-설문의-dto)

2026-11-24에 가계부·월별 고정 지출·내 집 정보와 연결된 월급·분류·메모 초안·첫 주거 설문 계약을 서버 구현 기준으로 OpenAPI와 프론트에 반영했습니다. OpenAPI는 수입과 기타 지출을 개별 경로로 표현하며 프론트는 각 종류에 맞는 저장 본문을 사용합니다. 월별 고정 지출의 등록·수정 본문과 내 집 정보·대출·설문 본문도 각각의 API에서 받는 키를 기준으로 정의합니다. [OpenAPI](../../backend/openapi.yaml) · [프론트 API](../../frontend/API.md) · [가계부](ledger-memos.md) · [월별 고정 지출](fixed-expenses.md) · [내 집 정보](home-info.md)

### DTO 적용 검토

2026-11-26에 `backend`의 `8f2c998`과 커뮤니티 검색 작업 트리를 기준으로 컨트롤러·서비스와 프론트 타입을 대조했습니다. 생활 API에 이어 인증의 공통 회원 응답에도 DTO를 적용했습니다.

| 상태 | 경계 | 적용 이유 |
| --- | --- | --- |
| 적용 완료 | 월별 고정 지출 등록·수정 입력과 월별 조회 응답 | 등록에는 `tag`와 선택 `name`이 있고 수정에는 둘 다 없습니다. 검증한 입력과 `items`, `housingItems`, `contractPeriod`를 타입으로 표현합니다. [월별 고정 지출 DTO](fixed-expenses.md#일반-고정-지출의-납부와-해지) |
| 적용 완료 | 가계부 수입·지출 저장 요청과 거래 목록 응답 | `incomeType`은 수입에만 필요하고 금액 상한도 수입·지출이 다릅니다. `LedgerRow`는 월급 플래그와 선택 메모 필드를 반환합니다. [가계부 DTO](ledger-memos.md#가계부-저장-트랜잭션) |
| 적용 완료 | 내 집 정보 응답과 첫 주거 설문 요청 | 중첩 응답과 설문의 `save`·`skip`을 타입으로 표현합니다. [내 집 정보와 설문 DTO](home-info.md#내-집-정보와-첫-주거-설문의-dto) |
| 적용 완료 | 로그인·가입·내 정보·설문 완료의 공통 회원 응답 | [공통 회원 응답 DTO](#공통-회원-응답-dto) |
| 적용 완료 | 커뮤니티 게시글 목록·상세 응답 | [게시글 응답 DTO](community-operations.md#게시글-응답-dto) |
| 적용 완료 | 월급 설정·설문 월급 초안 응답 | 마이페이지 수입 정보의 조회·저장에 `SalarySettingsResponse`를 사용합니다. [월급 설정 응답 DTO](fixed-expenses.md#월급-설정-응답-dto) |

로그인·가입·일정·일반 메모와 가계부 분류 요청은 기존 `record`를 활용할 수 있습니다. 약관 응답도 이미 타입이 있습니다. 회원 게시글 수처럼 작은 고정 응답과 월별 수입 합계처럼 월이 키인 `Map<String, Long>`은 현재 표현으로 충분합니다. 내부 JDBC 행과 서비스 값은 공개 응답에서 의미나 필드가 달라질 때 분리합니다. 프로필 PATCH는 필드 생략과 명시적 `null`을 구별하는 현재 파서를 유지하는 것이 적합합니다. [일반 메모 입력](../../backend/src/main/java/com/zip/backend/memo/MemoService.java) · [가계부 분류](../../backend/src/main/java/com/zip/backend/ledger/LedgerCategoryService.java) · [약관 응답](../../backend/src/main/java/com/zip/backend/legal/TermsController.java) · [프로필 PATCH](../../backend/src/main/java/com/zip/backend/auth/ProfilePatch.java)

적용할 때는 JSON 필드명·자료형·금액 단위·필드 생략과 `null`·검증 오류 상태를 기존 HTTP 테스트로 비교합니다. 요청 `record`가 이미 있는 경계도 API 계약과 대조합니다.

#### 공통 회원 응답 DTO

로그인과 회원가입은 `accessToken`과 `user`를 담은 `LoginResponse`를 반환합니다. 내 정보 조회·수정과 첫 주거 설문 완료 응답은 `UserResponse`를 바로 반환합니다. 회원 ID는 문자열입니다. 로그인 아이디가 없으면 `username`을 생략하고, 동네가 없으면 `region`을 `null`로 보냅니다. 개인정보 행이 없으면 `birth`를 생략하고, 행에 생년월일이 없으면 명시적 `null`을 보냅니다. 경고가 없으면 `unseenWarnings`는 빈 배열입니다. [회원 DTO](../../backend/src/main/java/com/zip/backend/auth/UserResponse.java) · [회원 응답 조립](../../backend/src/main/java/com/zip/backend/auth/AuthService.java#L187) · [로그인·가입 응답](../../backend/src/main/java/com/zip/backend/auth/AuthSessions.java) · [응답 통합 테스트](../../backend/src/test/java/com/zip/backend/AuthIntegrationTests.java)

#### 월별 고정 지출과 가계부의 DTO 도입 시 확인할 동작

- 월별 고정 지출의 등록·수정은 `200`과 저장한 청구를 반환합니다. 조회 응답의 미납 `paidAt: null`과 `snapshot`을 보존합니다. 사진 고지서 확정도 `registerMonthly`를 호출하므로 같은 등록 검증을 사용할 수 있게 입력 변환을 확인합니다. [월별 API](../../backend/src/main/java/com/zip/backend/bills/BillController.java) · [사진 고지서 등록](../../backend/src/main/java/com/zip/backend/bills/BillService.java#L268) · [월별 등록 통합 테스트](../../backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java)
- 가계부 등록 `201`, 수정 `204`는 빈 본문으로 반환합니다. 거래 목록에서는 문자열 ID와 월급 플래그를 반환하고, 연결 메모가 없으면 `memoId`와 `memoTitle`을 생략합니다. 저장 서비스의 회원 잠금과 트랜잭션 안에서 메모·월급을 연결하는 흐름은 기존 롤백·동시 저장 테스트로 대조합니다. [가계부 API](../../backend/src/main/java/com/zip/backend/ledger/LedgerController.java) · [가계부 통합 테스트](../../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)
- 두 요청은 현재 허용 필드와 실제 정수 값인지 검사합니다. DTO 바인딩에서 알 수 없는 필드를 무시하거나 문자열·소수 금액을 정수로 변환하면 입력 허용 범위가 달라질 수 있으므로 기존 제약을 함께 확인합니다. 계약 기간·납부 완료·회원 소유·월급 연동은 서비스에서 확인하는 업무 조건입니다. [고정 지출 검증](../../backend/src/main/java/com/zip/backend/bills/BillInput.java) · [가계부 저장](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java)

### DTO와 별도로 검토할 최적화

- 가계부 등록의 `SELECT MAX(id)`를 INSERT에서 반환한 키로 대체하고, 수정의 존재 확인과 기존 메모 조회를 한 번으로 줄이는 방안을 검토합니다. 같은 회원의 동시 저장·메모 연결·롤백 검증이 필요합니다. 목록의 메모·월급 여부 일괄 조회는 이미 반영돼 있습니다. [가계부와 메모](ledger-memos.md#가계부-기록과-회원별-분류) · [가계부 저장](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java) · [생성 키 사용 예](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java)
- 고정 지출 등록·수정에서 금액과 납부 날짜는 요청 DTO 변환 때 한 번 파싱합니다. 선택 월과 납부 기한이 속한 월의 검증에서 같은 계약과 저장 시간대를 재사용하는 방안은 후속 후보입니다. [월별 입력 검증](../../backend/src/main/java/com/zip/backend/bills/BillInput.java) · [계약 월 검증](../../backend/src/main/java/com/zip/backend/bills/BillService.java)
- 회원 응답 조립에서 계정 조회와 별도로 생년월일, 설문 상태, 동의 시각, 제재 집계, 미확인 경고, 동네 인증, 프로필을 조회합니다. 실행 시간과 SQL 수를 기록한 뒤 계정과 함께 조회할 단일 행 정보를 검토합니다. 미확인 경고는 여러 건일 수 있어 회원 행이 중복되지 않도록 확인합니다. [회원 응답 조립](../../backend/src/main/java/com/zip/backend/auth/AuthService.java#L187) · [인증 조회](../../backend/src/main/java/com/zip/backend/auth/AuthRepository.java)
- OpenAPI 스키마와 실제 HTTP 응답을 CI에서 비교하면 Java 타입 추가와 별개로 계약 누락을 발견할 수 있습니다. 가계부의 메모 필드 생략과 내 집 정보의 대출 초안처럼 기존 테스트에서 다루는 응답부터 적용할 수 있습니다. [가계부 통합 테스트](../../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java) · [설문 통합 테스트](../../backend/src/test/java/com/zip/backend/HousingOnboardingTests.java)

## 인증과 토큰 재발급

성공 시 백엔드는 `/oauth/callback#token=<accessToken>`으로 리디렉션합니다. 프론트는 URL 프래그먼트에서 토큰을 읽고 주소에서 제거한 뒤, 그 토큰으로 `GET /api/auth/me`를 호출합니다. 기존 `?token=...` 주소에 들어오면 주소에서 토큰을 제거하며, 로그인에는 프래그먼트의 토큰만 사용합니다. 실패 메시지는 `?error=...`로 전달됩니다. [API 계약](../../frontend/API.md#소셜-로그인) · [콜백 페이지](../../frontend/src/pages/auth/OAuthCallbackPage.tsx) · [백엔드 리디렉션](../../backend/src/main/java/com/zip/backend/auth/OAuthLoginHandler.java)

로그인·가입·소셜 인증 성공 시 서버가 재발급용 HttpOnly 쿠키를 발급합니다. 프론트는 만료에 따른 401 응답에서 `POST /api/auth/refresh`를 호출하고 원래 요청을 재시도합니다. 서버는 재발급 시 DB의 토큰 해시를 교체하며, 로그아웃이나 세션 만료 후에는 같은 세션의 재발급을 거부합니다. 프론트는 같은 세션의 동시 요청을 묶고, 지원 브라우저의 탭 간에는 Web Locks로 갱신을 조정합니다. 로그인 유지 선택 시 브라우저를 다시 열어도 세션 만료 전까지 복원할 수 있습니다. [인증 세션](../../backend/src/main/java/com/zip/backend/auth/AuthSessions.java) · [재발급 쿠키](../../backend/src/main/java/com/zip/backend/auth/RefreshCookie.java) · [인증 초기화](../../frontend/src/app/setupApi.ts) · [프론트 HTTP 처리](../../frontend/src/lib/apiClient.ts)

만료됐거나 로그아웃한 지 하루 지난 세션(`auth_sessions`)과 요청한 지 하루 지난 이메일 인증(`email_verifications`)은 서버가 6시간마다 지웁니다. 세션 행이 없으면 그 토큰은 무효라 결과가 같고, 인증번호(3분) · 인증 완료 값(30분) · 요청 제한(1시간)보다 깁니다(2026-11-24). [오래된 데이터 정리](../../backend/src/main/java/com/zip/backend/maintenance/DataCleanupService.java)

- **비밀번호 로그인 제한**은 15분 안에 누적 실패가 5회에 이르면 15분 동안 잠그고, 누적 횟수와 재시도 가능 시각을 안내합니다. 정상 로그인 또는 이메일 인증을 통한 비밀번호 재설정으로 누적 실패 상태를 초기화합니다. [PR #126](https://github.com/teammzip/project-ZIP/pull/126) · [로그인 제한 구현](../../backend/src/main/java/com/zip/backend/auth/AuthService.java) · [비밀번호 재설정](../../backend/src/main/java/com/zip/backend/auth/recovery/RecoveryService.java)
- **가입과 계정 찾기**는 이메일 인증을 사용합니다. 이메일 가입과 소셜 첫 동의 화면은 주소 입력 없이 진행하며, 주소 입력은 [주거 설문과 내 집 정보](home-info.md#주소와-회원-설정)에서 할 수 있습니다. 서버는 가입과 첫 동의의 약관 버전과 동의 여부를 확인합니다. 2026-11-25에 두 API의 선택 `address`를 실제 요청 처리에 맞춰 문서화했습니다. [OpenAPI](../../backend/openapi.yaml) · [프론트 연동 계약](../../frontend/API.md#회원가입) · [가입 처리](../../backend/src/main/java/com/zip/backend/auth/signup/SignupService.java) · [첫 동의 처리](../../backend/src/main/java/com/zip/backend/auth/AuthController.java)

## 서버 데이터와 브라우저 저장

서버 모드에서 서버가 관리하는 기록은 API 응답을 기준으로 표시합니다. 설정의 ‘내가 쓴 글’은 [본인 게시글 수](community-operations.md#본인-게시글-수)를 참고하세요.

서버 모드의 일정·메모 목록은 공통 `listSync`를 통해 회원별 브라우저 캐시와 서버를 동기화합니다. 가계부의 임시 입력은 [가계부와 메모](ledger-memos.md)를 참고하세요. [일정 동기화](../../frontend/src/features/life/calendarSync.ts) · [메모 동기화](../../frontend/src/features/memo/sync.ts)

생활 관리의 브라우저 저장소는 로그인한 회원별 키를 사용합니다. 계정을 전환하면 화면의 이전 상태를 비우고 해당 회원의 저장본을 불러옵니다. 소유자를 알 수 없는 과거 공용 키는 그대로 둡니다. [계정별 브라우저 저장](../../frontend/src/lib/accountStorage.ts) · [생활 관리 저장소](../../frontend/src/features/life/store.ts)

## 화면 접근과 공통 모달

라우터는 홈·지도·관리자 화면 등을 주소에 처음 접근할 때 불러옵니다. 공개 약관과 동네 목록(`GET /api/regions`, `GET /api/regions/{id}/neighbors`, 2026-11-24)은 로그인 전에도 열 수 있고, 서버는 관리자 API에서 관리자 역할을 검사합니다. [동네 목록 API](../../backend/src/main/java/com/zip/backend/region/RegionController.java) 공통 모달은 열릴 때 내부로 포커스를 옮기고, `Tab`과 `Shift+Tab`을 내부에서 순환시킵니다. 닫으면 기존 조작 요소로 포커스를 돌립니다. [라우터](../../frontend/src/app/router.tsx) · [공통 모달](../../frontend/src/components/ui/Modal.tsx) · [서버 권한](../../backend/src/main/java/com/zip/backend/auth/SecurityConfiguration.java)

관련 흐름은 [내 집 정보와 대출](home-info.md), [지도 장소 식별자](map-place-ids.md), [배출표 조회](trash-schedules.md)에서 확인할 수 있습니다.

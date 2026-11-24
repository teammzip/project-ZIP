# 앱 구조와 실행 모드

2026-11-24 확인 · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

ZIP의 프론트엔드는 React·TypeScript·Vite로 구성됩니다. 실제 서버 모드에서는 프론트의 `/api` 요청을 Spring Boot 백엔드가 처리하고, 백엔드는 JdbcTemplate으로 MySQL에 접근합니다. 개발 중 Vite는 `/api` 요청을 `VITE_PROXY_TARGET`으로 보내며 기본 대상은 `http://localhost:8080`입니다. [프론트 안내](../../frontend/README.md) · [Vite 설정](../../frontend/vite.config.ts) · [백엔드 안내](../../backend/README.md)

| 실행 목적 | 시작 위치와 설정 |
| --- | --- |
| 화면 개발·데모 | `frontend/`에서 `npm install` 후 `npm run dev`. 프론트 개발 서버는 기본 3000 포트에서 실행되며 모의 API가 기본값입니다. |
| 서버 연동 개발 | [DB를 준비](database.md)하고 백엔드 로컬 설정을 채운 뒤, `backend/`에서 `./gradlew.bat bootRun`을 실행합니다. 프론트의 `.env.local`에 `VITE_USE_MOCK=false`를 지정합니다. |

서버의 로컬 설정에는 DB·JWT와 사용하는 외부 서비스의 환경 변수가 들어갑니다. 실제 설정은 Git에서 제외되는 `application-local.properties` 또는 실행 환경에서 관리합니다. OpenAPI 문서는 [백엔드 OpenAPI](../../backend/openapi.yaml), 화면별 데이터 계약은 [프론트 API 문서](../../frontend/API.md)에서 확인합니다. [백엔드 설정](../../backend/README.md#처음-설정)

## API 데이터 계약과 DTO

로그인·회원가입·일정 요청은 Java `record`를 사용합니다. 월별 고정 지출과 가계부는 본문을 `Map`으로 검증하고 목록 응답도 `Map`으로 조립합니다. 내 집 정보는 `Map`을 받아 `HomeInfoInput`으로 변환한 뒤 중첩 응답을 `Map`으로 반환합니다. [로그인 요청](../../backend/src/main/java/com/zip/backend/auth/AuthRequests.java) · [가입 요청](../../backend/src/main/java/com/zip/backend/auth/signup/SignupRequests.java) · [일정 요청](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) · [내 집 정보 입력](../../backend/src/main/java/com/zip/backend/settings/HomeInfoInput.java)

2026-11-24에 가계부·월별 고정 지출·내 집 정보와 연결된 월급·분류·메모 초안·첫 주거 설문 계약을 서버 구현 기준으로 OpenAPI와 프론트에 반영했습니다. OpenAPI는 수입과 기타 지출을 개별 경로로 표현하며 프론트는 각 종류에 맞는 저장 본문을 사용합니다. 월별 고정 지출의 등록·수정 본문과 내 집 정보·대출·설문 본문도 각각의 API에서 받는 키를 기준으로 정의합니다. [OpenAPI](../../backend/openapi.yaml) · [프론트 API](../../frontend/API.md) · [가계부](ledger-memos.md) · [월별 고정 지출](fixed-expenses.md) · [내 집 정보](home-info.md)

개선 후보는 월별 고정 지출의 등록·수정 요청과 월별 응답, 가계부의 수입·지출 저장 요청과 목록 응답, 내 집 정보와 인증의 응답입니다. 도입 시 현재 JSON의 필드명·자료형·생략과 `null`의 의미·금액 단위·입력 검증을 유지하는지 확인합니다. 프로필 PATCH는 생략한 항목을 유지하며 선택 항목의 명시적 `null`을 처리하므로 필드 존재 여부가 필요합니다. [고정 지출 검증](../../backend/src/main/java/com/zip/backend/bills/BillInput.java) · [가계부 요청 타입](../../frontend/src/features/life/ledgerApi.ts) · [내 집 정보 계약](../../frontend/API.md#내-집-정보-서버-연결-2026-11-15) · [인증 응답](../../backend/src/main/java/com/zip/backend/auth/AuthService.java) · [프로필 PATCH](../../backend/src/main/java/com/zip/backend/auth/ProfilePatch.java)

가계부 목록의 연결 메모와 자동 등록 월급 여부를 읽는 방식은 [가계부 기록과 회원별 분류](ledger-memos.md#가계부-기록과-회원별-분류)를 참고하세요.

## 인증과 토큰 재발급

성공 시 백엔드는 `/oauth/callback#token=<accessToken>`으로 리디렉션합니다. 프론트는 URL 프래그먼트에서 토큰을 읽고 주소에서 제거한 뒤, 그 토큰으로 `GET /api/auth/me`를 호출합니다. 기존 `?token=...` 주소에 들어오면 주소에서 토큰을 제거하며, 로그인에는 프래그먼트의 토큰만 사용합니다. 실패 메시지는 `?error=...`로 전달됩니다. [API 계약](../../frontend/API.md#소셜-로그인) · [콜백 페이지](../../frontend/src/pages/auth/OAuthCallbackPage.tsx) · [백엔드 리디렉션](../../backend/src/main/java/com/zip/backend/auth/OAuthLoginHandler.java)

로그인·가입·소셜 인증 성공 시 서버가 재발급용 HttpOnly 쿠키를 발급합니다. 프론트는 만료에 따른 401 응답에서 `POST /api/auth/refresh`를 호출하고 원래 요청을 재시도합니다. 서버는 재발급 시 DB의 토큰 해시를 교체하며, 로그아웃이나 세션 만료 후에는 같은 세션의 재발급을 거부합니다. 프론트는 같은 세션의 동시 요청을 묶고, 지원 브라우저의 탭 간에는 Web Locks로 갱신을 조정합니다. 로그인 유지 선택 시 브라우저를 다시 열어도 세션 만료 전까지 복원할 수 있습니다. [인증 세션](../../backend/src/main/java/com/zip/backend/auth/AuthSessions.java) · [재발급 쿠키](../../backend/src/main/java/com/zip/backend/auth/RefreshCookie.java) · [인증 초기화](../../frontend/src/app/setupApi.ts) · [프론트 HTTP 처리](../../frontend/src/lib/apiClient.ts)

- **비밀번호 로그인 제한**은 15분 안에 누적 실패가 5회에 이르면 15분 동안 잠그고, 누적 횟수와 재시도 가능 시각을 안내합니다. 정상 로그인 또는 이메일 인증을 통한 비밀번호 재설정으로 누적 실패 상태를 초기화합니다. [PR #126](https://github.com/teammzip/project-ZIP/pull/126) · [로그인 제한 구현](../../backend/src/main/java/com/zip/backend/auth/AuthService.java) · [비밀번호 재설정](../../backend/src/main/java/com/zip/backend/auth/recovery/RecoveryService.java)
- **가입과 계정 찾기**는 이메일 인증을 사용합니다. 주소는 가입과 소셜 첫 동의 때 선택 사항이고, 주거 설문이나 내 정보에서 등록할 수 있습니다. 가입은 서버가 현재 약관 버전과 동의 여부를 확인합니다. [가입 처리](../../backend/src/main/java/com/zip/backend/auth/signup/SignupService.java) · [첫 동의 처리](../../backend/src/main/java/com/zip/backend/auth/AuthController.java) · [외부 서비스와 AI](service-integrations.md)

## 서버 데이터와 브라우저 저장

서버 모드에서 서버가 관리하는 기록은 API 응답을 기준으로 표시합니다. 설정의 ‘내가 쓴 글’은 [본인 게시글 수](community-operations.md#본인-게시글-수)를 참고하세요.

서버 모드의 일정·메모 목록은 공통 `listSync`를 통해 회원별 브라우저 캐시와 서버를 동기화합니다. 가계부의 임시 입력은 [가계부와 메모](ledger-memos.md)를 참고하세요. [일정 동기화](../../frontend/src/features/life/calendarSync.ts) · [메모 동기화](../../frontend/src/features/memo/sync.ts)

생활 관리의 브라우저 저장소는 로그인한 회원별 키를 사용합니다. 계정을 전환하면 화면의 이전 상태를 비우고 해당 회원의 저장본을 불러옵니다. 소유자를 알 수 없는 과거 공용 키는 그대로 둡니다. [계정별 브라우저 저장](../../frontend/src/lib/accountStorage.ts) · [생활 관리 저장소](../../frontend/src/features/life/store.ts)

## 화면 접근과 공통 모달

라우터는 홈·지도·관리자 화면 등을 주소에 처음 접근할 때 불러옵니다. 공개 약관은 로그인 전에도 열 수 있고, 서버는 관리자 API에서 관리자 역할을 검사합니다. 공통 모달은 열릴 때 내부로 포커스를 옮기고, `Tab`과 `Shift+Tab`을 내부에서 순환시킵니다. 닫으면 기존 조작 요소로 포커스를 돌립니다. [라우터](../../frontend/src/app/router.tsx) · [공통 모달](../../frontend/src/components/ui/Modal.tsx) · [서버 권한](../../backend/src/main/java/com/zip/backend/auth/SecurityConfiguration.java)

관련 흐름은 [내 집 정보와 대출](home-info.md), [지도 장소 식별자](map-place-ids.md), [배출표 조회](trash-schedules.md)에서 확인할 수 있습니다.

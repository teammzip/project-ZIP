# 인증 기반 API 연결

## 구현 범위

| API | 현재 동작 |
|---|---|
| POST `/api/auth/login` | 아이디/이메일 + BCrypt 비밀번호, JWT 발급, DB 세션 생성 |
| GET `/api/auth/me` | 로그인 회원 조회, 문자열 ID, 약관 동의 시각 |
| POST `/api/auth/logout` | 현재 DB 세션 해제, 해당 토큰 즉시 차단 |
| PATCH `/api/auth/me/password` | 현재 비밀번호 확인, 새 비밀번호 검증, 모든 DB 세션 해제 |
| GET `/api/terms` | 비로그인 조회, 시행일이 지난 최신 문서 종류별 1개 |

문자 발송 업체 미정으로 회원가입·전화 인증·아이디 찾기·비밀번호 재설정은 미구현입니다. 소셜 로그인·토큰 재발급·내 정보 수정·탈퇴·생활 기능도 다음 단계입니다. `openapi.yaml` 전체가 구현됐다는 뜻은 아닙니다. 미구현 API는 호출하지 마세요.

## 로컬 실행

1. 기존 `db/` 스키마와 마이그레이션이 적용된 테스트 DB를 사용합니다. 서버가 DDL이나 시드를 자동 실행하지 않습니다.
2. `application-local.properties.example`을 **기존 파일을 덮어쓰지 않고** `application-local.properties`로 복사해 DB 접속 정보를 입력합니다.
3. JWT_SECRET에 Base64로 인코딩한 최소 32바이트 난수를 설정합니다. PowerShell에서 아래 명령으로 생성한 값을 로컬 설정 파일에만 복사합니다.

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

4. 로그인에는 실제 DB의 BCrypt 계정이 필요합니다. 브라우저 데모 계정·DB 구조 검사 fixture는 서버 계정이 아닙니다. 해시가 필요하면 `backend`에서 `./gradlew.bat --console=plain hashPassword`를 실행해 입력합니다. 결과 해시만 테스트 DB의 해당 사용자 `password_hash`에 넣으세요. 이 도구는 계정을 생성하거나 DB를 변경하지 않습니다. 일반 계정은 login_id/email/signup_provider/role/status가 스키마 규칙에 맞아야 합니다.
5. `backend`에서 `./gradlew.bat bootRun`으로 실행합니다. JDK 17 toolchain이 필요합니다.
6. 프론트 `frontend/.env.local`에 다음을 설정하고 Vite를 재시작합니다.

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://localhost:8080
```

현재 연결 가능한 화면 흐름은 **기존 DB 계정 로그인 → 내 정보 조회 → 비밀번호 변경/로그아웃**입니다. 비밀번호 변경 성공 시 프론트도 인증 상태를 비우고 다시 로그인하게 합니다. 약관 화면은 여전히 정적 본문을 사용하며 API 조회 연결은 후속 작업입니다.

## 세션·시간 정책

- JWT는 HS256, 발급자 `zip-backend`, 사용자 `sub`, DB 세션 `sid`, 만료 `exp`를 검증합니다. 서명 키가 없거나 너무 짧으면 시작에 실패합니다.
- 매 인증 요청에서 세션 소유자·DB 만료·해제·현재 회원 권한·정지 상태도 조회합니다. 로그아웃한 JWT는 서명이 남아 있어도 거절됩니다.
- 기본 토큰/세션 만료는 1시간, 로그인 유지는 7일입니다. 현재는 refresh 쿠키가 없으며 기간 만료 시 재로그인합니다. auth_sessions.refresh_token_hash는 난수의 SHA-256 값으로 채우지만 재발급 용도로 사용하지 않습니다.
- 이 단계는 Authorization 헤더 인증만 사용합니다. 쿠키 인증을 추가할 때 CSRF 정책도 함께 바꿔야 합니다. 개발은 Vite 프록시를 사용하고 서버의 무제한 CORS는 열지 않습니다.
- Instant를 JDBC Timestamp로 전달하며 DB 시간 해석은 기존 JDBC 연결 설정을 따릅니다. 기존 DATETIME 데이터를 임의로 UTC로 재해석하지 않습니다. 운영 시 DB/드라이버 시간대를 통일해야 합니다.
- DB status가 SUSPENDED이거나 현재 유효한 SUSPEND/BAN이 있으면 로그인과 기존 토큰을 403/code=SUSPENDED로 차단합니다. 만료된 제재의 users.status 복구는 관리자/제재 구현 단계에서 추가해야 합니다. 현재 프론트에는 공통 403 정지 화면 이동 처리가 없습니다.

## 검증과 후속 작업

```powershell
# backend: 실제 사용자 DB와 분리된 H2 MySQL 호환 모드
./gradlew.bat test
# 프로젝트 루트: 프론트·DB 약관 원문 동기화 (Node 22.18+)
node --experimental-strip-types --test db/tests/legal-content.test.mjs
```

H2 테스트는 실제 MySQL 전체 스키마/동시성 검증을 대신하지 않습니다. 사용자 DB에는 DDL/DML을 실행하지 않았습니다. 운영 전에는 MySQL에서 HTTP 연결, 동시 로그인/비밀번호 변경, 로그인 시도 제한, HTTPS와 비밀키 운영을 검증해야 합니다. 문자·소셜 인증과 약관 버전별 동의 저장은 아직 구현되지 않았습니다.

## 약관 점검

프론트 `frontend/src/features/legal/content.ts`와 `db/schema.sql`의 SERVICE/PRIVACY/POLICY 제목·본문·버전 `2026-10-18`·동의 방식(AGREE/CONFIRM)은 자동 대조합니다. 개인정보 처리방침은 CONFIRM, 나머지 두 문서는 AGREE입니다. 만 14세 이상 확인은 별도 회원 필드입니다.

현재 본문에는 책임자·연락처·클라우드 업체/국가·AI 업체/국외 이전 항목 등의 `[ ]` 빈칸이 남아 있습니다. 문자 업체도 결정 후 실제 처리 내용을 반영해야 합니다. 외부 날씨·주소 검색은 이미 브라우저에서 호출하므로 제공 항목과 처리방침 설명을 점검해야 합니다. 재가입 차단용 banned_identities 및 신고 스냅샷의 탈퇴 후 보관 정책도 실제 구현과 맞춰야 합니다. 보관 기간·파기·휴면 계정·HTTPS에 대한 본문 약속은 구현 및 운영 절차로 확인해야 하며 이번에는 법적 적절성을 판정하거나 본문을 임의로 개정하지 않았습니다.

본문 변경 시 프론트 버전과 DB 새 버전을 함께 추가하고 기존 약관/동의 이력은 보존합니다. API는 각 종류의 시행일이 지난 최신 문서를 조회하며 미래 문서를 노출하지 않습니다.

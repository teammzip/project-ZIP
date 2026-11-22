# 인증 기반 API 연결

## 구현 범위

| API | 현재 동작 |
|---|---|
| POST `/api/auth/login` | 아이디/이메일 + BCrypt 비밀번호, JWT 발급, DB 세션 생성 |
| GET `/api/auth/me` | 로그인 회원 조회, 문자열 ID, 약관 동의 시각 |
| PATCH `/api/auth/me` | 닉네임·소개·캐릭터·배경색·프로필 사진 연결, 변경된 User 반환 |
| POST `/api/files` | 프로필용 JPEG/PNG 단일 파일·2MB 이하 업로드, 파일 메타데이터 반환 |
| GET `/api/files/content/{key}` | 연결된 프로필 사진 · 보이는 글의 첨부 사진 공개 조회, 연결 전 업로드는 소유자만 조회 |
| POST `/api/auth/logout` | 현재 DB 세션 해제, 해당 토큰 즉시 차단 |
| PATCH `/api/auth/me/password` | 현재 비밀번호 확인, 새 비밀번호 검증, 모든 DB 세션 해제 |
| GET `/api/terms` | 비로그인 조회, 시행일이 지난 최신 문서 종류별 1개 |
| 지도 9개 (`/api/places/**`, `/api/me/place-favorites/**`, `/api/me/map-settings`) | 아래 [지도](#지도) 참고 |
| 커뮤니티 (`/api/posts/**`, `/api/comments/**`, `/api/reports`) | 아래 [커뮤니티](#커뮤니티) 참고 |
| GET `/api/me/settings` | 로그인 회원의 생활 설정 조회, 행이 없으면 기본값 |
| PUT `/api/me/settings` | 월세·납부일·연월·알림·집 주소·동네 저장 |
| GET/POST `/api/bills` | 월별 고정 지출 조회·항목 추가 |
| PATCH/DELETE `/api/bills/{id}` | 기본 항목 수정·해지 |
| PUT `/api/bills/{id}/payments/{month}` | 월별 납부 체크·금액 정정 |

문자 발송 업체 미정으로 회원가입·전화 인증·아이디 찾기·비밀번호 재설정은 미구현입니다. 소셜 로그인·토큰 재발급·가입 주소 수정·소셜 첫 동의·탈퇴·설문·대출 등 나머지 생활 기능도 다음 단계입니다. `openapi.yaml` 전체가 구현됐다는 뜻은 아닙니다. 미구현 API는 호출하지 마세요.

닉네임 수정 코드를 추가한 뒤에는 실행 중인 백엔드를 재시작해야 합니다. Postman에서 PATCH `/api/auth/me`에 Bearer Token과 JSON `{ "nickname": "새닉네임" }`을 보내면 200과 변경된 User를 반환합니다. GET 내 정보와 재로그인에서도 같은 닉네임이어야 합니다. 비로그인/만료 토큰은 401, 빈 값·누락·길이 오류는 400입니다. 사용자 ID는 요청 본문이 아닌 토큰에서 결정합니다.

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

### Windows에서 해시 생성 입력이 실패하는 경우

기존 도구의 한글 안내가 깨지거나 입력 없이 실패하면 아래처럼 PowerShell에서 비밀번호를 먼저 받아 전달하세요. 입력은 화면에 표시되지 않고 명령 기록에도 실제 비밀번호를 적지 않습니다. Windows PowerShell의 파이프 인코딩 차이를 피하려면 테스트 비밀번호는 ASCII 영문·숫자·특수문자를 모두 포함해 8~16자로 입력하세요.

```powershell
$testPassword = Read-Host "Test password" -AsSecureString
[System.Net.NetworkCredential]::new('', $testPassword).Password | .\gradlew.bat -q --console=plain hashPassword
```

안내와 오류는 Windows 코드 페이지와 무관하게 읽을 수 있도록 영어로 출력합니다. `No password received`는 입력 전달 실패, `Invalid password`는 길이/조합 규칙 실패입니다. 정상 종료 때 출력된 `$2a$12$...` 한 줄만 테스트 계정에 저장합니다. 실제 DB를 자동 변경하지 않습니다.

## 고정 지출 API 확인

기존 `bill_items`와 `bill_payments`를 사용하며 새 DDL은 없습니다. 백엔드 재시작 후 [Postman 컬렉션](postman/fixed-bills.postman_collection.json)을 Import하고 Variables의 baseUrl/loginId/password를 설정하세요. 1~11번 요청을 순서대로 실행하면 현재 한국 연월과 토큰을 자동 설정하고 테스트 항목 추가 → 납부 → 기본 금액 수정 → 당월 금액 정정 → 다음 달 예정액 → 오류 거절 → 해지·기록 보존을 검증합니다. 실행마다 별도 테스트 항목을 만들며 해지 후에도 DB 기록은 남습니다. 실제 출금 기능은 아닙니다.

직접 추가하려면 Bearer Token으로 POST `/api/bills`에 다음 JSON을 보냅니다.

```json
{ "name": "관리비", "amount": 50000, "tag": "관리비" }
```

200 응답의 문자열 id를 사용하세요. GET `/api/bills?month=YYYY-MM`은 목록, PUT `/api/bills/{id}/payments/YYYY-MM`의 `{ "paid": true }`는 납부 체크, `{ "paid": false }`는 해제입니다. `{ "amount": 45000 }`만 보내면 해당 월 금액만 정정하고 납부 상태를 유지합니다. 반복 체크는 월별 행을 추가하지 않고 기존 paidAt을 유지합니다.

PATCH `/api/bills/{id}`는 name/amount/tag 중 하나 이상을 수정합니다. 이름 1~30자, 분류 1~24자이며 앞뒤 공백을 제거합니다. 금액은 원 단위 정수 0~9007199254740991입니다. 같은 이름·분류의 활성 항목은 409입니다. 사용자 ID 등 다른 필드는 400, 남의 ID는 404입니다. 사용자 소유 행을 잠그고 세션을 재검증한 트랜잭션에서 저장합니다.

**월별 금액 정책**: 항목 추가 때 당월 미납 스냅샷을 만듭니다. PATCH/해지 전에 당월 스냅샷이 없으면 기존 기본 금액으로 확정합니다. 기본 금액 수정은 기존 당월·과거 기록을 바꾸지 않으며 미생성 월의 예정액에 적용됩니다. 예: 기본 5만원 → PATCH 7만원이면 응답 amount=50000, defaultAmount=70000입니다. 당월도 바꾸려면 payments API의 amount를 명시하세요. 이름과 분류는 현재 항목의 값이며 과거 이름 스냅샷은 저장하지 않습니다.

GET은 DB를 변경하지 않습니다. 과거 월은 저장된 스냅샷만 반환하고, 현재/미래 활성 항목은 스냅샷이 없으면 기본 금액의 예정액(snapshot=false)을 표시합니다. 누락된 과거를 현재 금액으로 임의 복원하지 않으며, 사용자가 과거 월에 새 기록을 만들 때는 당시 amount를 명시해야 합니다. 미래 월 납부 저장은 400입니다. 현재 미생성 청구를 매월 자동 생성하는 스케줄러는 아직 없으므로 장기간 미사용 월은 명시 금액으로 등록해야 합니다.

DELETE는 is_active=0으로 해지하며 실제 항목/납부 행은 삭제하지 않습니다. 기존 월 기록은 GET에 active=false로 남고 이미 있는 기록의 정정도 가능합니다. 해지 후 새 월 청구 생성·항목 수정은 404이고, 미래 월 예정액에서 제외됩니다. 같은 항목 DELETE 반복은 204입니다. **프론트 고정 지출 화면의 API 연결과 설문 관리비 자동 반영은 아직 별도 작업입니다.**

## 생활 설정 API 확인

GET·PUT `/api/me/settings`는 Bearer Token이 필요하며 토큰 회원의 user_settings만 조회/저장합니다. 기본 조회는 행이 없어도 rent=0, rentDay=15, notiOn=true, 미설정 주소·연월은 빈 문자열을 반환하며 DB 행은 만들지 않습니다. 최초 PUT 때 행을 생성합니다. 기존 스키마를 사용하므로 새 DDL은 필요하지 않습니다.

백엔드를 재시작한 뒤 [Postman 컬렉션](postman/life-settings.postman_collection.json)을 Import하세요. 컬렉션 Variables에서 baseUrl/loginId/password를 설정하고 1~6번을 순서대로 실행하면 로그인 토큰 자동 저장 → 조회 → 저장 → 재조회 → 잘못된 입력 거절 → 기존 값 보존을 확인할 수 있습니다. 3번은 실제 계정의 설정을 샘플 값으로 변경합니다. 비밀번호/토큰을 포함해 저장한 컬렉션은 공유하지 마세요.

직접 요청하려면 PUT의 Body → raw → JSON에 다음을 넣습니다.

```json
{
  "rent": 55,
  "rentDay": 15,
  "moveIn": "2026-01",
  "contractEnd": "2027-01",
  "notiOn": true,
  "homeAddress": "서울 마포구 테스트주소"
}
```

200 응답과 GET 재조회 값이 같아야 합니다. rent/rentDay/moveIn/contractEnd/notiOn은 필수이며 선택 주소/동네 필드는 생략하면 유지합니다. null homeAddress는 빈 주소로 정리합니다. 연월은 YYYY-MM 또는 미설정 빈 문자열, 종료월은 입주월 이상입니다. 월세는 **만원 단위**, 0~9999999999.9999 및 소수점 4자리까지 허용하므로 55.0001은 550001원입니다. 잘못된 타입·범위·미지원 필드(userId 등)는 400입니다. 오류 요청은 전체를 저장하지 않습니다.

동네는 regionId(문자열 또는 null), regionName, regionLocation으로 설정합니다. 등록된 ID를 보내면 실제 regions에 있는지 확인하고 이름도 같은 동네인지 검사합니다. 예: regionId="2", regionName="서울 마포구", regionLocation={region:"서울 마포구",source:"manual",point:{lat:37.5,lon:126.9}}. ID에 해당하는 동네의 이름·상위 이름 포함 전체 명칭·서울특별시/광역시 등을 줄인 명칭을 허용합니다. ID 없이 자유 입력 동네 이름도 저장할 수 있지만 기존과 다른 이름이면 기존 registry ID를 해제합니다.

point는 null 또는 lat/lon 한 쌍이며 위도 ±90, 경도 ±180, 소수점 6자리까지입니다. regionLocation을 null로만 보내면 동네 선택을 해제합니다. ID나 이름을 함께 지정하면 해당 동네를 manual 출처로 설정하므로 예전 registry ID만 있던 회원의 GET 응답도 그대로 PUT할 수 있습니다. source는 manual/survey/verified이며 verified는 기존 DB 위치·좌표·ID를 그대로 유지할 때만 허용합니다. 설정 저장으로 신규 동네 인증을 부여하지 않습니다. 동네·출처·좌표가 바뀌면 users.region_verified_at을 초기화하며 집 상세주소만 수정할 때는 유지합니다. users.home_lat/home_lon과 가입 주소도 덮어쓰지 않습니다.

홈 메모·지도 설정·개인 카테고리 JSON 등 다른 user_settings 컬럼은 수정하지 않습니다. **프론트 생활 설정 화면은 아직 브라우저 저장을 사용합니다. 이번 구현은 백엔드와 Postman 검증 범위이며, 화면 연결은 다음 단계입니다.** 보증금·관리비·설문·대출도 별도 API 연결이 필요합니다.

## 프로필 꾸미기 확인

기존 `db/schema.sql`의 `user_profiles`와 `uploaded_files`를 사용하며 새 테이블이나 컬럼은 필요하지 않습니다. 기존 테스트 회원에 프로필 행이 없으면 최초 PATCH 시 자동 생성합니다. 사진 파일 자체는 DB가 아닌 로컬 저장 폴더에 두고 DB에는 소유자·URL·형식·크기를 저장합니다.

백엔드를 재시작한 뒤 Postman에서 로그인 토큰으로 PATCH `/api/auth/me`에 다음 JSON을 보내세요.

```json
{
  "nickname": "테스트회원",
  "bio": "요리 연습 중",
  "avatarEmoji": "🐻",
  "avatarColor": "#ffd6a5",
  "avatarFileId": null
}
```

200 응답과 GET `/api/auth/me`, 재로그인의 user 응답에 같은 값이 있어야 합니다. 필드는 하나 이상 보내야 하며 생략한 값은 유지합니다. bio는 최대 30자, 캐릭터는 최대 20자, 색은 #RRGGBB입니다. null은 해당 선택 필드를 초기화하며 bio는 빈 문자열로 바뀝니다. 닉네임과 프로필은 한 트랜잭션으로 저장됩니다.

사진은 POST `/api/files`의 Body → form-data에서 `file` 키를 File로 선택해 JPEG/PNG를 올립니다. 반환된 문자열 id를 PATCH의 avatarFileId에 넣으세요. 파일 크기 2MB, 가로·세로 4096px 및 총 1600만 화소를 제한하고 실제 이미지 형식과 MIME이 일치하는지 확인합니다. 서버는 픽셀을 재인코딩해 EXIF 등 원본 메타데이터를 저장하지 않습니다. 문서 파일(PDF 등)은 받지 않습니다. 커뮤니티 글 첨부도 같은 사진 업로드를 씁니다.

연결된 프로필 사진은 응답의 avatarUrl로 공개 표시됩니다. 연결 전/해제 후에는 유효한 소유자 토큰으로만 읽을 수 있습니다. 다른 회원·삭제 파일·문서 파일·존재하지 않는 파일 연결은 404이며 요청의 닉네임 변경도 롤백됩니다. 프론트에서 캐릭터를 고르거나 기본으로 돌아가면 avatarFileId를 null로 해제합니다.

기본 저장 위치는 **백엔드 실행 작업 디렉터리의 `var/uploads`**입니다. 작업 디렉터리를 바꿔도 같은 파일을 보려면 로컬 설정의 `ZIP_UPLOAD_DIR=C:/원하는/절대경로`로 고정하세요. 이 폴더는 Git에서 제외하며 DB와 함께 별도 백업해야 합니다. 실패한 업로드 트랜잭션의 파일은 정리하지만, 업로드 성공 후 PATCH를 취소한 미연결 파일과 교체된 사진의 물리 파일 정리·계정 탈퇴 시 파일 삭제·외부 저장소 이관은 후속 작업입니다.

프론트 프로필 편집에서 소개·캐릭터·색·사진을 저장하고 새로고침/재로그인 시 유지되는지 확인하세요. 실제 API 모드는 서버 응답을 표시용 zip-profile 캐시에 동기화하며 저장 실패 시 완료 안내를 띄우지 않습니다. mock 모드는 기존 브라우저 저장 동작을 유지합니다.

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

**2026-11-22**: 화면이 `GET /api/terms` 를 보여 줘요. 문구를 고치면 `content.ts` → `node db/tools/terms-sync.cjs <마이그레이션 이름>` 으로 `schema.sql` 과 기존 DB 마이그레이션을 만들고, `frontend/tests/legal-terms.test.mjs` 가 화면 문구 = DB 기본 약관인지 확인해요. 주소는 가입 필수가 아니라 가입 후 주거 설문 · 내 정보에서 입력(선택)이에요 (가입 `address` · 소셜 첫 동의 `address` 는 선택).

프론트 `frontend/src/features/legal/content.ts`와 `db/schema.sql`의 SERVICE/PRIVACY/POLICY 제목·본문·버전 `2026-10-18`·동의 방식(AGREE/CONFIRM)은 자동 대조합니다. 개인정보 처리방침은 CONFIRM, 나머지 두 문서는 AGREE입니다. 만 14세 이상 확인은 별도 회원 필드입니다.

현재 본문에는 책임자·연락처·클라우드 업체/국가·AI 업체/국외 이전 항목 등의 `[ ]` 빈칸이 남아 있습니다. 문자 업체도 결정 후 실제 처리 내용을 반영해야 합니다. 외부 날씨·주소 검색은 이미 브라우저에서 호출하므로 제공 항목과 처리방침 설명을 점검해야 합니다. 재가입 차단용 banned_identities 및 신고 스냅샷의 탈퇴 후 보관 정책도 실제 구현과 맞춰야 합니다. 보관 기간·파기·휴면 계정·HTTPS에 대한 본문 약속은 구현 및 운영 절차로 확인해야 하며 이번에는 법적 적절성을 판정하거나 본문을 임의로 개정하지 않았습니다.

본문 변경 시 프론트 버전과 DB 새 버전을 함께 추가하고 기존 약관/동의 이력은 보존합니다. API는 각 종류의 시행일이 지난 최신 문서를 조회하며 미래 문서를 노출하지 않습니다.

## 커뮤니티

`com.zip.backend.community` (CommunityController · CommunityService · CommunityRepository). 모두 로그인 후 요청이며 응답 모양은 `frontend/API.md` 7장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/posts?scope=here|near|all&category=&q=&page=0` | 보이는 글(VISIBLE) 새 글부터 20개 + `hasNext`. here = 내 동네(`users.region_id`), near = 내 동네 + `region_neighbors`, all = 전체. 동네가 없으면 here · near 는 빈 목록. `q` 는 제목 · 본문(40자) |
| GET `/api/posts/home-tips` | `is_home_tip` 글 최대 3개 (지정은 관리자 기능 단계에서) |
| GET `/api/posts/{id}` | 댓글(VISIBLE) · 첨부 포함, `mine` · `liked` · `reported` 는 토큰 기준 |
| POST · PATCH · DELETE `/api/posts/{id}` | 쓰기는 동네(`region_id`)가 있어야 함(없으면 403 `REGION_REQUIRED`). 제목 100자 한 줄 · 본문 2000자. 수정 · 삭제는 내 글만(403), 삭제는 `status=DELETED` |
| PUT · DELETE `/api/posts/{id}/like` | 한 번만 반영, `like_count` 를 서버가 맞춤 → `{ liked, likes }` |
| POST `/api/posts/{id}/comments` · PATCH · DELETE `/api/comments/{id}` | 200자, 내 댓글만 수정 · 삭제, `comment_count` 를 서버가 맞춤 |
| POST `/api/reports` | 대상 작성자 · 제목/댓글을 서버가 복사(스냅샷). 같은 대상 두 번 409, 내 글 · 댓글 400, 기타(OTHER)는 detail 필수 |

- **첨부**: `POST /api/files` 로 사진(JPEG · PNG)을 올린 뒤 `attachmentIds` 로 붙여요. 최대 5개 · 합계 2MB · 내가 올린 파일 · 다른 글이나 프로필 사진에 안 쓰인 파일만. 수정에서 뺀 첨부는 연결을 끊고 파일도 지워요(커밋 뒤). 문서(PDF 등)는 악성 파일 · 개인정보 노출 위험이 있어 받지 않기로 했어요(사진만).
- **정지 회원**: 보안 설정에서 토큰 자체가 막혀요. **동네 인증**: 글쓰기 · 댓글 · 공감은 `POST /api/me/region-verify`(`com.zip.backend.region`, 카카오 좌표 → 행정구역)로 인증한 지 30일 안이어야 해요(403 `REGION_VERIFY_REQUIRED`). `RegionVerifyIntegrationTests` 5개 + 격리 MySQL · 실제 카카오로 확인.
- **관리자** (`AdminCommunityController`, `/api/admin/**` 는 ADMIN 만):
  - GET `/api/admin/posts?category=&q=&page=` 보이는 글 50개씩 (댓글 · 첨부 · `homeTip` 포함)
  - DELETE `/api/admin/posts/{id}` · `/api/admin/comments/{id}` (`?reason=` 200자 → `delete_reason`, 지운 운영자 → `deleted_by`) → 상태 DELETED, 그 글 · 댓글에 들어온 접수 중 신고는 HIDDEN(처리자 · 시각 기록)
  - POST `/api/admin/posts/{id}/comments` 운영자 댓글 (응답 · 회원 화면에 `staff: true`, 관리자는 동네 없이 가능)
  - PUT · DELETE `/api/admin/posts/{id}/home-tip` 홈 "자취 꿀팁" 지정 · 해제
  - GET `/api/admin/reports?status=` 신고 한 건씩 `{ id, targetType, targetId, postId, target: { title | text, author, deleted }, reason, detail, reporter, status, createdAt }` (최근 500건)
  - PATCH `/api/admin/reports?targetType=&targetId=` · `/api/admin/reports/{id}` `{ status: HIDDEN | DISMISSED }` → 그 대상의 접수 중 신고 전부. HIDDEN 이면 글 · 댓글도 HIDDEN
- **답글**: 댓글 `{ body, parentId }` → `comments.parent_id`. 한 단계만(답글에 단 답글은 맨 위 댓글로), 다른 글의 댓글 400, 없는 · 지운 댓글 404. 맨 위 댓글을 지워도 답글은 남고 화면이 "삭제된 댓글" 아래로 묶어요.
- **삭제 기록**: `posts` · `comments`의 `deleted_by` · `delete_reason` (`db/migrations/20261115_04_community_admin.sql`). 본인 삭제는 본인 · 사유 없음, 운영자 삭제는 운영자 · 사유, 신고로 숨기면 "신고 처리로 숨김". 신고 목록 `target.deleteReason`.
- **아직 없음**: 문서 첨부.
- **검증**: `CommunityIntegrationTests` 7개, `AdminCommunityIntegrationTests` 5개 (권한 · 운영자 댓글 · 삭제와 신고 처리 · 신고 숨김/기각 · 홈 꿀팁).

## 회원 관리 · 경고 · 정지

`com.zip.backend.moderation` (ModerationController · ModerationService · ModerationRepository). 규칙은 `frontend/API.md` 11장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/admin/stats` | 회원 · 정지 중 · 정지 누적 · 경고 누적 · 보이는 글 · 댓글 수 (관리자 제외) |
| GET `/api/admin/members?q=&status=ACTIVE|SUSPENDED&minBans=&minWarns=&sort=activity|bans|warns|joined&page=` | 50명씩. 닉네임 · 아이디 검색, `warns` · `bans` 는 해제 · 만료돼도 남는 누적 횟수 |
| GET `/api/admin/members/{id}/sanctions` | 조치 이력 (최근 것부터, 처리 운영자 · 해제 사유 포함) |
| POST `/api/admin/members/{id}/sanctions` | `{ type: WARNING | SUSPEND | BAN, days, reason }` — SUSPEND 는 1 · 3 · 5 · 10일, 사유 200자. 정지면 `users.status = SUSPENDED`. 관리자 · 나에게는 400 |
| POST `/api/admin/sanctions/bulk` | `{ memberIds(최대 100), type, days, reason }` — 하나라도 안 되면 아무것도 안 걸림 |
| DELETE `/api/admin/members/{id}/sanctions/active` | `{ reason? }` 지금 걸린 정지 해제(revoked_at · revoked_by · revoke_reason), 상태 ACTIVE. 정지 중이 아니면 400 |
| GET `/api/me/sanctions` · POST `/api/me/warnings/seen` | 내 경고 · 정지 내역 / 경고 안내 창 "확인했어요"(`seen_at`) |

- `GET /api/auth/me` 에 `warnCount` · `banCount` · `unseenWarnings: [{ id, reason, at }]` · `suspension: null` 이 더해졌어요 (정지 중이면 로그인 · 요청이 403 이라 suspension 은 늘 null).
- 정지 중 로그인은 403 `SUSPENDED` + "이용이 정지된 계정이에요. (11월 20일 18:00 해제) 사유: …" 처럼 해제 시각 · 사유를 알려요. 이미 로그인한 토큰도 다음 요청부터 403 이고, 프론트는 안내 후 로그아웃해요.
- 정지가 끝나거나 해제되면 다음 로그인 · 요청 때 `users.status` 를 ACTIVE 로 되돌려요. 조치 기록 없이 직접 SUSPENDED 로 둔 계정은 그대로 막아요.
- 정지 시작 시각은 초 단위로 내림해서 저장해요 (MySQL DATETIME 이 초 아래를 반올림해 "아직 시작 전"으로 보이는 것을 막음).
- **검증**: `ModerationIntegrationTests` 7개 + 격리 MySQL 에서 실제 백엔드로 경고 · 정지 · 즉시 차단 · 해제 · 영구 정지 확인.

## 일정

`com.zip.backend.calendar` (CalendarController · CalendarService · CalendarRepository · CalendarDefaults). 표는 `events` · `event_categories` · `event_presets` · `trash_schedules` (DB 변경 없음). 규칙은 `frontend/API.md` 3장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/events?from=&to=` | 내 일정 (기간 400일 이내, 없으면 전부 최대 10,000개). 매년 반복 기념일은 늘 포함 |
| GET `/api/events/search?q=` | 제목 검색 (최근 것부터 100개) |
| POST · PATCH · DELETE `/api/events/{id}` | `{ date, time, title, category, anniv, yearly, done, source }` — PATCH 는 보낸 칸만. 제목 60자, 시간 HH:MM 또는 ""(종일), `source` USER · RENT(만들 때만) |
| PATCH `/api/events/{id}/done` | `{ done }` 완료 시각(`done_at`)은 완료로 바뀔 때만 적고 해제하면 지움 |
| GET · POST `/api/event-categories`, PATCH · DELETE `/{id}` | 처음 쓸 때 기본 5개 + 미분류 생성. 이름 20자, 같은 이름 409, 미분류는 바꾸기 · 지우기 400 |
| GET · POST `/api/event-presets`, PATCH · DELETE `/{id}` | 직접 만든 항목. 같은 카테고리에 같은 이름이 있으면 POST 는 그것을 돌려주고 PATCH 는 409 |
| GET `/api/trash-schedules?regionId=` | 동네 쓰레기 배출표 (읽기만) |

- 기념일(`anniv`)은 시간 · 카테고리 · 완료가 없고, 매년 반복(`yearly`)은 기념일만 (DB CHECK 와 같음).
- 카테고리 지우기는 일정 → 미분류, 기본 항목 삭제, 직접 만든 항목 → 미분류(겹치는 이름은 기존 것만 남김)를 한 트랜잭션에서 해요. MySQL 은 같은 표를 하위 질의로 읽으며 지우지 못해서(1093) 겹치는 이름을 먼저 읽어요.
- **검증**: `CalendarIntegrationTests` 6개 + 격리 MySQL 에서 실제 백엔드로 이모지 기본 카테고리 · TIME · 기념일 CHECK · RENT · 이름 바꾸기 · 지우기 확인. 프론트 동기화는 `frontend/tests/calendar-sync.test.mjs` 8개.

## 알림

`com.zip.backend.notification` (NotificationController · NotificationService · NotificationRepository). 표는 `notifications` (DB 변경 없음). 규칙은 `frontend/API.md` 6장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/notifications?status=all|unread|read` | `{ items, unreadCount }`, 새 것부터 최대 100개. 지운 알림 · 알릴 시각이 아직 안 된 알림은 빼요 |
| PATCH `/api/notifications/read` | `{ ids }` 읽음 (빈 배열이면 전부). 내 알림만 바뀌어요 |
| DELETE `/api/notifications?ids=1,2` | 읽은 알림만 지워요(`deleted_at`, 다시 안 보임). 안 읽은 알림은 그대로 |

- 알림을 만드는 곳 (`NotificationService.send`): 댓글(글쓴이) · 답글(답글을 받은 댓글 작성자, 글쓴이와 같으면 하나만) · 운영자 댓글 → `COMMUNITY`. 운영자가 지운 글 · 댓글(사유 포함) · 신고 처리로 숨긴 글 · 댓글 · 경고 · 문의 답변 → `SYSTEM`.
- 받는 사람이 한 사람(내가 내 글에 댓글)이면 만들지 않고, `user_settings.noti_on = 0` 이면 만들지 않아요. 미리보기는 줄바꿈을 빼고 40자.
- 알릴 시각은 초 단위로 내림해서 저장해요 (MySQL DATETIME 반올림으로 "미래 알림"처럼 숨지 않게).
- **생활 알림** (`LifeNotificationService`): 목록을 볼 때 일정 · 월세 알림을 앞으로 3일 치 만들어 둬요(쓰레기 배출은 `TrashReminderService` 가 배출일 0시(자정)에 만들고, 여기서는 건드리지 않음). (종류, ref_id, link) 로 이미 만든 것을 알아봐서 다시 만들지 않고(읽거나 지운 것도), 같은 회원의 동시 요청은 회원 행 잠금으로 한 줄로 세워요. 해당 없어진 안 읽은 알림(일정 삭제 · 완료 · 날짜 변경, 월세 변경, 알림 끔)은 지우고, 제목 · 내용이 바뀌면 고쳐요. 규칙은 `frontend/API.md` 6장.
- **검증**: `NotificationIntegrationTests` 4개 + `LifeNotificationIntegrationTests` 5개 + 격리 MySQL 8.0 에서 실제 백엔드로 댓글 · 문의 답변 알림 · 읽음 · 지우기, 생활 알림(두 기기 동시 10번 요청에도 한 번씩만, 날짜 변경 · 삭제 정리, 알림 끈 회원 없음) 확인.

## 공지사항

`com.zip.backend.notice` (NoticeController · NoticeService · NoticeRepository). 표는 `notices` (`db/migrations/20261121_07_notices.sql`). 규칙은 `frontend/API.md` 14장.

- 회원은 목록(고정 먼저 · 새 것부터) · 내용만, 관리자(`/api/admin/**`)만 쓰기 · 고치기 · 지우기.
- `popup: true` 공지는 `GET /api/notices/popups` 로 내용까지 내려가요(새 것부터 5개). 안 보기 · 닫기는 화면이 브라우저에 기억해요.
- `notify: true` 로 쓰면 알림을 켠 일반 회원 모두에게 `SYSTEM` 알림(`link: notice`, `refId` = 공지 번호)을 한 번에(INSERT … SELECT) 만들어요.
- **검증**: `NoticeIntegrationTests` 4개 + 격리 MySQL 8.0 에서 이모지 제목 · 5,000자 내용 · 고정 순서 · 알림 대상(알림 끈 회원 · 관리자 제외) · 고치기 · 지우기 확인.

## 메모

`com.zip.backend.memo` (MemoController · MemoService · MemoRepository). 표는 `memos` · `user_settings.home_memo_ids` (DB 변경 없음). 규칙은 `frontend/API.md` 12장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/memos?q=` | 내 메모: 고정 먼저, 그다음 최근 수정 순. `q` 는 제목 · 글에서 찾아요 |
| POST `/api/memos` | `{ title, body, color, pinned, checklist, items }` (전부 선택) → 201. 회원당 1,000개까지 |
| PATCH `/api/memos/{id}` | 보낸 칸만 바꿈 (`items` 는 통째로). 남의 메모 · 없는 메모 404 |
| DELETE `/api/memos/{id}` | 204 |
| GET · PUT `/api/me/home-memos` | `{ ids: ["5","9"] }` 홈 위젯 메모 · 순서, `{ ids: null }` = 자동. 최대 3개 · 중복 안 됨 · 내 메모만(400). 지운 메모는 GET 에서 빠져요 |

- 길이: 제목 60자 한 줄, 글 5,000자, 체크 항목 한 줄 100자 · 200개. 색: 노랑 · 분홍 · 하늘 · 초록 · 보라 · 흰색.
- `items` · `home_memo_ids` 는 JSON 글자로 저장하고 읽어요 (따옴표 · 역슬래시 포함 확인).
- **검증**: `MemoIntegrationTests` 3개 + 격리 MySQL 에서 실제 백엔드로 JSON 칸 · CHECK · 홈 메모 순서 확인.

## 고객센터

`com.zip.backend.support` (SupportController · SupportService · SupportRepository). 표는 `support_inquiries` (schema.sql 에 이미 있어서 DB 변경 없음). 규칙은 `frontend/API.md` 13장과 같아요.

| API | 현재 동작 |
|---|---|
| GET `/api/support/inquiries` | 내 문의 (최근 것부터, 답변 포함) |
| POST `/api/support/inquiries` | `{ category, title, content }` → 201 문의. 유형 5가지(이용 문의 · 오류 신고 · 개선 제안 · 계정 문의 · 기타), 제목 100자 한 줄, 내용 3,000자. 하루 20개까지(넘으면 429) |
| GET `/api/admin/support/inquiries` | 관리자: 전체 문의 (답변 대기부터, 최대 500개) |
| POST `/api/admin/support/inquiries/{id}/answer` | 관리자: `{ content }` 답변(3,000자). 문의당 하나라 이미 답변이 있으면 409, 없는 문의 404 |

- 응답 모양: `{ id, userId, nickname, category, title, content, createdAt, answer: { content, createdAt } | null }` (화면의 `Inquiry` 와 같음).
- 답변은 `answered_at IS NULL` 일 때만 저장해서, 두 관리자가 동시에 답해도 먼저 단 답변을 덮어쓰지 않아요. `answered_by` 에 답변한 관리자가 남아요.
- **검증**: `SupportIntegrationTests` 4개 + 격리 MySQL 에서 실제 백엔드로 한글 유형(ENUM) 5개 저장 · 권한 · 답변 한 번만 확인.

## 지도

`com.zip.backend.map` (MapController · MapService · MapRepository · PlaceFinder). 모두 로그인 후 요청이며 응답 모양은 `openapi.yaml`의 "지도" 태그와 같습니다.

| API | 현재 동작 |
|---|---|
| GET `/api/places/categories` | `place_categories` 15개를 `sort_order` 순서로 |
| GET `/api/places?regionId=&category=&q=&filter=` | 동네 장소. `category`는 종류 이름, `q`는 이름·설명·종류에 포함된 글자(최대 40자), `filter`는 `24h`·`cheap`·`quiet`. 가까운 순 |
| POST `/api/places/ai-search` | 프론트 `features/map/aiFind.ts`와 같은 키워드 규칙으로 최대 5곳 + `reasons` (실제 AI 미연결) |
| GET · PUT · DELETE `/api/me/place-favorites` | `place_favorites`. 없는 장소는 404, 두 번 저장해도 204. 카카오 장소(`kakao:id`)는 PUT 본문 `{ name, category }`로 `kakao_place_favorites`에 id · 이름 · 종류만 저장(주소 · 좌표 없음, 한 사람당 200곳, 이름 60자 · 없는 종류는 400) |
| GET `/api/me/place-favorites/kakao` | 저장한 카카오 장소 `[{ id, name, category }]` (저장 목록용) |
| GET · POST · PATCH · DELETE `/api/me/place-lists` | 저장 리스트 `place_lists` · `place_list_items` (`db/migrations/20261115_03_place_lists.sql`). 처음 GET 에서 "내 장소"를 만들고 리스트에 안 든 저장 장소를 넣음. 이름 20자 · 회원 안 중복 409 · 20개까지 · 색 `#RRGGBB`. 삭제 시 이 리스트에만 있던 장소는 저장 해제 |
| PUT `/api/me/place-favorites/{placeId}/lists` | `{ listIds, name?, category? }` 로 리스트 소속을 통째로 바꿈. 비우면 저장 해제, 다른 회원 리스트는 404 |
| GET · PUT `/api/me/map-settings` | `user_settings.map_categories · map_keywords`. NULL이면 정렬 순서 앞 4종류 · 빈 검색어. 없는 종류, 종류와 같은 검색어(12자 이내)는 400 |
| GET · POST `/api/places/{id}/reviews` | `PlaceReviewService`. DB 장소는 `place_reviews`(저장 · 고치기 · 지우기 후 `places.rating_avg · review_count` 갱신), 카카오 장소(`kakao:…`)는 `kakao_place_reviews`(id · 이름 + 리뷰, `name` 필수). 한 사람당 한 장소 하나(두 번이면 409). 우리 서버에만 저장 |
| PUT · DELETE `/api/places/{id}/reviews/mine` | 내 리뷰 고치기 · 지우기 (없으면 404) |
| POST `/api/places/{id}/reviews/{reviewId}/reports` | 리뷰 신고 `place_review_reports` (사유는 커뮤니티 신고와 같음, 내 리뷰 400 · 중복 409, 당시 작성자 · 내용 · 별점 · 장소 이름 스냅샷) |
| GET `/api/places/review-summary` · `/api/me/place-reviews` | 지도 목록 별점(100곳까지) · 내가 쓴 리뷰 |
| GET · PATCH `/api/admin/place-review-reports` | 관리자 리뷰 신고: HIDDEN = 리뷰 삭제 + 작성자 SYSTEM 알림, DISMISSED = 문제없음. 관리자 화면 "리뷰 신고" 탭 |

- **카카오 로컬 API**: `KAKAO_REST_KEY`(application-local.properties, Git 제외)가 있으면 `GET /api/places`의 `category` · `q` 검색을 카카오에서 지도 중심(`lat` · `lon`, 없으면 집) 반경 1km로 찾아 **DB에 저장하지 않고 그대로** 줘요(id는 `kakao:카카오장소id`). 카카오 운영 정책이 장소명 · 주소 · 좌표의 장기 저장을 제한하기 때문이에요. 즐겨찾기는 위 표처럼 id · 이름만 따로 저장하고(`db/migrations/20261115_kakao_place_favorites.sql`), 리뷰는 카카오 장소 id · 이름과 함께 `kakao_place_reviews` 에 따로 저장해요(주소 · 좌표 없음). 무료 쿼터를 지키려고 `KakaoQuota`가 같은 검색(약 100m 안)을 10분 메모리 캐시하고, 한 사람당 1분 `KAKAO_PER_USER_PER_MINUTE`(기본 30)번 · 서버 전체 하루 `KAKAO_DAILY_LIMIT`(기본 30000, 한국 시간 자정 초기화)번까지만 불러요. 카카오가 429를 주면 그날은 멈춰요. 키가 없거나 한도 · 오류면 DB 장소로 대신하고 응답 헤더 `X-Place-Notice: user-limit | daily-limit | error`로 이유를 알려요. 카카오 콘솔에서 카카오맵(로컬) 사용 설정을 켜야 하고, 유료 추가 사용은 켜지 않아요. 예전 코드가 저장한 카카오 장소(`places.source='KAKAO'`)는 정리 대상이에요. 기존 DB는 `db/migrations/20261108_places_kakao.sql`을 한 번 적용해야 해요.
- **walkMin**: `users.home_lat · home_lon`이 있으면 직선 거리 ÷ 분당 67m(올림, 최소 1분), 없으면 설명의 "도보 약 N분", 둘 다 없으면 99.
- **조건 칩**(cheap · quiet)은 아직 표에 근거 칸이 없어 설명 글자로 걸러요. 프론트와 같은 방식이며 태그 칸을 만들면 바꿔야 합니다.
- **테스트 데이터**: `db/seeds/map_places_demo.sql`이 프론트 예시와 같은 31곳(서울 마포구)을 넣어요. 다시 실행해도 중복되지 않습니다. 실제 장소 출처(공공데이터 · 카카오 로컬 등)는 미정입니다.
- **검증**: `./gradlew test`의 `MapRulesTests`(도보 시간 · AI 규칙). `map-settings`가 MySQL `JSON_TABLE`을 써서 H2 통합 테스트는 만들지 않았고, 로컬 MySQL에서 9개 API를 정상 · 오류 응답까지 직접 호출해 확인했어요.

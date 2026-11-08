# 인증 기반 API 연결

## 구현 범위

| API | 현재 동작 |
|---|---|
| POST `/api/auth/login` | 아이디/이메일 + BCrypt 비밀번호, JWT 발급, DB 세션 생성 |
| GET `/api/auth/me` | 로그인 회원 조회, 문자열 ID, 약관 동의 시각 |
| PATCH `/api/auth/me` | 닉네임·소개·캐릭터·배경색·프로필 사진 연결, 변경된 User 반환 |
| POST `/api/files` | 프로필용 JPEG/PNG 단일 파일·2MB 이하 업로드, 파일 메타데이터 반환 |
| GET `/api/files/content/{key}` | 연결된 프로필 사진 공개 조회, 연결 전 업로드는 소유자만 조회 |
| POST `/api/auth/logout` | 현재 DB 세션 해제, 해당 토큰 즉시 차단 |
| PATCH `/api/auth/me/password` | 현재 비밀번호 확인, 새 비밀번호 검증, 모든 DB 세션 해제 |
| GET `/api/terms` | 비로그인 조회, 시행일이 지난 최신 문서 종류별 1개 |
| 지도 9개 (`/api/places/**`, `/api/me/place-favorites/**`, `/api/me/map-settings`) | 아래 [지도](#지도) 참고 |
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

사진은 POST `/api/files`의 Body → form-data에서 `file` 키를 File로 선택해 JPEG/PNG를 올립니다. 반환된 문자열 id를 PATCH의 avatarFileId에 넣으세요. 파일 크기 2MB, 가로·세로 4096px 및 총 1600만 화소를 제한하고 실제 이미지 형식과 MIME이 일치하는지 확인합니다. 서버는 픽셀을 재인코딩해 EXIF 등 원본 메타데이터를 저장하지 않습니다. 현재 일반 문서와 커뮤니티 다중 첨부는 지원하지 않습니다.

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

프론트 `frontend/src/features/legal/content.ts`와 `db/schema.sql`의 SERVICE/PRIVACY/POLICY 제목·본문·버전 `2026-10-18`·동의 방식(AGREE/CONFIRM)은 자동 대조합니다. 개인정보 처리방침은 CONFIRM, 나머지 두 문서는 AGREE입니다. 만 14세 이상 확인은 별도 회원 필드입니다.

현재 본문에는 책임자·연락처·클라우드 업체/국가·AI 업체/국외 이전 항목 등의 `[ ]` 빈칸이 남아 있습니다. 문자 업체도 결정 후 실제 처리 내용을 반영해야 합니다. 외부 날씨·주소 검색은 이미 브라우저에서 호출하므로 제공 항목과 처리방침 설명을 점검해야 합니다. 재가입 차단용 banned_identities 및 신고 스냅샷의 탈퇴 후 보관 정책도 실제 구현과 맞춰야 합니다. 보관 기간·파기·휴면 계정·HTTPS에 대한 본문 약속은 구현 및 운영 절차로 확인해야 하며 이번에는 법적 적절성을 판정하거나 본문을 임의로 개정하지 않았습니다.

본문 변경 시 프론트 버전과 DB 새 버전을 함께 추가하고 기존 약관/동의 이력은 보존합니다. API는 각 종류의 시행일이 지난 최신 문서를 조회하며 미래 문서를 노출하지 않습니다.

## 지도

`com.zip.backend.map` (MapController · MapService · MapRepository · PlaceFinder). 모두 로그인 후 요청이며 응답 모양은 `openapi.yaml`의 "지도" 태그와 같습니다.

| API | 현재 동작 |
|---|---|
| GET `/api/places/categories` | `place_categories` 15개를 `sort_order` 순서로 |
| GET `/api/places?regionId=&category=&q=&filter=` | 동네 장소. `category`는 종류 이름, `q`는 이름·설명·종류에 포함된 글자(최대 40자), `filter`는 `24h`·`cheap`·`quiet`. 가까운 순 |
| POST `/api/places/ai-search` | 프론트 `features/map/aiFind.ts`와 같은 키워드 규칙으로 최대 5곳 + `reasons` (실제 AI 미연결) |
| GET · PUT · DELETE `/api/me/place-favorites` | `place_favorites`. 없는 장소는 404, 두 번 저장해도 204 |
| GET · PUT `/api/me/map-settings` | `user_settings.map_categories · map_keywords`. NULL이면 정렬 순서 앞 4종류 · 빈 검색어. 없는 종류, 종류와 같은 검색어(12자 이내)는 400 |
| GET · POST `/api/places/{id}/reviews` | `place_reviews`. 한 사람당 한 장소 하나(두 번이면 409), 저장 후 `places.rating_avg · review_count` 갱신 |

- **카카오 로컬 API**: `KAKAO_REST_KEY`(application-local.properties, Git 제외)가 있으면 `GET /api/places`의 `category` · `q` 검색을 카카오에서 지도 중심(`lat` · `lon`, 없으면 집) 반경 1km로 찾아 `places`에 upsert(`source=KAKAO`, `uk_places_source_source_id`)해요. 키가 없거나 카카오 오류면 DB 장소로 대신하고 경고 로그만 남겨요. 기존 DB는 `db/migrations/20261108_places_kakao.sql`을 한 번 적용해야 해요.
- **walkMin**: `users.home_lat · home_lon`이 있으면 직선 거리 ÷ 분당 67m(올림, 최소 1분), 없으면 설명의 "도보 약 N분", 둘 다 없으면 99.
- **조건 칩**(cheap · quiet)은 아직 표에 근거 칸이 없어 설명 글자로 걸러요. 프론트와 같은 방식이며 태그 칸을 만들면 바꿔야 합니다.
- **테스트 데이터**: `db/seeds/map_places_demo.sql`이 프론트 예시와 같은 31곳(서울 마포구)을 넣어요. 다시 실행해도 중복되지 않습니다. 실제 장소 출처(공공데이터 · 카카오 로컬 등)는 미정입니다.
- **검증**: `./gradlew test`의 `MapRulesTests`(도보 시간 · AI 규칙). `map-settings`가 MySQL `JSON_TABLE`을 써서 H2 통합 테스트는 만들지 않았고, 로컬 MySQL에서 9개 API를 정상 · 오류 응답까지 직접 호출해 확인했어요.

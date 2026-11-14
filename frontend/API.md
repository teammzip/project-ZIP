# 백엔드 API 약속

프론트(React)와 백엔드가 주고받을 API를 정리한 문서예요. **DB는 [`../db/schema.sql`](../db/schema.sql)(2026-11-07 변경 반영)이 기준**이고, 표마다 어느 API가 쓰는지 같이 적었어요.

- ✅ **프론트 코드 있음**: `src/features/auth/api/realAuthApi.ts`가 이미 이 주소로 요청해요. 요청 경로·기본 DTO가 구현돼 있어요. 실제 연결에는 `VITE_USE_MOCK=false`, 서버 설정과 통합 검증이 필요해요.
- 📝 **약속만 있음**: 화면은 다 만들어져 있고 지금은 브라우저(localStorage)에 저장해요. 백엔드가 만들면 프론트가 이 모양대로 붙일게요.
- 📝 영역의 주소·DTO는 **서버 연동을 위한 제안 계약**이에요. 실제 호출 코드가 있다는 뜻은 아니에요. 현재 브라우저 모델과 API DTO가 다른 부분은 연동 어댑터가 필요해요.
- 현재 코드와 서버 연동 시 확장할 필드를 구분해 적었어요. 최신 저장 규칙은 [DB 최근 요구사항](../db/LATEST_REQUIREMENTS.md), [생활 카테고리](../db/LIFE_CATEGORIES.md), [착수 전 점검](../db/PRE_BACKEND_REVIEW.md)을 함께 보세요.

> 마지막 대조: 2026-11-07 — 인증 실제 요청 코드, 각 기능의 types/store, 최신 DB 스키마 기준. 백엔드 구현 완료를 뜻하지 않아요.

| 영역 | 상태 | DB 표 |
|---|---|---|
| [인증 · 내 정보](#1-인증--내-정보-) | ✅ | `users` `social_accounts` `auth_sessions` `phone_verifications` `password_resets` `user_term_agreements` `withdrawal_logs` |
| [설정 · 동네·설문](#2-설정--동네-) | 📝 | `user_settings` `housing_surveys` `regions` `region_neighbors` · `users.region_verified_at` |
| [일정 · 쓰레기 배출](#3-일정--쓰레기-배출-) | 📝 | `events`(기념일·매년 반복 포함) `event_categories` `event_presets` `trash_schedules` |
| [월세 · 고정 지출·대출](#4-월세--고정-지출-) | 📝 | `rent_payments` `bill_items` `bill_payments` `housing_loans` `loan_interest_charges` |
| [가계부](#5-가계부-수입--기타-지출-) | 📝 | `ledger_categories` `incomes` `expenses` + VIEW 2개 |
| [알림](#6-알림-) | 📝 | `notifications` (읽음 · 삭제) |
| [커뮤니티 · 첨부 · 신고](#7-커뮤니티--첨부--신고-) | 📝 | `posts` `post_likes` `comments` `uploaded_files` `post_attachments` `reports` |
| [AI](#8-ai-) | 📝 | `ai_topics`(`guide` 포함) `ai_conversations` `ai_messages` `ai_usage_daily` |
| [지도](#9-지도-) | 📝 | `places` `place_categories` `place_reviews` · `place_favorites` · `users.home_lat/home_lon` |
| [약관](#10-약관-) | 📝 | `terms_documents` |
| [관리자 · 이용 정지 · 경고](#11-관리자--이용-정지-) | 📝 | `user_sanctions`(`seen_at` 포함) `users.status` `reports` |
| [메모](#12-메모-) | 📝 | `memos` |
| [고객센터](#13-고객센터-) | 📝 | `support_inquiries` |

---

## 0. 공통 규칙

| 항목 | 약속 |
|---|---|
| 주소 | 모두 `/api`로 시작. 개발 중 프론트(`localhost:3000`)가 `/api` 요청을 `localhost:8080`(백엔드)으로 넘겨요 |
| 로그인 | 로그인 후 요청에는 `Authorization: Bearer <accessToken>` 헤더가 붙어요 |
| 이름 | JSON 키는 **camelCase** (`rentDay`), DB 칸은 snake_case (`rent_day`) |
| id | DB의 BIGINT id는 **문자열**로 주세요 (`"id": "12"`). JS 숫자 범위를 넘지 않게 |
| 날짜 | 날짜 `"2026-10-24"`, 시각 `"18:00"`, 연월 `"2026-10"`, 일시는 ISO `"2026-10-24T09:00:00+09:00"` |
| 금액 | **원 단위 정수**. 단 하나, 설정의 월세(`rent`)만 화면과 같은 **만원 단위** (`user_settings.rent_amount`) |
| ENUM 값 | 필드별 DTO를 따르세요. provider, incomeType, 설문의 kind/incomePeriod, regionLocation.source는 소문자 → DB 대문자로 변환해요. 나머지 명시된 TIP/GENERAL 등은 그대로예요 |
| 실패 | `{ "message": "이미 가입된 이메일이에요." }` — 이 문장이 화면에 그대로 보여요 |
| 401 | 토큰이 없거나 만료되면 **401**. 프론트가 자동으로 로그아웃시켜요 |
| 403 | 권한이 없으면 **403** (일반 회원이 관리자 API, 정지된 회원이 글쓰기 등) |
| 목록 | 아래 개별 표의 응답을 우선해요. 글·회원은 페이지 응답, 그 외 배열 응답은 현재 제안이에요. 알림 등 배열 목록에도 페이지 처리가 필요하면 프론트 연동 전에 계약을 조정해요 |
| 내 데이터만 | 일정·가계부 등 개인 데이터는 **토큰의 사용자 것만** 보이고 고칠 수 있어야 해요 (남의 id로 요청하면 404) |

---

## 1. 인증 · 내 정보 ✅

현재 백엔드의 PATCH `/api/auth/me`는 닉네임·한 줄 소개·캐릭터·배경색·프로필 사진 연결, 그리고 소셜 첫 가입의 주소·약관 동의(`address`, `agreeTerms`, `agreePrivacy`, `agreePolicy`, `ageOver14`, `termsVersion`; 한 번만 가능)를 지원해요. 사용자 ID·권한 등 지원하지 않는 키를 보내면 400이에요.

> **서버 구현 현황(2026-11):** 로그인·로그아웃·내 정보·비밀번호 변경·프로필·회원 탈퇴·구글/네이버/카카오 소셜 로그인은 구현됨. **회원가입(`POST /auth/signup`), 휴대전화 인증, 아이디 찾기, 비밀번호 재설정, 토큰 재발급(`/auth/refresh`)은 아직 서버에 없어요.**

✅는 아래 기본 인증 요청 경로가 realAuthApi에 있다는 뜻이에요. 프로필은 연동되어 있지만 제재·위치 확장 필드와 refresh 제안까지 구현되어 있다는 뜻은 아니에요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| POST | `/api/auth/signup` | 아래 [회원가입](#회원가입) | `{ accessToken, user }` |
| POST | `/api/auth/login` | `{ loginId, password, remember }` | `{ accessToken, user }` |
| POST | `/api/auth/logout` | — | — (`auth_sessions.revoked_at` 채움) |
| GET | `/api/auth/me` | — | `user` |
| PATCH | `/api/auth/me` | `{ nickname }` 또는 [소셜 첫 가입](#소셜-로그인) 정보 | `user` |
| PATCH | `/api/auth/me/password` | `{ currentPassword, newPassword }` | — (현재 비밀번호가 틀리면 400) |
| DELETE | `/api/auth/me` | — (회원 탈퇴) | — |
| POST | `/api/auth/phone/send` | `{ phone, purpose }` | — |
| POST | `/api/auth/phone/verify` | `{ phone, code, purpose }` | `{ verificationToken }` |
| POST | `/api/auth/find-id` | `{ nickname, phone, phoneVerificationToken }` | `{ username }` |
| POST | `/api/auth/password-reset/verify` | `{ username, phone, phoneVerificationToken }` | `{ resetToken }` |
| POST | `/api/auth/password-reset` | `{ resetToken, newPassword }` | — |
| GET | `/api/oauth2/authorization/{kakao\|google\|naver}` | (페이지 이동) | 끝나면 `/oauth/callback?token=...`으로 보내기 |

- **처음 로그인 설문**: 로그인 응답의 `user.firstLogin`이 `true`면 앱이 "우리 집 설문" 별도 페이지(`/onboarding`)로 보내요. 질문: ① 생년월일 ② 간략한 주소 ③ 계약 유형(월세: 보증금 · 월세 · 관리비 포함 여부 · 포함 아니면 관리비 / 전세: 계약금 · 대출 여부와 금액 · 관리비) ④ 한 달 수입. 서버는 로그인 처리 직전 `users.last_login_at`이 `NULL`이었는지로 판단하고 값을 채워 주세요. 현재는 브라우저 `zip-housing-survey`에 저장하지만 DB에는 `housing_surveys`가 있어요. 아래 설문 API 제안으로 연결하고, 월세 설정·관리비 항목·동네 출처 변경을 함께 처리해요.
- 테스트용 계정(가짜 API 모드): 아이디 `a1` / 비밀번호 `b1` — 처음 로그인 설문 확인용, 로그인할 때마다 처음 로그인으로 취급돼요.

### user 모양
```json
{
  "id": "1", "username": "zipdemo", "email": "demo@zip.com", "nickname": "지기",
  "address": "서울시 마포구 합정동", "region": { "id": "2", "name": "마포구" },
  "provider": "email", "role": "USER", "status": "ACTIVE",
  "firstLogin": false, "agreedAt": "2026-10-18T00:00:00+09:00", "lastLoginAt": "2026-10-24T11:33:00+09:00",
  "bio": "요리 연습 중", "avatarUrl": null, "avatarEmoji": "🐻", "avatarColor": "#ffd6a5",
  "suspension": null, "warnCount": 0, "unseenWarnings": []
}
```
| 키 | DB | 설명 |
|---|---|---|
| `username` | `users.login_id` | 현재 User 타입은 선택 문자열이므로 없으면 키 생략. DB NULL을 그대로 응답하려면 프론트 타입 확장이 필요해요 |
| `region` | `users.region_id` → `regions` | 주소에서 구를 찾아 연결. 못 찾으면 `null` |
| `provider` | `users.signup_provider` | `EMAIL` → `email` 처럼 **소문자**로 |
| `role` | `users.role` | `ADMIN`은 로그인하면 관리자 화면(`/admin`)만 보여요 |
| `status` | `users.status` | 현재 인증 타입의 상태. 정지 계정 로그인은 403으로 거부하는 계약이며, 브라우저의 정지 화면 데모와 서버 인증 정책을 구분해요 |
| `agreedAt` | `user_term_agreements.agreed_at` | 소셜로 처음 들어온 사람은 `null` → 프론트가 동의 화면(`/welcome`)을 띄워요 |
| `lastLoginAt` | `users.last_login_at` | 내 정보에 "구글로 로그인했어요 · 10월 24일 11:33 로그인"처럼 보여요 (지금은 브라우저가 로그인한 시각을 기억) |
| `bio` · `avatar*` | `user_profiles` + `uploaded_files` | [프로필 꾸미기](#프로필-꾸미기-사진--한-줄-소개) |
| `suspension` · `warnCount` · `unseenWarnings` | `user_sanctions` | [11번 화면](#11-관리자--이용-정지-) — 정지 화면 · 경고 창 |

위 예시의 lastLoginAt, suspension, warnCount, unseenWarnings와 regionVerifiedAt/home는 **연동 시 확장 제안**이에요. bio·avatarFileId·avatarUrl·avatarEmoji·avatarColor는 현재 User 타입과 실제 인증 응답에 포함돼요. 이메일·주소가 없는 소셜 회원의 응답은 현재 필수 문자열 타입에 맞춰 빈 문자열을 써요. 정지 화면은 현재 별도 브라우저 저장소를 사용해요.

### 로그인
- `loginId`는 **아이디 또는 이메일** (`users.login_id` 또는 `users.email`로 찾기).
- `remember`(로그인 유지)가 `true`면 세션 만료를 길게 (`auth_sessions.remember`). 성공하면 `users.last_login_at` 갱신.
- 정지된 계정이면 403 + `{ "message": "이용이 정지된 계정이에요. (10/24 18:00 해제) 사유: …" }`.
- **재발급 토큰**(`auth_sessions.refresh_token_hash`)은 httpOnly 쿠키로 주는 걸 추천해요. `POST /api/auth/refresh` → `{ accessToken }`은 **추가 제안**이며 현재 realAuthApi/apiClient에 재발급 호출·자동 재시도는 없어요. 쿠키 방식·세션 연결·로그아웃/정지 시 access token 무효화 정책을 합의하고 구현해야 해요. (지금 프론트는 401이면 로그아웃)

### 회원가입
```json
{ "username": "tester01", "password": "abcd123!", "nickname": "테스터",
  "phone": "010-1234-5678", "phoneVerificationToken": "…",
  "email": "t@zip.com", "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true,
  "termsVersion": "2026-10-18" }
```
- **입력 규칙** (`src/features/auth/schema.ts`와 같게 서버에서도 검사)
  - 이메일은 필수·최대 100자, 주소는 공백 제거 후 필수·최대 200자예요. 소셜 첫 동의의 주소에도 같은 제한을 적용해요.
  - 동의 4개는 모두 true여야 하며 termsVersion은 서버가 유효한 동의 대상 버전인지 검사해요. 소셜 첫 동의도 주소·동의 4개·termsVersion을 함께 검사하고 일반 닉네임 수정에는 동의를 다시 요구하지 않아요.
  - 아이디 6~16자 영문 소문자·숫자 / 비밀번호 8~16자 영문·숫자·특수문자 모두 / 닉네임 2~12자
  - 아이디 · 이메일 · 휴대전화는 겹치면 안 돼요 (`uk_users_*`)
- **저장할 곳**
  - `phone`은 숫자만 (`01012345678`), `phone_verified_at` = 인증 시각
  - `ageOver14` → `users.age_confirmed_at`
  - `agreeTerms` · `agreePrivacy` · `agreePolicy` → `termsVersion`의 `terms_documents` 3줄(SERVICE · PRIVACY · POLICY)을 `user_term_agreements`에 기록
  - 정지 기록이 있는 아이디 · 닉네임 · 휴대전화로는 가입을 막아 주세요 ([관리자](#11-관리자--이용-정지-))

### 휴대전화 인증
- `purpose`: `SIGNUP` · `FIND_ID` · `RESET_PASSWORD` (`phone_verifications.purpose`)
- 흐름: `send` → 문자로 받은 6자리 입력 → `verify` → 받은 `verificationToken`을 가입·찾기 요청에 함께 보냄
- 인증번호는 3분, 틀린 횟수 제한(`attempt_count`), `verificationToken`은 **한 번만** 사용(`consumed_at`)
- 비밀번호 찾기: `password-reset/verify`로 `resetToken`을 받고(`password_resets.method = PHONE`), 같은 화면에서 `password-reset`으로 새 비밀번호 저장. 메일은 보내지 않아요.

### 소셜 로그인
1. 프론트가 `/api/oauth2/authorization/{kakao|google|naver}`로 이동 → 백엔드가 소셜 로그인 처리 (`social_accounts`). 공급자별 키는 `secrets/*.properties`에 있고, 키가 없는 공급자는 꺼져 있어요.
2. 끝나면 `/oauth/callback?token=<accessToken>`으로 돌려보내기 → 프론트가 `GET /api/auth/me` 호출. 실패하면 `/oauth/callback?error=<문구>`.
   - 같은 이메일로 가입한 다른 계정이 있으면 합치지 않고 오류(`EMAIL_EXISTS`)로 알려요. 카카오는 비즈 앱이 아니면 이메일이 없을 수 있고, 그래도 가입돼요.
3. 처음 온 사람(`agreedAt: null`)은 동의 화면에서 `PATCH /api/auth/me`로 아래를 보내요
```json
{ "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true, "termsVersion": "2026-10-18" }
```

### 프로필 꾸미기 (사진 · 한 줄 소개)
- 내 정보의 "프로필 편집"에서 **프로필 사진**(또는 캐릭터 · 배경 색)과 **한 줄 소개**를 바꿔요. 실제 API 모드는 DB에 저장하고 `zip-profile`은 표시용 캐시예요. mock 모드는 기존 브라우저 저장을 사용해요.
- 사진은 프론트가 가운데를 정사각형으로 잘라 **240px JPEG**로 줄여서 보내요 (약 15~30KB).
- 사진은 `POST /api/files`로 올리고 `PATCH /api/auth/me`에 `{ avatarFileId, bio }`를 보내요. 캐릭터를 고르면 `{ avatarEmoji, avatarColor, avatarFileId: null }`, "기본으로"는 셋 다 `null`.
- 한 줄 소개 최대 30자, 닉네임 2~12자 (닉네임은 같은 `PATCH /api/auth/me`)
- 저장 위치는 **`user_profiles`**예요. avatar_file_id → uploaded_files로 URL을 조회해요. 기존 프로필 행이 없어도 최초 수정 시 생성해요. 생략한 필드는 유지하고, bio의 null은 빈 문자열로 저장해요. 캐릭터는 최대 20자, 배경은 #RRGGBB 형식, 사진 ID는 문자열이며 본인 소유의 삭제되지 않은 JPEG/PNG 파일만 허용해요. 잘못된 파일 ID이면 닉네임을 포함한 요청 전체를 롤백해요.
- 업로드는 현재 프로필용 JPEG/PNG 단일 파일·2MB 이하를 지원해요. 내용 형식과 픽셀 범위를 검사하고 메타데이터를 제거해 저장해요. 연결된 프로필 사진은 `/api/files/content/{key}`에서 공개 조회되며 연결 전 파일은 본인 토큰으로만 조회해요. 커뮤니티 문서 업로드와 여러 첨부 합계 검증은 후속 구현이에요.
- 프론트는 서버 저장 성공 후에만 완료 안내를 보여요. 로그인·수정 응답·새로고침 조회에서 표시 캐시를 갱신하고 로그아웃 시 이전 회원 프로필을 비워요.

### 회원 탈퇴
- `users` 한 줄을 지우면 개인 데이터는 CASCADE로 같이 지워져요. `withdrawal_logs`에는 지워진 번호와 시각만 남겨요.
- ✅ 서버 구현됨: `DELETE /api/auth/me`(본문 없음, 성공 시 204). 로그인한 본인만 가능하고, 관리자 계정은 403("관리자 계정은 탈퇴할 수 없어요.")이에요. 일반·소셜 계정 모두 같고, 소셜 연결도 같이 지워져서 같은 소셜 계정으로 다시 로그인하면 새 가입이 돼요. 탈퇴 후 기존 토큰은 401이에요.
- ⏳ 아직 없는 것: 정지 이력이 있는 회원의 재가입 차단(`banned_identities` HMAC 기록)은 제재 기능과 함께 구현해야 해요.
- 업로드한 파일의 실제 저장소 파일은 서버가 따로 지워 주세요.
- user_sanctions는 탈퇴 시 삭제돼요. 재가입 차단은 `banned_identities`의 HMAC·만료/해제 기록으로 유지해요. 타인이 남긴 신고 스냅샷의 개인정보와 실제 저장소 파일도 정책에 따라 별도 정리해요.

---

## 2. 설정 · 동네 📝

백엔드 GET/PUT `/api/me/settings`는 구현돼 있어요. 프론트 화면은 아직 브라우저 저장이므로 별도 연결해야 해요. PUT은 rent/rentDay/moveIn/contractEnd/notiOn이 필수이고 선택 주소·동네 필드는 생략하면 유지해요. 월세는 만원 단위 소수점 4자리까지 지원해요. Postman 검증은 [설정 API 안내](../backend/IMPLEMENTATION.md#생활-설정-api-확인)를 보세요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/settings` | — | `settings` |
| PUT | `/api/me/settings` | `settings` | `settings` |
| GET | `/api/regions` | — | `[{ id, name, parentId, level }]` |
| GET | `/api/regions/{id}/neighbors` | — | `[{ id, name }]` |
| POST | `/api/me/region-verify` | `{ lat, lon }` | `{ region: { id, name }, verifiedAt, expiresAt }` (지금 위치의 동네로 인증) |

```json
{ "regionId": "2", "regionName": "서울 마포구", "homeAddress": "서울 마포구 합정동 123-4",
  "rent": 55, "rentDay": 15, "moveIn": "2026-02", "contractEnd": "2027-02", "notiOn": true,
  "regionLocation": { "region": "서울 마포구", "source": "verified", "point": { "lat": 37.5663, "lon": 126.9019 } } }
```
| 키 | DB | 프론트 (`LifeSettings`) |
|---|---|---|
| `regionId` · `regionName` | `users.region_id` + `user_settings.region_name` | `region` ('서울 마포구') |
| `homeAddress` | `user_settings.home_address` | `homeAddresses[로그인 회원 ID]`에서 본인 값만 전송 |
| `regionLocation` | `user_settings.region_name/region_source/region_lat/region_lon` | `{ region, source, point? }` (`source`: survey · verified · manual, 없으면 `null`). 프론트 `RegionLocation`의 `userId`는 보내지 않고 서버가 토큰으로 정해요 |
| `rent` | `user_settings.rent_amount` (**만원**) | `rent` |
| `rentDay` | `rent_day` (1~31) | `rentDay` |
| `moveIn` · `contractEnd` | `move_in_ym` · `contract_end_ym` | 같음 |
| `notiOn` | `noti_on` | 같음 |

- DB NULL은 homeAddress 빈 문자열, regionLocation `null`로 줘요. `backend/openapi.yaml`의 `Settings` · `RegionLocation`과 같아요.
- 프론트 저장 모델로 변환할 때 regionLocation과 point의 null은 생략으로 바꾸고, regionLocation에 로그인 회원의 userId를 붙여요. 서버 요청에는 userId와 다른 회원의 homeAddresses를 보내지 않아요.
- verified 출처는 서버의 실제 인증 기록으로 검사하며 요청 값만으로 인증을 부여하지 않아요. 동네 식별자와 표시명이 다른 동네를 가리키면 400으로 거절해요.
- 가입 주소 users.address, 실제 집 주소 home_address, 현재 동네 region_name, 설문 주소 스냅샷을 구분하세요. GPS 인증 좌표를 집 좌표로 덮어쓰지 않아요.
- 닉네임은 설정이 아니라 `PATCH /api/auth/me`로 바꿔요.
- 가입하면 `user_settings` 기본 줄을 같이 만들어 주세요.

### 동네 인증
- 마이페이지 > 내 정보 > 계정 · 설정의 **📍 동네 인증**, 또는 커뮤니티에서 인증 안 한 사람이 글쓰기 · 댓글 · 공감을 누르면 인증 창이 떠요.
- 프론트가 휴대폰 위치(GPS) 좌표를 보내면, 서버가 좌표 → 행정구역(카카오 로컬 `coord2regioncode` 등)으로 바꿔 그 동네를 `users.region_id`로 정하고 인증 시각을 저장해요.
  - 우리 동네와 다른 곳이면 프론트가 먼저 "지금 위치는 ○○구예요. 이 동네로 바꾸고 인증할까요?"를 물어보고, 확인하면 같은 요청을 보내요.
- 인증은 **30일** 유지. 수동 동네 변경·재설문 시 인증을 초기화해요. 단순 실제 집 상세주소 수정과 동네 변경은 구분해요. regionLocation.source는 survey/verified/manual → DB SURVEY/VERIFIED/MANUAL, 좌표는 둘 다 없거나 유효한 한 쌍이어야 해요.
- `GET /api/auth/me`의 `user`에 `regionVerifiedAt: "2026-10-25T10:58:00+09:00" | null`을 같이 주세요 (30일 지났거나 동네가 바뀌었으면 `null`).
- 지금 프론트는 서버 없이 OpenStreetMap(Nominatim)으로 동네 이름을 찾고 브라우저(`zip-life`의 `regionVerify: { region, at }`)에 저장해요 → `features/life/locateRegion.ts`, `useRegionVerify()`.

---

### 우리 집 설문 — API 추가 제안

현재 `features/onboarding/store.ts`의 HousingSurvey가 기준이며 실제 요청 코드는 없어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/housing-survey` | — | `survey` 또는 `null` |
| PUT | `/api/me/housing-survey` | 아래 설문 입력값 | 저장된 `survey` |

```json
{
  "birth": "2000-01-01", "address": "가상 동네", "addressPoint": { "lat": 37.5, "lon": 127.0 },
  "kind": "monthly", "deposit": 10000000, "rent": 550000,
  "mgmtIncluded": false, "mgmtFee": 50000, "contractFee": 0,
  "hasLoan": false, "loanAmount": 0, "income": 2500000, "incomePeriod": "monthly"
}
```

- 설문의 **모든 금액은 원**이에요. 설정 rent만 만원이므로 10000으로 나눠 동기화해요.
- birth → birth_date, kind → contract_kind(MONTHLY/JEONSE), mgmtIncluded/mgmtFee → management_included/management_fee, incomePeriod → income_period(MONTHLY/ANNUAL). 나머지는 해당 snake_case 컬럼으로 저장해요.
- addressPoint는 설문 주소 검색 당시 중심점 스냅샷이에요. 현재 위치 인증 GPS와 구분해요. 선택 값 loanAnnualRate/loanPaymentDay/loanStartDate도 해당 컬럼에 저장해요.
- userId/answeredAt은 서버가 결정해 응답해요. 입력의 회원 번호·완료 시각을 신뢰하지 않아요. 수입 응답은 설문 스냅샷이며 incomes에 실제 수입 행으로 자동 복사하지 않아요.
- 설문 저장·월세 설정·관리비 항목·SURVEY 위치 출처·인증 초기화를 트랜잭션으로 처리해요. 기존 대출 조건이 불완전하면 금리를 임의로 정하거나 자동 활성화하지 않아요.
- firstLogin은 첫 로그인 여부이지 설문 저장 완료 여부가 아니에요. 이탈 후 재진입 처리는 설문 GET 결과로 판단하도록 연동 시 보완해야 해요.

---

## 3. 일정 · 쓰레기 배출 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/events?from=2026-10-01&to=2026-10-31` | — | `[event]` |
| GET | `/api/events/search?q=월세` | — | `[event]` (상단 검색) |
| POST | `/api/events` | `{ date, time, title, category, anniv, yearly }` | `event` |
| PATCH | `/api/events/{id}` | `{ date, time, title, category, anniv, yearly }` 중 바꿀 것 | `event` |
| PATCH | `/api/events/{id}/done` | `{ done: true }` | `event` |
| DELETE | `/api/events/{id}` | — | — |
| GET | `/api/trash-schedules?regionId=2` | — | `[{ weekday, wasteType, description }]` |
| GET | `/api/event-categories` | — | `[{ id, name, ico, items: ["에어컨 필터 청소", …] }]` (기본 5개 + 내가 만든 것 + 미분류) |
| POST | `/api/event-categories` | `{ name }` | `category` |
| PATCH | `/api/event-categories/{id}` | `{ name }` | — (그 카테고리의 일정 · 항목 이름도 같이 바뀜) |
| DELETE | `/api/event-categories/{id}` | — | — (그 카테고리의 일정 · 항목은 미분류로) |
| GET | `/api/event-presets` | — | `[{ id, title, category }]` (내가 만든 항목 버튼) |
| POST | `/api/event-presets` | `{ title, category }` | `preset` |
| PATCH · DELETE | `/api/event-presets/{id}` | `{ title, category }` | — |

```json
{ "id": "31", "date": "2026-10-24", "time": "18:00", "title": "택배 반품", "category": "연락·행정", "done": false, "source": "USER", "anniv": false, "yearly": false }
```
- `time`이 빈 문자열(`""`)이면 종일 (`event_time = NULL`).
- `source`: `USER`(직접 입력) · `RENT`("월세 캘린더에 추가"로 자동 등록).
- **할 일은 일정에 합쳤어요** (백엔드 담당 시안 PR #12와 같은 방식). 체크한 일정은 `done: true`.
  - DB는 `events.is_done` · `done_at`으로 저장해요 (`todos`는 `todos_legacy_20261031`로 보관만).
- **일정 카테고리** (백엔드 담당 시안 PR #24 · #26): 일정마다 `category`가 붙고, 목록에 작은 이름표로 보여요. 고칠 때 카테고리를 바꾸거나 지울 수 있어요(→ `미분류`).
  - 기본 카테고리 5개(집 관리 · 청소·빨래 · 돈·계약 · 건강·생활 · 연락·행정)와 항목 30개는 프론트 목록이에요(`features/life/data/presets.ts`). 사용자는 **추가 · 이름 변경 · 삭제**할 수 있어요. `미분류`는 바꾸거나 지울 수 없어요.
  - 일정을 **직접 입력**하면 고른 카테고리 아래에 **항목 버튼**으로도 저장돼요(같은 이름이 이미 있으면 안 만듦). 직접 만든 항목은 수정 · 삭제할 수 있어요.
  - DB는 `event_categories` · `event_presets` 표와 `events.category_id`(NULL = 미분류)를 써요. 삭제 시 프리셋을 미분류로 이동한 뒤 카테고리를 삭제해야 해요. 미분류의 같은 제목과 충돌하면 기존 버튼을 재사용하고 중복 원본을 정리하는 등 병합 정책을 트랜잭션으로 처리하세요. FK CASCADE만으로는 프리셋이 이동하지 않고 삭제돼요.
  - 지금은 브라우저(`zip-life`의 `categories` · `customPresets`)에 저장해요.
- **달력에서 날짜를 누르면 그날 일정 창**이 떠요 (그날 일정 전부 + 쓰레기 배출, 완료 체크 · 수정 · 삭제 · 이 날에 바로 추가). 새 API는 필요 없고 위 `GET /api/events?from=…&to=…`(그날 하루) · `POST` · `PATCH` · `DELETE`를 그대로 써요.
- 달력 막대 색은 프론트가 카테고리 순서로 정해요 (미분류 · 직접 입력은 파랑, 쓰레기 배출은 초록). 같은 제목이 며칠 이어지면 막대를 이어 그려요.
- 같은 날 · 같은 제목 · 같은 카테고리 일정은 프론트가 한 번 더 추가하지 않게 막아요.
- **기념일** (일정 기록하기 > 🎉 기념일): `anniv: true`인 일정이에요. 카테고리 · 시간 · 완료 체크가 없고, 제목 앞에 `🎉 `를 붙여 저장해요(프론트가 보여 줄 때 뗌).
  - `yearly: true`면 **매년 반복**이에요. 서버는 한 줄만 저장하고, 프론트가 달력 · 목록 · 알림에 해당 연도 날짜로 펼쳐 보여요(윤년 2/29는 평년에 2/28). 펼친 일정의 id는 `"<id>@<연도>"`지만 서버에는 원래 `id`로만 요청해요.
  - 기념일은 "남은 일" 수에 안 들어가고, 홈 요약 카드 **다가오는 기념일**(오늘 포함 가장 가까운 것, D-day)과 알림(3일 전부터)에 쓰여요.
  - ✅ DB 칸은 `events.is_anniversary` · `repeat_yearly`예요 (`anniv` → `is_anniversary`, `yearly` → `repeat_yearly`로 매핑. `db/migrations/20261031_02_event_anniversaries.sql` 참고).
- 쓰레기 배출은 일정으로 저장하지 않고, 프론트가 `trash_schedules` 요일표로 달력에 그려요.
  - `weekday` 0=일 ~ 6=토, `wasteType`: `GENERAL`(일반) · `RECYCLE`(재활용) · `FOOD`(음식물)

---

## 4. 월세 · 고정 지출 📝

가계부 → 지출 → **고정 지출** 화면: 월세 + 공과금 · 통신 · 구독 · 관리비 같은 매달 나가는 돈. 항목마다 **태그**를 붙여 태그별 합계를 보여 주고, **이번 달 납부 체크리스트**로 달마다 체크해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/rent-payments?from=2026-05&to=2026-10` | — | `[{ month, amount, paid, paidAt }]` |
| PUT | `/api/rent-payments/{month}` | `{ paid: true }` | `{ month, amount, paid, paidAt }` |
| GET | `/api/bills?month=2026-10` | — | `[bill]` (그 달 납부 상태 포함) |
| POST | `/api/bills` | `{ name, amount, tag }` | `bill` |
| PATCH | `/api/bills/{id}` | `{ name, amount, tag }` 중 변경값 | `bill` (추가 제안: 항목 수정) |
| PUT | `/api/bills/{id}/payments/{month}` | `{ paid: true }` 또는 `{ amount: 41000 }` | `bill` |
| DELETE | `/api/bills/{id}` | — (해지: `is_active = 0`) | — |

고정 지출 API는 현재 백엔드에 구현돼 있어요. 프론트는 아직 브라우저 저장 방식이며 API 연결은 별도예요. POST는 당월 미납 스냅샷을 생성하고, PATCH는 당월 금액을 보존한 채 기본 금액을 수정해요. 응답의 defaultAmount는 미생성 월 예정액, amount는 선택 월 금액이에요. 당월 금액 정정은 payments API로 보내세요. GET은 DB를 변경하지 않고 과거 월은 기존 기록만, 현재/미래 월은 스냅샷 또는 예정액(snapshot=false)을 반환해요. 해지 항목도 기존 월 기록은 active=false로 남아요. [Postman 검증·상세 정책](../backend/IMPLEMENTATION.md#고정-지출-api-확인)을 참고하세요.

```json
{ "id": "5", "name": "전기", "amount": 32000, "tag": "공과금", "paid": false, "paidAt": null }
```
- 월세 `amount`는 **원 단위** (설정의 `rent` × 10000, `rent_payments.amount`).
- 고정 지출 `id`는 항목(`bill_items.id`), `amount`·`paid`는 그 달 납부 기록(`bill_payments`)의 값이에요.
- **tag**: 기본 5개 + 회원이 bill scope에 추가한 분류예요. DB `bill_items.tag VARCHAR(24)`. 현재 고정 지출 화면은 사용자 분류별 합계와 전체 납부/남은 금액을 보여요.
- **납부는 달마다 따로**: 달이 바뀌면 저절로 미납으로 보여요 (그 달 `bill_payments` 줄이 없으면 미납). 예전의 "이번 달 모두 미납으로"(`POST /api/bills/reset`)는 화면에서 없어져서 필요 없어요.
- 월별 청구 생성 작업/명시적 납부 저장에서 같은 달 행을 한 번만 만들어요 (`uk_*_period_ym`). 단순 GET이 과거 청구를 현재 금액으로 임의 생성하지 않도록 해요. 과거 금액은 월별 amount 스냅샷이고 항목 수정으로 덮어쓰지 않아요.
- 프론트는 `Bill.paidMonths: Record<YYYY-MM, boolean>`로 여러 달을 저장하고 paidMonth를 이전 형식으로도 읽어요. 선택한 달의 false가 이전 paidMonth보다 우선해요. API의 월별 paid를 해당 달 키에 매핑하고 다른 달을 덮어쓰지 마세요.
- 고정 지출 수정은 default_amount에 반영하고 납부 기록은 보존해요. 관리비 포함 월세이면 별도 관리비를 중복 합산하지 않아요. 현재 프론트의 과거 월 합계는 현재 항목 금액을 사용하므로 연동 때 월별 스냅샷 표시로 조정해야 해요.

---

### 전세 대출·월별 이자 — API 추가 제안

현재 `features/loan/interest.ts`, `store.ts`, [대출 기능 설명](src/features/loan/README.md)을 기준으로 정리한 제안이며 호출 코드는 없어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/housing-loan` | — | `loan` 또는 `null` (중지된 설정도 포함) |
| PUT | `/api/me/housing-loan` | `{ principal, annualRate, paymentDay, startDate }` | `loan` (설정·재개) |
| PATCH | `/api/me/housing-loan` | `{ active: false }` | `loan` (자동 기록 중지) |
| GET | `/api/me/loan-interest-charges?from=2026-01&to=2026-11` | — | `[charge]` |

loan은 `{ id, userId, principal, annualRate, paymentDay, startDate, active }`, charge는 `{ id, loanId, userId, date, amount, principal, annualRate }`예요. id는 문자열, userId는 인증된 회원으로 결정해요. DB의 이자 기록 id와 브라우저의 `loanId:YYYY-MM` 합성 ID를 구분해요.

- 원금 1~9,999,990,000원, 연 이율 0~100%(소수 둘째 자리), 납부일 1~31, 시작일 2000-01-01~2100-12-31을 검사해요.
- 이자는 ROUND(principal × annualRate / 1200), 한국 날짜의 납부일에 기록해요. 29~31일이 없는 달은 말일, 시작일 이전은 생성하지 않아요. 실제 은행 출금·원금 상환·일할 계산은 아니에요.
- 수정·중지 전까지 지난 납부일을 이전 조건으로 확정하고 기존 스냅샷을 보존해요. 수정 중 startDate는 유지하고, 중지 후 재개는 기존 대출 ID와 새 시작일을 사용해요.
- 서버 작업과 동시 요청에서도 loan_id/period_ym UNIQUE로 월별 한 번만 기록해요. 이미 있는 행을 새 조건으로 덮어쓰지 않아요. DB period_ym은 생성된 YYYYMM 정수이며 API의 YYYY-MM과 변환해요.
- 공과금/기타 지출에 복사하지 않아요. 기록된 이자는 홈·AI 지출에 한 번만 포함하고 고정 지출 화면의 예정 이자와 구분해요.

---

## 5. 가계부 (수입 · 기타 지출) 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/ledger/categories?kind=INCOME` | — | `[{ id, kind, name, color }]` |
| GET | `/api/incomes?month=2026-10&incomeType=fixed` | — | `[record]` (`incomeType`은 생략하면 전체) |
| POST | `/api/incomes` | `{ date, categoryId, amount, memo, incomeType }` | `record` |
| DELETE | `/api/incomes/{id}` | — | — |
| GET | `/api/expenses?month=2026-10` | — | `[record]` |
| POST | `/api/expenses` | `{ date, categoryId, amount, memo }` | `record` |
| DELETE | `/api/expenses/{id}` | — | — |
| GET | `/api/stats/monthly-income?months=6` | — | `[{ month, total }]` |
| GET | `/api/stats/spend-breakdown?month=2026-10` | — | `[{ label, amount }]` |

```json
{ "id": "77", "date": "2026-10-20", "categoryId": "7", "cat": "식비", "color": "#1fb5a3", "amount": 8500, "memo": "점심 제육덮밥" }
```
- 분류는 `ledger_categories` (`kind`: `INCOME` · `EXPENSE`). 프론트는 분류 **이름**(`cat`)으로 보여 주니 이름과 색도 같이 주세요.
- 월별 수입 VIEW는 `v_monthly_income`. 지출 VIEW `v_monthly_spend_breakdown`은 월세·전체 고정 지출·기타 지출·기록된 대출 이자를 포함하지만 **미납 청구도 포함**해요. 실제 납부 통계와 구분하고 반드시 회원 조건을 적용하세요. 사용자 태그별 고정 지출 차트는 bill_items.tag와 월별 기록으로 별도 집계해요.
- 화면: 월별 합계 · **분류별 원형 그래프**(비율 · 금액) · 목록, 기록은 **빠른 기록**(금액 → 분류 칩 → 날짜(기본 오늘) · 메모(선택) → 기록하기). 보내는 값은 위 `POST` 그대로예요.
- 지출 구성 VIEW의 "공과금"은 이제 **고정 지출 전체**(태그 공과금 · 통신 · 구독 · 관리비 · 기타)예요 ([4번](#4-월세--고정-지출-)).
- **수입은 고정 · 기타 두 종류**예요 (`/my/budget/income` 고정 수입, `/my/budget/income/other` 기타 수입). `incomeType`은 `fixed` · `other`, DB `incomes.income_type`은 `FIXED` · `OTHER`로 바꿔 저장해요. 월별 수입 VIEW는 두 종류를 합쳐요.
- 프론트 대응: `MoneyRecord { id, date, cat, amount, memo, incomeType? }`

---

### 회원별 카테고리·표시 순서 — API 추가 제안

현재 `features/life/ledgerCategories.ts`는 추가·순서 변경만 구현하며 이름 변경·삭제는 없어요. 기존 `/api/ledger/categories?kind=INCOME`은 공용 사전 전체 공개가 아니라 본인에게 허용된 분류의 ID 매핑용으로 제한해야 해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/ledger-categories?scope=bill` | — | `{ scope, categories: [{ name, color }], custom: [{ name, color }], order: [name] }` |
| POST | `/api/me/ledger-categories` | `{ scope, name }` | 해당 scope의 위 응답 |
| PUT | `/api/me/ledger-categories/order` | `{ scope, order: [name] }` | 해당 scope의 위 응답 |

- scope: `fixed-income`, `other-income`, `spend`, `bill`. categories는 기본 목록 + 본인 custom을 order에 따라 정렬한 결과예요. 기본 목록은 `features/life/data/catalog.ts`, bill은 BILL_TAGS예요.
- 서버는 이름의 앞뒤·연속 공백을 정리하고 1~24자·기본/사용자 목록 중복·허용 색·유효한 순서를 검사해요. 회원별 설정을 `user_settings.ledger_category_settings`의 scope별 `{ custom, order }`로 저장하고 다른 scope를 지우지 않아요.
- 현재 byUser/ orders의 본인 부분만 서버에 매핑해요. 이름은 식별자가 아닌 표시값이며 공용 사전의 UNIQUE 비교와 프론트 중복 검사 규칙을 일치시켜야 해요.
- 수입/지출 저장 시 본인 scope와 일치하는 이름을 공용 ledger_categories(kind,name)에 연결해 categoryId를 구해요. 사전 동시 생성 충돌은 기존 ID 재조회로 처리해요. bill scope는 bill_items.tag에 저장해요.
- 프론트 MoneyRecord/Bill의 id는 현재 number예요. API BIGINT 문자열을 Number로 무조건 변환하지 말고 연동 시 타입·어댑터를 보완해요.

---

## 6. 알림 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/notifications?status=all\|unread\|read` | — | `{ items: [noti], unreadCount }` |
| PATCH | `/api/notifications/read` | `{ ids: ["1","2"] }` (빈 배열이면 전부) | — |
| DELETE | `/api/notifications?ids=1,2` | — | — (읽은 알림 지우기. DELETE 에는 본문을 넣지 않아요) |

```json
{ "id": "1", "type": "RENT", "title": "월세 납부일이 3일 남았어요", "body": "매월 15일 · 55만원",
  "link": "budget", "refId": null, "notifyAt": "2026-10-12T09:00:00+09:00", "read": false }
```
- `type`: `EVENT` · `TRASH` · `RENT` · `BILL` · `COMMUNITY` · `SYSTEM` (`notifications.noti_type`)
- `read`는 `read_at`이 있으면 `true`. `unreadCount`가 메뉴·종의 빨간 점이 돼요.
- 알림 화면은 **안 읽음 / 읽음**으로 나눠 보고(`status`), "모두 읽음"은 `ids: []`, 읽은 알림은 골라서 **삭제**해요. 지운 알림은 다시 안 나와야 해요 (줄을 지우거나 `deleted_at`을 두고 목록에서 빼기).
- 설정에서 알림을 끄면(`notiOn: false`) 만들지 않거나 빈 목록을 주세요.
- 지금 프론트는 일정·쓰레기·월세로 알림을 직접 계산하고(`features/life/derive.ts`의 `buildNotis`), 읽음은 `zip-life`의 `notiRead`, 지운 것은 `notiDeleted`(알림 id → true)에 저장해요. 서버가 알림을 만들기 시작하면 이 API로 바꿀게요.
- **홈 알림 칸**: 메모 옆에 알림이 세로로 쌓여요(넓은 화면 4개 · 좁은 화면 3개, 나머지는 "+N개 더 있어요"). "닫기"는 **그날 하루만 숨김**이라 브라우저에만 저장해요(`zip-home-noti-closed`, "닫은 알림 다시 보기"로 되살림). 읽음 처리와는 달라서 서버 API는 필요 없어요.

---

## 7. 커뮤니티 · 첨부 · 신고 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/posts?scope=here\|near\|all&category=TIP&q=&page=0` | — | `{ items: [post], hasNext }` |
| GET | `/api/posts/home-tips` | — | `[post]` (홈 "자취 꿀팁", `is_home_tip`) |
| GET | `/api/posts/{id}` | — | `post` (댓글 포함) |
| POST | `/api/posts` | `{ category, title, body, attachmentIds }` | `post` |
| PATCH | `/api/posts/{id}` | `{ category, title, body, attachmentIds }` | `post` (내 글만) |
| DELETE | `/api/posts/{id}` | — | — (내 글만, `status = DELETED`) |
| PUT · DELETE | `/api/posts/{id}/like` | — | `{ liked, likes }` |
| POST | `/api/posts/{id}/comments` | `{ body }` | `comment` |
| PATCH | `/api/comments/{id}` | `{ body }` | `comment` (내 댓글만) |
| DELETE | `/api/comments/{id}` | — | — (내 댓글만) |
| POST | `/api/files` | `multipart/form-data` (`file`) | `{ id, name, type, size, url }` |
| POST | `/api/reports` | `{ targetType, targetId, reason, detail }` | — |

```json
{ "id": "10", "region": { "id": "2", "name": "마포구" }, "category": "TIP",
  "title": "곰팡이 제거 꿀팁", "body": "…", "author": { "id": "3", "nickname": "청소고수" }, "mine": false,
  "createdAt": "2026-10-20T21:10:00+09:00", "updatedAt": "2026-10-20T21:10:00+09:00",
  "likes": 12, "liked": true, "commentCount": 1,
  "attachments": [{ "id": "40", "name": "before.jpg", "type": "image/jpeg", "size": 183000, "url": "https://…" }],
  "comments": [{ "id": "8", "author": { "id": "1", "nickname": "지기" }, "body": "감사해요!", "mine": true, "createdAt": "…" }] }
```
- `scope`: `here`(우리 동네) · `near`(주변 동네, `region_neighbors`) · `all`(전체). 동네는 글쓴이의 `users.region_id`.
- `category`: `FREE` 자유 · `TIP` 꿀팁 · `QUESTION` 질문 · `TOWN` 동네 (프론트는 한글 이름으로 보여요)
- `mine`: 토큰의 사용자가 쓴 글·댓글이면 `true` → 수정·삭제 버튼이 보여요. `liked`도 토큰 기준.
- 숨김(`HIDDEN`)·삭제(`DELETED`) 글과 댓글은 목록에 넣지 마세요. `like_count`·`comment_count`는 서버가 맞춰 주세요.
- **첨부**: 파일을 먼저 `POST /api/files`로 올리고 받은 `id`를 글 저장 때 `attachmentIds`로 보내요 (`uploaded_files` + `post_attachments`, 순서 = 배열 순서).
  - 최대 5개 · 합계 2MB · 이미지/문서 형식만 · 내가 올린 파일만 붙일 수 있게 서버에서 검사
  - 수정할 때 `attachmentIds`에서 빠진 파일은 연결을 끊고 지워 주세요.
  - 지금 프론트는 첨부를 브라우저에 data URL로 저장해요 (`Attachment { name, type, size, data }`). 서버가 생기면 `data` 대신 `url`을 써요.
- **신고**: `targetType` `POST` · `COMMENT`, `reason` `ABUSE` · `FALSE_INFO` · `PRIVACY` · `AD_ILLEGAL` · `COPYRIGHT` · `OTHER` (`reports`).
  - COMMENT targetId는 **comments.id**예요. 현재 브라우저의 postId/commentIndex를 서버 ID로 그대로 사용할 수 없어요. 서버 연결 때 안정적인 댓글 ID로 전환해야 해요.
  - DB UNIQUE(reporter_id,target_type,target_id)는 기각/숨김 처리 후에도 같은 회원의 재신고를 막아요. target_author_snapshot/target_text_snapshot은 서버가 실제 대상에서 복사하고 클라이언트 값을 신뢰하지 않아요.
  - 화면: 남의 글은 작성자 줄, 남의 댓글은 오른쪽의 **[신고]** → 사유 하나 + 자세한 내용(기타는 필수, 200자) → 접수 후 "신고됨". 같은 사람이 같은 대상을 두 번 신고하면 409로 막아 주세요.
  - 지금 프론트는 브라우저 `zip-reports`에 저장하고(`features/community/reports.ts`), 관리자 화면 게시글 관리에 "신고 N" 배지 · "신고된 글만" · 신고 내역이 보여요.
- 정지된 회원은 글쓰기 · 댓글 · 좋아요가 403이어야 해요.
- [동네 인증](#동네-인증)을 안 했거나 30일이 지난 회원도 글쓰기 · 댓글 · 좋아요가 403이어야 해요 (읽기는 누구나).
- 프론트 대응: `features/community/types.ts` (지금은 댓글에 `id`가 없어 순서로 고쳐요. 서버가 생기면 `id`로 바꿔요)

---

## 8. AI 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/ai/topics` | — | `[{ code, name, description, photoSupported }]` |
| GET | `/api/ai/conversations?entryPoint=HOME_MODAL` | — | `[{ id, title, topic, updatedAt }]` |
| POST | `/api/ai/conversations` | `{ entryPoint, topic }` | `{ id }` ("새 대화") |
| GET | `/api/ai/conversations/{id}/messages` | — | `[message]` |
| POST | `/api/ai/conversations/{id}/messages` | `{ text }` 또는 `multipart` (`text` + `photo`) | `{ user: message, reply: message }` |
| DELETE | `/api/ai/conversations/{id}` | — | — |

```json
{ "id": "90", "role": "ASSISTANT", "text": "이번 달은 지난달보다 …", "createdAt": "…",
  "card": { "type": "SPEND_SUMMARY", "data": { "month": 10, "total": 1180000, "prevTotal": 1090000, "fixed": 620000,
            "rows": [["월세", 550000], ["식비", 210000]], "top": ["식비", 210000] } } }
```
- `card.data` 모양 (`backend/openapi.yaml`의 `SpendSummaryCard` · `LinkCard`)
  - `SPEND_SUMMARY`: `{ month, total, prevTotal, fixed, rows: [[분류, 금액]], top: [분류, 금액] | null }` — 금액은 원
  - `LINK`: `{ label, to }` — 아래 사용 방법(guide) 참고
- `topic` 코드는 `ai_topics.code`와 같아요: `qna` `guide` `nearby` `trash` `cook` `clean` `contract` `landlord` `bill` `summary` (`features/ai/topics.ts`).
  - **guide(🧭 사용 방법)** 는 ai_topics 기본 데이터에 반영돼 있어요. "월세 납부 기록은 어디서 해요?" 같은 질문에 **기능 위치를 알려 주고 그 화면으로 가는 버튼**을 줘요.
  - 답에 버튼이 붙으면 `card: { "type": "LINK", "data": { "label": "월세·공과금 (고정 지출) 바로가기", "to": "/my/budget/expense" } }`로 주세요. `to`는 앱 화면 주소예요 (`/my/calendar` · `/my/budget/expense` · `/my/budget/expense/spend` · `/my/budget/income` · `/my/memo` · `/my/noti` · `/my/settings` · `/map` · `/community` · `/ai`).
  - 지금은 프론트가 키워드로 찾아요 (`guideFor`). 실제 AI를 붙이면 질문을 보내 어느 화면인지 받아 오도록 바꿔요.
- `entryPoint`: `HOME_MODAL`(홈 "AI와 대화") · `AI_PAGE`(AI 메뉴)
- 지출 요약 카드는 **보낸 그때의 숫자**를 `card_data` JSON에 저장해서 다시 열어도 같게 보여요.
- **사진은 답을 만든 뒤 저장하지 않아요** (개인정보 처리방침). `ai_messages.attachment_id`는 비워 두세요.
- 질문할 때마다 `ai_usage_daily.question_count` +1, 하루 한도를 넘으면 429 + `{ message }`.
- 지금 프론트는 답을 브라우저 안에서 만들고(`features/ai/topics.ts`), 별도 ChatModal용 저장소 `zip-ai-chat`은 최근 40개를 저장해요. 현재 /ai의 AiChat은 컴포넌트 state를 사용해 새로 진입하면 대화가 유지되지 않아요. 서버 연동 시 대화 저장/복원을 따로 구현해야 해요.

---

## 9. 지도 📝

동네 화면 (네이버 지도처럼): 움직이는 지도(Leaflet + OpenStreetMap)에 장소 핀 · 🏠 우리 집, 장소 목록(가까운 순 · 24시간 · 저렴한 · 조용한), 장소 상세(저장 · 길찾기 · 큰 지도), **검색 = 장소 이름 + AI 장소 찾기**, **★ 저장(즐겨찾기)**, **종류 편집**(켜기·끄기, 직접 검색어 추가).
- 모바일: 화면 가득 지도 + 위 검색창 · 종류 칩 + 아래 끌어올리는 목록 시트 / PC: 왼쪽 목록 칸 + 오른쪽 지도

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/places/categories` | — | `[{ id, name, icon }]` (15종류 + 검색용 `기타`) |
| GET | `/api/places?regionId=2&category=세탁방&lat=37.5496&lon=126.9137` | — | `[place]` (가까운 순. `lat` · `lon` = 지도 중심, 생략하면 우리 집) |
| GET | `/api/places?regionId=2&q=빵집` | — | `[place]` (직접 추가한 검색어 칩: 이름 · 설명 · 종류에 글자 포함. 검색창은 `&wide=true` — 가게 이름 · 유명한 곳까지, 이름이 맞는 곳부터) |
| POST | `/api/places/ai-search` | `{ q: "밤에 갈 수 있는 약국", regionId }` | `[{ place, reasons: ["약국", "24시간·심야 운영"], walkMin }]` (최대 5곳) |
| GET | `/api/me/place-favorites` | — | `[placeId]` |
| PUT · DELETE | `/api/me/place-favorites/{placeId}` | — | — (★ 누르기 · 풀기) |
| GET · PUT | `/api/me/map-settings` | `{ categories: ["세탁방", …], keywords: ["빵집"] }` | 같은 모양 (칩에 보일 종류 · 직접 추가한 검색어) |
| GET | `/api/places/{id}/reviews` | — | `[{ id, rating, body, author, createdAt }]` (확장 기능, 화면 없음) |
| POST | `/api/places/{id}/reviews` | `{ rating, body }` | — (한 사람당 한 장소 하나) |

```json
{ "id": "3", "category": "세탁방", "name": "코인빨래방 합정점", "description": "도보 약 3분 · 24시간",
  "lat": 37.5496, "lon": 126.9137, "walkMin": 3, "address": null, "phone": null, "openHours": "24시간", "rating": 4.5, "reviewCount": 12 }
```
- **종류 15개**: 세탁방 · 편의점 · 약국 · 마트 · 카페 · 병원 · 헬스장 · 은행 · 미용실 · 다이소 · 공원 · 식당 · 반찬가게 · 세탁소 · 주민센터. 처음 칩에는 앞의 4개만 보여요.
  - DB place_categories 기본 데이터에 15개 모두 반영돼 있어요. 여기에 `기타`(📍, 정렬 99)가 있어요: 검색어로 찾은 장소 중 15종류에 안 맞는 곳을 담고, 칩 · 종류 편집에는 보이지 않아요.
- **카카오 로컬 API (구현됨, 2026-11-08)**: 서버에 `KAKAO_REST_KEY`가 있으면 `category` · `q` 검색은 서버가 카카오에서 지도 중심 반경 1km를 찾아 `places`에 저장(`source=KAKAO`, `source_id`=카카오 장소 id) · 갱신한 뒤 줘요. 종류 칩 · 검색어 칩은 반경 1km, 검색창(`wide=true`)은 반경 5km + 거리 제한 없는 정확도 검색을 합쳐 이름이 같은 곳 → 이름에 든 곳 순이에요. 15종류에 안 맞는 검색 결과는 `기타`로 저장해요. 즐겨찾기 · 리뷰가 장소 번호를 쓰기 때문에 저장해요. 분류 코드가 있는 종류(편의점 CS2 · 약국 PM9 · 마트 MT1 · 카페 CE7 · 병원 HP8 · 은행 BK9 · 식당 FD6)는 코드로, 나머지는 키워드(세탁방 → "빨래방" 등)로 찾아요. 키가 없거나 실패하면 DB 장소만. 카카오는 영업시간을 주지 않아 `openHours`는 비어 있고, 24시간 · 저렴 · 조용 조건은 설명 글자로만 걸러요. 카카오 데이터 저장 · 캐시가 이용 약관에 맞는지 팀 확인이 필요해요.
- **AI 장소 찾기**: 지금은 프론트가 예시 데이터 안에서 말을 읽어 골라요 (`features/map/aiFind.ts` — "빨래·이불 → 세탁방", "밤·24 → 24시간 운영 가산점" 같은 규칙). 서버가 생기면 AI + 지도 검색 API(예: 카카오 로컬)로 바꾸고, 화면에 보일 **추천 이유**(`reasons`)를 같이 주세요.
- **도보 시간**: 프론트는 설명의 "도보 약 N분"을 읽어 써요. 서버는 `walkMin`(우리 집 기준)을 따로 주면 좋아요.
- **우리 집 위치 (🏠, "우리 집으로" 버튼, 길찾기 출발점)**: 지금은 예시 좌표(`HOME`, `features/map/data/places.ts`)예요. 서버가 생기면 `GET /api/auth/me`의 주소를 좌표로 바꿔 `home: { lat, lon }`으로 같이 주세요 (users.home_lat/home_lon). home은 현재 User 타입에 없는 확장 제안이에요. 인증 GPS·설문 중심점은 집 위치와 구분하고 덮어쓰지 마세요.
- **조건 칩**(24시간 · 저렴한 · 조용한)은 지금 설명 글자로 걸러요. 서버는 `openHours` · 태그로 걸러 주면 더 정확해요 (`GET /api/places?…&filter=24h|cheap|quiet`).
- **길찾기 · 큰 지도**는 OpenStreetMap 링크를 새 창으로 열어요 (서버 필요 없음).
- **홈 "내 주변 지도" 카드**: 브라우저 위치(Geolocation)로 현재 위치 주변을 보여 줘요(파란 점, ◎ 내 위치 버튼). 위치를 못 받으면 예시 좌표(`HOME`)로 보여 줘요. 서버 필요 없고, 카드를 누르면 `/map`으로 가며 `state.mapCenter`로 그 위치를 넘겨요. 장소 핀은 예시 데이터예요.
- **홈 날씨 카드**: 프론트가 Open-Meteo(날씨) · Nominatim(주소 → 좌표)을 직접 불러요. 서버 API 없음.
- **즐겨찾기 번호**: 지금은 `"종류:이름"`을 써요. 서버가 생기면 `places.id`로 바꿔요. DB는 place_favorites에 저장해요.
- 프론트 대응: `Place { n: name, d: description, lat, lon }` (`features/map/data/places.ts`), 지도 설정 저장 `zip-map` (`features/map/store.ts`)

---

## 10. 약관 📝

| 메서드 | 주소 | 받는 값 |
|---|---|---|
| GET | `/api/terms` | `[{ docType, version, title, content, consentKind, required }]` (지금 시행 중인 것) |

- 약관 본문은 지금 프론트의 `src/features/legal/content.ts`에 있고, DB `terms_documents`에도 **같은 본문 · 버전(`2026-10-18`)**이 들어 있어요.
- 약관을 고칠 땐 **프론트 `LEGAL_VERSION`과 DB에 새 버전 줄을 같이** 추가해 주세요. 이전 버전 동의 기록은 지우지 않아요.

---

## 11. 관리자 · 이용 정지 📝

`role = ADMIN`만 쓸 수 있어요 (아니면 **403**). 프론트는 관리자 계정을 로그인하자마자 `/admin`으로 보내고, 앱 화면에는 못 들어가게 막아요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/admin/stats` | — | `{ members, suspended, totalBans, totalWarns, posts, comments }` |
| GET | `/api/admin/members?q=&status=&minBans=&minWarns=&sort=&page=0` | — | `{ items: [member], hasNext }` |
| GET | `/api/admin/members/{id}/sanctions` | — | `[sanction]` (조치 이력) |
| POST | `/api/admin/members/{id}/sanctions` | `{ type, days, reason }` | `member` |
| POST | `/api/admin/sanctions/bulk` | `{ memberIds, type, days, reason }` | — (여러 명 한꺼번에) |
| DELETE | `/api/admin/members/{id}/sanctions/active` | — (정지 해제) | `member` |
| GET | `/api/admin/posts?category=&regionId=&q=&page=0` | — | `{ items: [post], hasNext }` (댓글 포함) |
| DELETE | `/api/admin/posts/{id}?reason=` · `/api/admin/comments/{id}?reason=` | — (사유는 쿼리로) | — |
| GET | `/api/admin/reports?status=RECEIVED` | — | `[report]` |
| PATCH | `/api/admin/reports/{id}` | `{ status: "HIDDEN" \| "DISMISSED" }` | — |

```json
{ "id": "3", "nickname": "청소고수", "username": "cleanking", "joinedAt": "2026-05-15",
  "posts": 1, "comments": 0, "warns": 0, "bans": 1,
  "status": "SUSPENDED", "until": "2026-10-27T18:00:00+09:00", "permanent": false }
```
- **신고 관리 탭**: 같은 대상(글 하나 · 댓글 하나)에 들어온 신고를 묶어 보여요 (처리 대기 · 처리 완료). `GET /api/admin/reports`는 `{ id, targetType, targetId, target: { title | text, author, deleted }, reason, detail, reporter, status, createdAt }`로 주세요. [문제없음] = `DISMISSED`, 내용 삭제 = `HIDDEN` (같은 대상의 신고는 한 번에 바꿔 주면 좋아요: `PATCH /api/admin/reports?targetType=&targetId=`). 글 · 댓글을 지우면 관련 신고도 `HIDDEN`으로.
- **조치 → DB** (`user_sanctions`)

| 화면의 조치 | `type` · `days` | `sanction_type` | `ends_at` | `users.status` |
|---|---|---|---|---|
| 경고 | `WARNING`, `null` | `WARNING` | `NULL` | 그대로 |
| 1 · 3 · 5 · 10일 정지 | `SUSPEND`, `1`·`3`·`5`·`10` | `SUSPEND` | 지금 + N일 | `SUSPENDED` |
| 영구 정지 | `BAN`, `null` | `BAN` | `NULL` | `SUSPENDED` |
| 해제 | (DELETE) | 원래 ends_at 유지, revoked_at/revoked_by/revoke_reason 기록 | — | 다른 활성 제재가 없을 때 ACTIVE |

- `warns` · `bans`는 지금까지 받은 경고 · 정지 횟수예요. 기간이 끝나거나 해제돼도 **횟수와 이력은 남아요**.
- 정지 기간이 끝나면 `users.status`를 `ACTIVE`로 돌려 주세요 (로그인할 때 확인해도 돼요).
- 정지 중이면: 로그인 · 글쓰기 · 댓글 · 좋아요 막기, 같은 **아이디 · 닉네임 · 휴대전화로 재가입** 막기.
  - 탈퇴 시 user_sanctions는 삭제되지만 banned_identities는 user_id/sanction_id 연결만 NULL로 바뀌어 유지돼요. 서버 HMAC 키·정규화·만료·해제 동기화를 구현해야 해요.
- **현재 브라우저 가짜 API의 화면**: 정지된 계정은 앱 대신 **이용 정지 안내(`/suspended`)**만 보고(정지 기간 · 사유 · 횟수 · 문의하기 · 로그아웃), 아직 확인 안 한 **경고**가 있으면 앱에 들어올 때 **경고 안내 창**(사유 · 누적 경고)이 한 번 떠요.
  - 예시 보기: `/suspended?demo`, 아무 화면 주소 뒤 `?demo=warn`
  - 서버가 생기면 `GET /api/auth/me`의 `user`에 `suspension: { until, permanent, reason, count } | null`, `warnCount`, `unseenWarnings: [{ id, reason, at }]`를 같이 주세요.
  - 정지 중인 사람의 다른 API 요청은 **403** + `{ "message": "이용이 정지된 계정이에요. …", "code": "SUSPENDED" }`로 주는 것을 제안해요. **현재 apiClient는 401만 공통 처리**하므로 403/code 기반 정지 화면 이동은 프론트 연동 때 추가해야 해요.
  - 경고 창에서 "확인했어요"를 누르면 `POST /api/me/warnings/seen { ids }`로 알려 줄게요 (DB: `user_sanctions.seen_at`에 반영).
- 글 · 댓글 삭제는 `status = DELETED` + 작성자에게 경고/정지를 같이 걸 수 있어요 (위 `sanctions` API를 이어서 호출).
- 지금은 가짜 API와 `src/features/moderation`이 브라우저(`zipban-records`)에서 이 규칙을 흉내 내요.

---

## 12. 메모 📝

마이페이지 **"메모" 탭(`/my/memo`, 메모장)**과 **홈 메모 위젯**이 써요. React 화면이 다 있고(`features/memo`), 지금은 브라우저(`zip-memos`)에 저장해요.

- 메모장: 왼쪽 목록(고정 먼저 → 최근 수정 순, 검색) | 오른쪽 쓰기. 제목 · 글, 또는 **체크리스트**(줄마다 체크, Enter로 다음 줄), **📌 고정**, **색 6가지**, 삭제(확인 창). 쓰는 대로 자동 저장.
- 홈 위젯: **고른 메모 최대 3개를 쪽지로** 나란히 + **빠른 메모**(한 줄 적고 Enter → 새 메모). 체크리스트 쪽지는 **위젯에서 바로 체크** → `PATCH`로 `items` 전체를 보내요.
  - "메모 고르기"에서 체크한 순서대로 보여요. 안 고르면 자동(고정 → 최근 수정 순 3개). 쪽지를 꾹 눌러 끌면 자리가 바뀌어요.
  - 홈에 보일 메모 · 순서: `GET · PUT /api/me/home-memos` → `{ ids: ["5", "9"] }`, `{ ids: null }` = 자동. DB user_settings.home_memo_ids에 반영돼 있어요. 최대 3개, 본인 메모인지 서버가 검사해요.
- 홈에서 메모를 누르면 `/my/memo?id=5`로 그 메모를 열어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/memos?q=` | — | `[memo]` (고정 먼저, 그다음 최근 수정 순) |
| POST | `/api/memos` | `{ title, body, color, pinned, checklist, items }` (전부 선택) | `memo` |
| PATCH | `/api/memos/{id}` | 바꾼 칸만 (`items`는 배열 통째로) | `memo` (쓰는 대로 자동 저장 → 프론트가 0.5초 정도 모았다가 보낼게요) |
| DELETE | `/api/memos/{id}` | — | — |

```json
{ "id": "5", "title": "장보기", "body": "", "color": "노랑", "pinned": true, "checklist": true,
  "items": [{ "text": "두부", "done": false }, { "text": "계란 한 판", "done": true }],
  "createdAt": "2026-10-23T10:38:00+09:00", "updatedAt": "2026-10-24T10:38:00+09:00" }
```
- `checklist`가 `true`면 `items`(줄마다 체크), 아니면 `body`(글)를 써요. 바꿀 때 프론트가 글 한 줄 ↔ 항목 하나로 바꿔서 보내요.
- 빠른 메모는 `{ body: "택배 반품" }`만 보내요 (제목 없음 → 화면은 첫 줄을 제목처럼 보여 줘요).
- 길이: 제목 60자, 글 5,000자, 항목 한 줄 100자.
- `color`: `노랑` · `분홍` · `하늘` · `초록` · `보라` · `흰색` (영문 코드로 바꿔도 돼요: `YELLOW` 등)
- 현재 표: `memos(id, user_id FK CASCADE, title VARCHAR(60), body TEXT, color, is_pinned, is_checklist, items JSON, created_at, updated_at)` + `(user_id, is_pinned, updated_at)` 인덱스

---

## 13. 고객센터 📝

마이페이지 > 내 정보 > 고객센터(`/my/settings/support`): 자주 묻는 질문 · 1대1 문의 · 내 문의 내역. 관리자는 `/admin`에서 문의에 답변해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/support/inquiries` | — | `[inquiry]` (내 문의, 관리자는 전체) |
| POST | `/api/support/inquiries` | `{ category, title, content }` | `inquiry` |
| POST | `/api/admin/support/inquiries/{id}/answer` | `{ content }` | `inquiry` (관리자만, 문의당 답변 하나) |

```json
{ "id": "5", "userId": "2", "nickname": "지은", "category": "이용 문의", "title": "일정이 안 보여요", "content": "…", "createdAt": "2026-10-31T09:00:00Z", "answer": { "content": "…", "createdAt": "2026-10-31T11:00:00Z" } }
```
- `category`: 이용 문의 · 오류 신고 · 개선 제안 · 계정 문의 · 기타. 제목 100자, 내용 · 답변 3,000자 이내.
- 내 문의만 보이게 하고 답변은 관리자만 쓰게 **서버에서 권한을 확인**해 주세요 (지금은 브라우저 `zip-support`에 저장).
- DB: `support_inquiries` (`answer_content` · `answered_by` · `answered_at`, 답변 대기 = `answered_at IS NULL`).
- 프론트 대응: `Inquiry` (`features/support/store.ts`)

---

## 현재 DB 반영 상태와 연동 주의사항

DB 저장 공간은 다음과 같이 반영되어 있어요. 실제 API 구현과 프론트 연동은 별도예요.

| 기능 | 현재 DB |
|---|---|
| 일정·완료·카테고리·기념일 | events.is_done/done_at/category_id/is_anniversary/repeat_yearly, event_categories, event_presets |
| 설문·대출·이자 | housing_surveys, housing_loans, loan_interest_charges |
| 프로필 | user_profiles → uploaded_files (users에 중복 프로필 컬럼 없음) |
| 지도·동네 | place_favorites, 지도 분류 15개, home_lat/home_lon, region_verified_at, user_settings의 위치 출처/좌표 |
| 메모·홈 표시 | memos, user_settings.home_memo_ids |
| 고정 지출·개인 분류 | bill_items.tag VARCHAR(24), user_settings.ledger_category_settings, ledger_categories.name VARCHAR(24) |
| 실제 집 주소 | user_settings.home_address |
| 신고 | reporter/target UNIQUE, target_author_snapshot/target_text_snapshot |
| 정지·경고 | user_sanctions.seen_at/revoked_at, banned_identities |
| 알림·지원·AI | notifications.deleted_at, support_inquiries, ai_topics.guide, ai_messages.LINK |

- password_resets.method=EMAIL은 향후용이며 현재 화면은 PHONE만 사용해요.
- 첨부 MIME·5개/2MB, 소유권, JSON 내부 원소, 관리자 역할, 동네 인증 유효기간은 서버가 검사해요.
- DB 구조 감사는 44테이블·358컬럼·71키·62FK·15CHECK·2VIEW 기준이에요. API 구현이나 권한 테스트 통과를 뜻하지 않아요.
- 소셜 provider_user_id 비교 규칙, refresh 세션 정책, 예상/실제 지출 집계 기준은 [백엔드 착수 전 점검](../db/PRE_BACKEND_REVIEW.md)에 따라 구현 전에 확정하세요.

## 프론트에서 서버를 붙이는 순서 (예: 일정)

1. `features/life/api/`에 API 함수 만들기 (`apiClient` 사용, 이 문서의 주소)
2. `features/life/hooks/`에 `useQuery` · `useMutation` 훅 만들기
3. 화면이 `useLifeStore` 대신 그 훅을 쓰게 바꾸기
4. 다 옮기면 localStorage 저장(`zip-life` 등)을 지우기

지금 브라우저에 저장하는 곳 (서버가 생기면 차례로 옮겨요)

| 저장 키 | 들어 있는 것 | 파일 | 옮겨 갈 API |
|---|---|---|---|
| `zip-auth` | 로그인 토큰 · 내 정보 · 로그인한 시각 | `features/auth/store/authStore.ts` | 1번 |
| `zip-life` | 일정 · 월세 · 고정 지출 · 수입 · 지출 · 알림 읽음 · 지운 알림 · 동네 인증 · 설정 | `features/life/store.ts` | 2 ~ 6번 |
| `zip-posts` | 커뮤니티 글 · 댓글 · 좋아요 · 첨부 | `features/community/store.ts` | 7번 |
| `zip-ai-chat` | 홈 AI 대화 (최근 40개) | `features/ai/store.ts` | 8번 |
| `zip-map` | 지도 칩에 보일 종류 · 직접 검색어 · 즐겨찾기 | `features/map/store.ts` | 9번 |
| `zip-memos` | 메모 | `features/memo/store.ts` | 12번 |
| `zip-housing-survey` | 처음 로그인 설문 답변 | `features/onboarding/store.ts` | 2번 설문 API 제안, housing_surveys |
| `zip-loan-interest` | 회원별 대출 설정·월별 이자 기록 | `features/loan/store.ts` | 4번 대출 API 제안 |
| `zip-ledger-categories` | 회원별 사용자 카테고리·표시 순서 | `features/life/ledgerCategories.ts` | 5번 개인 분류 API 제안 |
| `zip-reports` | 신고·처리 상태·신고 당시 내용 | `features/community/reports.ts` | 7번 신고 API |
| `zip-support` | 고객센터 문의 · 답변 | `features/support/store.ts` | 13번 |
| `zip-profile` | 프로필 사진 · 캐릭터 · 배경 색 · 한 줄 소개 | `features/profile/store.ts` | 1번 (프로필 꾸미기) |
| `zip-home-noti-closed` | 홈 알림 회전창에서 오늘 닫은 알림 | `features/life/components/HomePhotoCard.tsx` | (서버 필요 없음) |
| `zipban-records` · `zipban-warn-seen` | 정지 · 경고 기록, 확인한 경고 횟수 (데이터 초기화로 안 지워지게 `zip-`로 시작하지 않음) | `features/moderation` | 11번 |

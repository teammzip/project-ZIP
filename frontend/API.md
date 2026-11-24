
# 백엔드 API 약속

프론트(React)와 백엔드가 주고받는 API를 정리한 문서예요. **DB는 [`../db/schema.sql`](../db/schema.sql)이 기준**이고, 표마다 어느 DB 표를 쓰는지 같이 적었어요.

- ✅ **서버 · 화면 연결됨**: 백엔드 API가 있고, 서버 모드(`VITE_USE_MOCK=false`)에서 화면이 이 API를 써요.
- 🔶 **서버만 있음**: 백엔드 API는 있는데 화면은 아직 프론트에 적힌 내용을 써요.
- 각 장의 처음 표 중 일부는 **처음에 세운 제안**이에요. 실제 구현이 제안과 달라진 곳은 장마다 "현재 서버" 안내를 붙였어요. 정확한 주소는 백엔드 `*Controller.java` 가 기준이에요.

> 마지막 대조: 2026-11-21 — 최신 dev 의 백엔드 Controller 전체 · 프론트 호출 코드와 맞춰 봤어요.

| 영역 | 상태 | DB 표 |
|---|---|---|
| [인증 · 내 정보](#1-인증--내-정보-) | ✅ | `users` `social_accounts` `auth_sessions` `email_verifications` `password_resets` `user_term_agreements` `withdrawal_logs` `user_profiles` `user_personal_info` |
| [설정 · 동네 · 설문 · 내 집 정보](#2-설정--동네-) | ✅ | `user_settings` `home_contracts` `housing_surveys` `regions` `region_neighbors` · `users.region_verified_at` (동네 목록 API 는 아직 없음) |
| [일정 · 쓰레기 배출](#3-일정--쓰레기-배출-) | ✅ | `events`(기념일·매년 반복 포함) `event_categories` `event_presets` `trash_schedules` |
| [월세 · 고정 지출 · 대출](#4-월세--고정-지출-) | ✅ | `bill_items` `bill_payments` `bill_document_keys` `bill_photo_imports` `bill_photo_drafts` `rent_payments` `housing_loans` `loan_interest_charges` |
| [가계부 · 월급](#5-가계부-수입--기타-지출-) | ✅ | `ledger_categories` `incomes` `expenses` `salary_settings` `salary_records` + VIEW 2개 |
| [알림](#6-알림-) | ✅ | `notifications` (읽음 · 삭제) |
| [커뮤니티 · 첨부 · 신고](#7-커뮤니티--첨부--신고-) | ✅ | `posts` `post_likes` `comments` `uploaded_files` `post_attachments` `reports` |
| [AI](#8-ai-) | ✅ | `ai_topics`(`guide` 포함) `ai_conversations` `ai_messages` `ai_usage_daily` (분야 목록 API 는 없고 프론트 고정) |
| [지도](#9-지도-) | ✅ | `places` `place_categories` `place_reviews` `place_favorites` `kakao_place_favorites` `place_lists` `place_list_items` · `users.home_lat/home_lon` |
| [약관](#10-약관-) | ✅ | `terms_documents` |
| [관리자 · 이용 정지 · 경고](#11-관리자--이용-정지-) | ✅ | `user_sanctions`(`seen_at` 포함) `users.status` `reports` |
| [메모](#12-메모-) | ✅ | `memos` |
| [고객센터](#13-고객센터-) | ✅ | `support_inquiries` |
| [공지사항](#14-공지사항-) | ✅ | `notices` (+ 새 공지 알림 `notifications`) |

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

> 로그인·토큰 재발급·로그아웃·내 정보·비밀번호 변경·프로필·회원 탈퇴·구글/네이버/카카오 소셜 로그인·회원가입·이메일 인증·아이디 찾기·비밀번호 재설정을 지원해요. 메일은 Gmail SMTP를 사용해요. 개발 중에는 `MAIL_LOG_ONLY=true`로 메일 발송을 대신할 수 있어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| POST | `/api/auth/signup` | 아래 [회원가입](#회원가입) | `{ accessToken, user }` |
| POST | `/api/auth/login` | `{ loginId, password, remember }` | `{ accessToken, user }` |
| POST | `/api/auth/refresh` | `zip_refresh` 쿠키, `X-Zip-Session` 헤더(JWT의 `sid`) | `{ accessToken }`, 갱신된 `zip_refresh` 쿠키 |
| POST | `/api/auth/logout` | — | — (`auth_sessions.revoked_at` 채움) |
| GET | `/api/auth/me` | — | `user` |
| PATCH | `/api/auth/me` | `{ nickname }` 또는 [소셜 첫 가입](#소셜-로그인) 정보 | `user` |
| PATCH | `/api/auth/me/password` | `{ currentPassword, newPassword }` | — (현재 비밀번호가 틀리면 400) |
| DELETE | `/api/auth/me` | — (회원 탈퇴) | — |
| POST | `/api/auth/email/send` | `{ email, purpose }` | — |
| POST | `/api/auth/email/verify` | `{ email, code, purpose }` | `{ verificationToken }` |
| POST | `/api/auth/find-id` | `{ nickname, email, emailVerificationToken }` | `{ username }` |
| POST | `/api/auth/password-reset/verify` | `{ username, email, emailVerificationToken }` | `{ resetToken }` |
| POST | `/api/auth/password-reset` | `{ resetToken, newPassword }` | — |
| GET | `/api/oauth2/authorization/{kakao\|google\|naver}` | (페이지 이동) | 끝나면 `/oauth/callback#token=...`으로 보내기 |

- **첫 주거 설문**은 로그인 응답의 `user.firstLogin`이 `true`일 때 `/onboarding`에서 표시합니다. 서버는 설문 대기 상태를 이 값으로 응답하고, 저장 또는 건너뛰기가 완료되면 `false`를 반환합니다. [첫 주거 설문 API](#첫-주거-설문)
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
- 일반 로그인은 첫 실패부터 15분 안에 비밀번호가 5회 틀리면 해당 계정의 비밀번호 로그인을 15분간 잠가요. 아이디와 이메일로 시도해도 같은 횟수를 사용해요. 실패 메시지에는 해당 계정의 누적 횟수가 표시되며, 다섯 번째 실패부터 잠금 중에는 `423 LOGIN_LOCKED`와 해제 시각을 반환해요. 가입 이메일을 인증하고 비밀번호를 재설정하면 즉시 해제돼요.
- 액세스 토큰은 기본 15분 동안 유효해요. `로그인 유지`를 켜면 같은 브라우저에서 다시 열었을 때 로그인 시점부터 최대 7일간 로그인 상태를 복원해요. 끄면 열려 있는 탭에서 최대 12시간 동안 재발급돼요. 회원가입 직후와 소셜 로그인에는 로그인 유지 정책이 적용돼요.
- 정지된 계정이면 403 + `{ "message": "이용이 정지된 계정이에요. (10/24 18:00 해제) 사유: …" }`.
- 재발급 토큰은 `HttpOnly; SameSite=Lax; Path=/api/auth` 쿠키로 발급하고 DB에는 SHA-256 해시만 저장해요. 재발급할 때 쿠키를 교체하고 기존 세션 만료 시각과 로그인 시각은 유지해요.
- 보호 API에서 액세스 토큰 만료로 401을 받으면 재발급 후 원래 요청을 한 번 재시도해요. 통신 장애에는 로그인 상태를 유지하며 다음 요청에서 다시 시도해요. 로그아웃은 현재 세션을 해제하고, 비밀번호 변경·재설정은 해당 계정의 모든 세션을 해제해요. 정지 상태에서는 재발급도 403이에요.
- 프론트와 API는 동일 오리진으로 연결해요. 운영 HTTPS 프록시가 백엔드에 HTTP로 전달하면 `ZIP_AUTH_COOKIE_SECURE=true`를 설정해요. 기능 반영 전 발급된 로그인은 새 재발급 쿠키가 필요하므로 만료 후 한 번 다시 로그인해야 해요.

### 회원가입
```json
{ "username": "tester01", "password": "abcd123!", "nickname": "테스터",
  "email": "t@zip.com", "emailVerificationToken": "…", "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true,
  "termsVersion": "2026-10-18" }
```
- **입력 규칙** (`src/features/auth/schema.ts`와 같게 서버에서도 검사)
  - 이메일은 가입 화면에서 필수·최대 100자이고 **인증을 마쳐야 가입 버튼이 켜져요**(DB `users.email`은 소셜 가입에서 못 받을 수 있어 NULL 허용). 주소는 공백 제거 후 필수·최대 200자예요. 소셜 첫 동의의 주소에도 같은 제한을 적용해요.
  - 동의 4개는 모두 true여야 하며 termsVersion은 서버가 유효한 동의 대상 버전인지 검사해요. 소셜 첫 동의도 주소·동의 4개·termsVersion을 함께 검사하고 일반 닉네임 수정에는 동의를 다시 요구하지 않아요.
  - 아이디 6~16자 영문 소문자·숫자 / 비밀번호 8~16자 영문·숫자·특수문자 모두 / 닉네임 2~12자
  - 아이디 · 이메일은 겹치면 안 돼요 (`uk_users_*`)
- **저장할 곳**
  - `email`은 소문자로 저장하고, `email_verified_at` = 인증 시각
  - `ageOver14` → `users.age_confirmed_at`
  - `agreeTerms` · `agreePrivacy` · `agreePolicy` → `termsVersion`의 `terms_documents` 3줄(SERVICE · PRIVACY · POLICY)을 `user_term_agreements`에 기록
  - 정지 중인 계정과 같은 닉네임 · 아이디는 가입을 막아도 돼요. 재가입 차단용 `banned_identities` 표는 없앴어요 ([관리자](#11-관리자--이용-정지-))

### 이메일 인증
- `purpose`: `SIGNUP` · `FIND_ID` · `RESET_PASSWORD` (`email_verifications.purpose`)
- 흐름: `send` → 메일로 받은 6자리 입력 → `verify` → 받은 `verificationToken`을 가입·찾기 요청에 함께 보냄
- 인증번호는 3분, 틀린 횟수 제한(`attempt_count`), `verificationToken`은 **한 번만** 사용(`consumed_at`)
- 비밀번호 찾기: `password-reset/verify`로 `resetToken`을 받고(`password_resets.method = EMAIL`), 같은 화면에서 `password-reset`으로 새 비밀번호 저장. 재설정 링크 메일은 따로 보내지 않아요.

### 소셜 로그인
1. 프론트가 `/api/oauth2/authorization/{kakao|google|naver}`로 이동 → 백엔드가 소셜 로그인 처리 (`social_accounts`). 공급자별 키는 `secrets/*.properties`에 있고, 키가 없는 공급자는 꺼져 있어요.
2. 끝나면 `/oauth/callback#token=<accessToken>`으로 돌려보내기 → 프론트는 URL 토큰을 즉시 제거하고 `GET /api/auth/me` 호출. fragment는 프론트 서버의 요청 URL에 전송되지 않아요. 실패하면 `/oauth/callback?error=<문구>`.
   - OAuth 성공 콜백의 토큰은 URL fragment에만 넣으세요.
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
- 업로드는 현재 프로필용 JPEG/PNG 단일 파일·2MB 이하를 지원해요. 내용 형식과 픽셀 범위를 검사하고 메타데이터를 제거해 저장해요. 연결된 프로필 사진은 `/api/files/content/{key}`에서 공개 조회되며 연결 전 파일은 본인 토큰으로만 조회해요. 커뮤니티 글 첨부도 같은 `POST /api/files` 로 사진만 올려요(문서 첨부는 받지 않음, 7장).
- 프론트는 서버 저장 성공 후에만 완료 안내를 보여요. 로그인·수정 응답·새로고침 조회에서 표시 캐시를 갱신하고 로그아웃 시 이전 회원 프로필을 비워요.

### 회원 탈퇴
- `users` 한 줄을 지우면 개인 데이터는 CASCADE로 같이 지워져요. `withdrawal_logs`에는 지워진 번호와 시각만 남겨요.
- ✅ 서버 구현됨: `DELETE /api/auth/me`(본문 없음, 성공 시 204). 로그인한 본인만 가능하고, 관리자 계정은 403("관리자 계정은 탈퇴할 수 없어요.")이에요. 일반·소셜 계정 모두 같고, 소셜 연결도 같이 지워져서 같은 소셜 계정으로 다시 로그인하면 새 가입이 돼요. 탈퇴 후 기존 토큰은 401이에요.
- 정지 이력이 있는 회원의 재가입은 막지 않기로 해서 `banned_identities` 표를 없앴어요.
- 업로드한 파일의 실제 저장소 파일은 서버가 따로 지워 주세요.
- user_sanctions는 탈퇴 시 삭제돼요. 타인이 남긴 신고 스냅샷의 개인정보와 실제 저장소 파일도 정책에 따라 별도 정리해요.

---

## 2. 설정 · 동네 ✅

> 화면은 `/api/me/settings`, `/api/me/region-verify`, `/api/me/home-info`와 `/loan`, `/api/me/housing-onboarding`, `/api/me/profile-info`를 호출해요. 동네 목록과 이웃 조회는 아래 설정 표의 제안 항목이에요.

### 내 집 정보 서버 연결 (2026-11-15)

계약·주소·대출 정보는 `GET /api/me/home-info`로 조회한다. 서버 모드에서 내 집 정보, 고정 지출의 대출 카드와 시간대 계산은 `useHomeInfo`를 통해 회원·로그인 세션별 조회 캐시를 공유한다. 첫 주거 설문은 `PUT /api/me/housing-onboarding` 성공 후 같은 캐시를 다시 조회한다.

내 집 정보 폼은 `PUT /api/me/home-info`로 계약 유형·보증금·월세·관리비·전세 계약금·입주/종료월·주소·대출 조건을 저장한다. 모든 입력 금액은 원이며 응답 `settings.rent`는 만원 단위다.

전세 대출 카드는 `PUT /api/me/home-info/loan`을 사용한다. 본문은 `{"loan":{"principal":120000000,"annualRate":4,"paymentDay":25,"startDate":"2026-11-01"}}` 형식이며 `{"loan":null}`은 자동 기록을 중지한다. 내 집 정보와 대출 카드의 저장 응답은 공통 조회 캐시에 반영한다. 회원 ID는 토큰에서 결정한다.

새 화면에서 내 집·대출 정보의 별도 조회 경로나 캐시를 만들지 마세요.

### 설정

백엔드 GET/PUT `/api/me/settings`는 구현돼 있어요. PUT은 rent/rentDay/moveIn/contractEnd/notiOn이 필수이고 선택 주소·동네 필드는 생략하면 유지해요. 월세는 만원 단위 소수점 4자리까지 지원해요. Postman 검증은 [설정 API 안내](../backend/IMPLEMENTATION.md#생활-설정-api-확인)를 보세요.

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

> **2026-11-15 구현**: `POST /api/me/region-verify { lat, lon }` → `{ region: { id, name, fullName }, dong, verifiedAt, expiresAt }`. 서버가 카카오 좌표 → 행정구역(`coord2regioncode`, 행정동 우선)으로 시 · 도 / 구 · 군을 찾아 `users.region_id` · `region_verified_at` 을 저장해요. 동네 표(regions)에 없는 구 · 군은 카카오 이름으로 만들어요(전국 인증 가능). 대한민국 밖 좌표 400, 카카오 키 없음 · 실패 503, 한 사람당 한 시간 10번(429). `GET /api/auth/me` 의 `regionVerifiedAt` 은 30일 안이면 시각, 아니면 null. **커뮤니티 글쓰기 · 댓글 · 공감은 서버가 30일 인증을 검사해요(403 `REGION_VERIFY_REQUIRED`).** 서버 모드 화면은 GPS 좌표만 보내고, 인증 여부도 `regionVerifiedAt` 으로 판단해요.
- 마이페이지 > 내 정보 > 계정 · 설정의 **📍 동네 인증**, 또는 커뮤니티에서 인증 안 한 사람이 글쓰기 · 댓글 · 공감을 누르면 인증 창이 떠요.
- 프론트가 휴대폰 위치(GPS) 좌표를 보내면, 서버가 좌표 → 행정구역(카카오 로컬 `coord2regioncode` 등)으로 바꿔 그 동네를 `users.region_id`로 정하고 인증 시각을 저장해요.
  - 우리 동네와 다른 곳이면 프론트가 먼저 "지금 위치는 ○○구예요. 이 동네로 바꾸고 인증할까요?"를 물어보고, 확인하면 같은 요청을 보내요.
- 인증은 **30일** 유지. 수동 동네 변경·재설문 시 인증을 초기화해요. 단순 실제 집 상세주소 수정과 동네 변경은 구분해요. regionLocation.source는 survey/verified/manual → DB SURVEY/VERIFIED/MANUAL, 좌표는 둘 다 없거나 유효한 한 쌍이어야 해요.
- `GET /api/auth/me`의 `user`에 `regionVerifiedAt: "2026-10-25T10:58:00+09:00" | null`을 같이 주세요 (30일 지났거나 동네가 바뀌었으면 `null`).
- 지금 프론트는 서버 없이 OpenStreetMap(Nominatim)으로 동네 이름을 찾고 브라우저(`zip-life`의 `regionVerify: { region, at }`)에 저장해요 → `features/life/locateRegion.ts`, `useRegionVerify()`.

---

### 첫 주거 설문

`PUT /api/me/housing-onboarding`은 `action: "save"`와 입력한 항목만 받거나, `{"action":"skip"}`을 받습니다. 두 경우 모두 회원 정보를 `200`으로 응답합니다. 설문이 끝나면 `firstLogin`이 `false`가 되고, 저장된 계약과 대출 조건은 `GET /api/me/home-info`에서 읽습니다.

```json
{
  "action": "save",
  "birth": "2000-01-01",
  "address": "서울 마포구",
  "salary": { "amount": 2500000, "incomePeriod": "monthly", "paymentDay": 25 },
  "timeZone": "Asia/Seoul",
  "home": { "kind": "monthly", "deposit": 10000000, "rent": 550000, "mgmtIncluded": false, "mgmtFee": 50000 }
}
```

- 설문 금액은 원 단위입니다. `salary.paymentDay`를 생략하면 월급 초안을 저장합니다.
- 전세 계약에서 입력한 대출 조건은 `home.loan`으로 보냅니다. 조건 일부만 보내면 대출 초안으로 보관합니다. 대출 정보가 없으면 `home.loan`을 생략합니다.

---

## 3. 일정 · 쓰레기 배출 ✅

> **2026-11-20 백엔드 구현 · 프론트 연결**: 아래 API가 모두 있어요. 서버 모드에서는 `features/life/calendarSync.ts`가 일정 · 카테고리 · 항목 버튼을 서버와 맞춰요(화면은 그대로 `useLifeStore`). 자세한 서버 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#일정).
> - `GET /api/events`에 `from` · `to`를 빼면 내 일정 전부예요(매년 반복 기념일은 기간과 상관없이 늘 들어가요). 일정의 `category`는 카테고리 **이름**이고, 분류 없음은 `null`(보낼 때는 `""`)이에요. `PATCH /api/events/{id}`는 `done`도 받아요.
> - 카테고리 · 항목은 처음 쓸 때 서버가 기본 5개 + 미분류와 기본 항목 30개를 만들어요(`db/seeds/event_defaults.sql`과 같은 내용). `GET /api/event-categories`의 `items`는 기본 항목, `GET /api/event-presets`는 직접 만든 항목이에요.
> - 카테고리를 지우면 그 일정은 미분류로, 직접 만든 항목은 미분류로 옮기고(같은 이름이 있으면 하나만 남김) 기본 항목은 같이 없어져요. 쓰레기 배출표는 `trash_schedules`를 읽기만 해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/events?from=2026-10-01&to=2026-10-31` | — | `[event]` |
| GET | `/api/events/search?q=월세` | — | `[event]` (상단 검색) |
| POST | `/api/events` | `{ date, time, title, category, anniv, yearly }` | `event` |
| PATCH | `/api/events/{id}` | `{ date, time, title, category, anniv, yearly }` 중 바꿀 것 | `event` |
| PATCH | `/api/events/{id}/done` | `{ done: true }` | `event` |
| DELETE | `/api/events/{id}` | — | — |
| GET | `/api/trash-schedules?regionId=2` | — | `[{ place, general: { days: [1,3,5], startTime: "18:00" } \| null, food, recycle }]` (장소 한 줄에 종류별 요일 · 시각, 배출 없는 종류는 `null`) |
| GET | `/api/trash-schedules/me` | — | `{ regionName, items }`. 내 집 주소가 비어 있으면 회원 주소를 사용해 시·군·구를 찾아요. 지역을 찾지 못하면 `regionName: null`, 배출표가 없으면 `items: []`예요. `items`는 위 배출표와 같은 형식이에요. |
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
- **달력에서 날짜를 누르면 그날 일정 창**이 떠요 (그날 일정 전부, 완료 체크 · 수정 · 삭제 · 이 날에 바로 추가). 새 API는 필요 없고 위 `GET /api/events?from=…&to=…`(그날 하루) · `POST` · `PATCH` · `DELETE`를 그대로 써요.
- 달력 막대 색은 프론트가 카테고리 순서로 정해요 (미분류 · 직접 입력은 파랑). 같은 제목이 며칠 이어지면 막대를 이어 그려요.
- 같은 날 · 같은 제목 · 같은 카테고리 일정은 프론트가 한 번 더 추가하지 않게 막아요.
- **기념일** (일정 기록하기 > 🎉 기념일): `anniv: true`인 일정이에요. 카테고리 · 시간 · 완료 체크가 없고, 제목 앞에 `🎉 `를 붙여 저장해요(프론트가 보여 줄 때 뗌).
  - `yearly: true`면 **매년 반복**이에요. 서버는 한 줄만 저장하고, 프론트가 달력 · 목록 · 알림에 해당 연도 날짜로 펼쳐 보여요(윤년 2/29는 평년에 2/28). 펼친 일정의 id는 `"<id>@<연도>"`지만 서버에는 원래 `id`로만 요청해요.
  - 기념일은 "남은 일" 수에 안 들어가고, 홈 요약 카드 **다가오는 기념일**(오늘 포함 가장 가까운 것, D-day)과 알림(3일 전부터)에 쓰여요.
  - ✅ DB 칸은 `events.is_anniversary` · `repeat_yearly`예요 (`anniv` → `is_anniversary`, `yearly` → `repeat_yearly`로 매핑. `db/migrations/20261031_02_event_anniversaries.sql` 참고).
- 일정 화면의 **우리 동네 배출표 보기**는 기본적으로 접혀 있어요. 펼칠 때 `/api/trash-schedules/me`에서 장소별 품목·요일·시작 시각을 읽어 와요. 배출일 알림(`TRASH`, 6장)은 서버가 기본 0시에 만들어요.
  - `days` 0=일 ~ 6=토, `general`(생활쓰레기) · `food`(음식물) · `recycle`(재활용). DB 는 원본 CSV 한 줄과 같은 모양(`general_days` · `general_time` …)
  - `startTime`은 배출 시작 시각(종료 시각은 저장하지 않음), `place`는 배출장소예요. 같은 동네에 장소 · 요일이 다른 줄이 여럿일 수 있어요. 데이터는 전국생활쓰레기배출정보표준데이터(공공데이터포털)를 `db/tools/trash_import.py`로 바꿔 넣어요. 마을 단위 장소는 `마을 내 생활 폐기물 배출장` 한 문구로 합쳐져 있어요.
  - 시작 시각 `00:00`은 실제 자정 배출과 "시간 제한 없음"이 섞여 있어요(원본 데이터 한계).

---

## 4. 월세 · 고정 지출 ✅

가계부 → 지출 → **고정 지출** 화면: 월세 + 공과금 · 통신 · 구독 · 관리비 같은 매달 나가는 돈. 항목마다 **태그**를 붙여 태그별 합계를 보여 주고, **이번 달 납부 체크리스트**로 달마다 체크해요.

화면은 아래 [4-1. 월별 고정 지출](#4-1-월별-고정-지출-현재-화면이-쓰는-api)의 `/api/bills/monthly`를 사용합니다. 월세는 `housingItems`에 포함되며 전세 대출은 [내 집 정보 API](#내-집-정보-서버-연결-2026-11-15)에서 관리합니다. 아래 표는 이전 방식의 고정 지출 API입니다.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/bills?month=2026-10` | — | `[bill]` (그 달 납부 상태 포함) |
| POST | `/api/bills` | `{ name, amount, tag }` | `bill` |
| PATCH | `/api/bills/{id}` | `{ name, amount, tag }` 중 변경값 | `bill` |
| PUT | `/api/bills/{id}/payments/{month}` | `{ paid: true }` 또는 `{ amount: 41000 }` | `bill` |
| DELETE | `/api/bills/{id}` | — (해지: `is_active = 0`) | — |

일반 고정 지출 API의 POST는 당월 미납 스냅샷을 생성하고, PATCH는 당월 금액을 보존한 채 기본 금액을 수정해요. 응답의 defaultAmount는 미생성 월 예정액, amount는 선택 월 금액이에요. 당월 금액 정정은 payments API로 보내세요. 일반 고정 지출 GET은 DB를 변경하지 않고 과거 월은 기존 기록만, 현재/미래 월은 스냅샷 또는 예정액(snapshot=false)을 반환해요. 해지 항목도 기존 월 기록은 active=false로 남아요. 가계부의 계약 비용은 아래 월별 조회·자동 등록 정책을 따릅니다. [Postman 검증·상세 정책](../backend/IMPLEMENTATION.md#고정-지출-api-확인)을 참고하세요.

```json
{ "id": "5", "name": "전기", "amount": 32000, "tag": "공과금", "paid": false, "paidAt": null }
```
- 월세 `amount`는 **원 단위** (설정의 `rent` × 10000, `rent_payments.amount`).
- 고정 지출 `id`는 항목(`bill_items.id`), `amount`·`paid`는 그 달 납부 기록(`bill_payments`)의 값이에요.
- **tag**: 기본 5개 + 회원이 bill scope에 추가한 분류예요. DB `bill_items.tag VARCHAR(24)`. 현재 고정 지출 화면은 사용자 분류별 합계와 전체 납부/남은 금액을 보여요.
- **납부는 달마다 따로**: 달이 바뀌면 저절로 미납으로 보여요 (그 달 `bill_payments` 줄이 없으면 미납). 예전의 "이번 달 모두 미납으로"(`POST /api/bills/reset`)는 화면에서 없어져서 필요 없어요.
- 월별 청구 생성 작업/명시적 납부 저장에서 같은 달 행을 한 번만 만들어요 (`uk_*_period_ym`). 단순 GET이 과거 청구를 현재 금액으로 임의 생성하지 않도록 해요. 과거 금액은 월별 amount 스냅샷이고 항목 수정으로 덮어쓰지 않아요.
- 프론트는 `Bill.paidMonths: Record<YYYY-MM, boolean>`로 여러 달을 저장하고 paidMonth를 이전 형식으로도 읽어요. 선택한 달의 false가 이전 paidMonth보다 우선해요. API의 월별 paid를 해당 달 키에 매핑하고 다른 달을 덮어쓰지 마세요.
- 고정 지출 수정은 default_amount에 반영하고 납부 기록은 보존해요. 관리비 포함 월세이면 별도 관리비를 중복 합산하지 않아요. 가계부는 조회한 월의 API 응답에 포함된 금액을 합산해요.

---

### 전세 대출·월별 이자

`GET /api/me/home-info` 응답에 `loan`, `loanDraft`, `charges`가 포함됩니다. 대출을 설정하거나 중지하려면 `PUT /api/me/home-info/loan`을 호출합니다. [내 집 정보 API](#내-집-정보-서버-연결-2026-11-15)

loan은 `{ id, userId, principal, annualRate, paymentDay, startDate, active }`, charge는 `{ id, loanId, userId, date, amount, principal, annualRate }`예요. id는 문자열, userId는 인증된 회원으로 결정해요. DB의 이자 기록 id와 브라우저의 `loanId:YYYY-MM` 합성 ID를 구분해요.

- 원금 1~9,999,990,000원, 연 이율 0~100%(소수 둘째 자리), 납부일 1~31, 시작일 2000-01-01~2100-12-31을 검사해요.
- 이자는 ROUND(principal × annualRate / 1200), 한국 날짜의 납부일에 기록해요. 29~31일이 없는 달은 말일, 시작일 이전은 생성하지 않아요. 실제 은행 출금·원금 상환·일할 계산은 아니에요.
- 수정·중지 전까지 지난 납부일을 이전 조건으로 확정하고 기존 스냅샷을 보존해요. 수정 중 startDate는 유지하고, 중지 후 재개는 기존 대출 ID와 새 시작일을 사용해요.
- 서버 작업과 동시 요청에서도 loan_id/period_ym UNIQUE로 월별 한 번만 기록해요. 이미 있는 행을 새 조건으로 덮어쓰지 않아요. DB period_ym은 생성된 YYYYMM 정수이며 API의 YYYY-MM과 변환해요.
- 공과금/기타 지출에 복사하지 않아요. 기록된 이자는 홈·AI 지출에 한 번만 포함하고 고정 지출 화면의 예정 이자와 구분해요.

### 4-1. 월별 고정 지출 (현재 화면이 쓰는 API)

팀원들이 기능을 넣을 때마다 적은 설명을 날짜 순서대로 모았어요. 뒤에 적힌 규칙이 앞의 것을 바꾼 경우가 있으니 아래쪽이 최신이에요.

#### 월별 조회 · 시간대

고정 지출 월별 조회: GET `/api/bills/monthly?month=YYYY-MM&timeZone=Asia%2FSeoul`. DB의 등록 집 주소(없으면 본인 설문·가입 주소) → 실제 현재 위치 → 기기 설정 순으로 결정한 시간대를 보내며 서버 시각으로 조회 범위를 제한한다. 조회는 DB를 바꾸지 않는다. 현재 월은 미납·예정도 포함한다. 과거 월은 저장된 기록을 우선 반환하고, 시작월과 종료월이 모두 있는 월세 계약의 기간 안에서는 누락된 월세와 별도 관리비를 미납 예상액(`snapshot=false`)으로도 반환한다.

#### 월별 고정 지출 쓰기 API (2026-11-18)

등록 API의 name은 선택이며 생략하면 분류명으로 저장합니다. 신규 납부 기한은 요청 timeZone의 오늘 이전이면 400입니다. 같은 월·분류·금액만으로 중복을 차단하지 않습니다. AI가 명확히 읽은 발행처·문서 식별번호·청구 월을 정규화한 해시가 같으면 409로 차단하며 식별 정보 원문은 DB에 저장하지 않습니다. 식별 정보가 불명확하면 재촬영 사진 간 중복 검사는 불가능하다는 안내와 함께 등록합니다. 동일 파일의 재업로드는 기존 해시로 계속 차단합니다.

최신 변경: 사진 등록은 AI 대화의 POST `/api/ai/conversations/{id}/bill-photo`로 이동했습니다. multipart `photo`, `question`과 query `month`, `timeZone`을 받으며 `{bill, reply}`를 반환합니다. 소유한 대화에서만 호출 가능하고 AI 답변·청구·중복 방지 해시를 함께 저장합니다. 가계부는 사진 업로드를 제공하지 않습니다. 월별 등록/수정에 선택 `memo`(200자 이내)를 추가했고 조회 응답에도 반환합니다. 아래 초기 `/api/bills/monthly/photo` 설명은 더 이상 사용하지 않습니다.

- `POST /api/bills/monthly?month=YYYY-MM&timeZone=IANA`는 `tag`, `amount`, `dueDate`와 선택 `name`, `memo`, `memoId`를 받습니다. 같은 이름·분류의 활성 항목을 재사용할 수 있으며 해당 월에 이미 등록한 항목은 `409`입니다.
- `PATCH /api/bills/monthly/{id}?month=YYYY-MM&timeZone=IANA`는 `amount`, `dueDate`와 선택 `memo`, `memoId`를 받습니다. 미등록·타인 항목은 `404`, 납부 완료 건은 `409`입니다. 금액이나 기한을 변경하면 조건에 맞는 이후 미납 기록에도 적용됩니다.
- ~~`POST /api/bills/monthly/photo?month=YYYY-MM&timeZone=IANA`~~ (더 이상 없음 — 아래 "고지서 인식 후 확인 등록"으로 바뀜): multipart `photo` (JPG/PNG, 2MB). Gemini가 금액·납부 기한을 추출하고 검증 후 자동 등록한다. 사진은 보관하지 않고 중복 방지 해시를 DB에 저장한다. 실패 시 등록하지 않는다.
- 응답은 기존 ServerBill에 `dueDate: YYYY-MM-DD | null` 추가. 월별 조회 응답의 `snapshot=true`는 등록된 월 기록, false는 미등록 예정액이다.
- 미래 월/잘못된 입력 400, 미로그인 401, 중복 409, 불명확한 사진 422, AI 일일 제한 429, 제공자 실패 502, AI 설정 없음 503.
- AI 사진은 사용자의 버튼 클릭 시 Google Gemini로 전송되며 기존 AI 대화와 일일 사용량을 공유한다. 등록 후 화면에서 수정 가능하다.
- 실제 모드 월별 고정 지출 화면에 연결. 일반 AI 채팅·기타 지출은 이 기능 범위 밖이다.
- DELETE /api/bills/monthly/{id}?month=YYYY-MM&timeZone=IANA: 등록된 선택 월 기록 삭제(204). 삭제 재요청 204, 미등록/타인 404. 다른 월 및 고지서 중복 인식 정보 보존.

#### 계약별 고정 지출 서버 조회 (2026-11-18)

`GET /api/bills/monthly`는 `contractKind`(`monthly`·`jeonse`·`null`), `managementIncluded`, `contractPeriod`와 `housingItems`(월세·대출 이자)를 함께 반환합니다. 화면은 `items`와 `housingItems`를 합산합니다. `paid`는 등록된 납부 처리 상태이고, `snapshot: false`는 아직 저장되지 않은 예정 금액입니다.

#### 계약 고정 지출 자동 등록

POST `/api/bills/monthly/auto-register?timeZone=IANA&month=YYYY-MM`은 선택한 월의 계약 비용을 자동 등록한다(204). 월을 생략하면 현재 월을 사용하고 미래 월은 400이다. 시작월과 종료월이 모두 있는 월세 계약은 입주월부터 종료월까지 선택한 현재·과거 월의 누락된 월세와 별도 관리비를 계약 금액으로 미납 등록한다. 기존 금액·납부 기한·납부 여부는 보존한다. 전세 이자와 기간이 일부만 등록된 계약의 자동 등록은 현재 월에 적용한다. 가계부와 홈 지출 합계는 선택 월을 자동 등록한 후 조회한다. 계약 관리비는 `homeManaged=true`이며 일반 수정·삭제와 금액 변경은 409다.

#### 고지서 인식 후 확인 등록 (기존 즉시 등록 흐름 대체)

공과금·생활비(bill) 대화에서만 POST /ai/conversations/{id}/bill-photo를 사용합니다. 분석 응답은 draftId, preview, reply이며 가계부에는 아직 저장하지 않습니다. POST /ai/conversations/{id}/bill-photo/{draftId}/decision에 {"register":true}로 동의하면 서버 임시 결과를 가계부에 등록합니다. false는 취소입니다. 처리된 결과 409, 만료(30분) 410, 다른 분야 403입니다. DB 06 마이그레이션이 필요합니다. QR 링크는 접속하지 않으며 명확한 금액·납부 기한이 없으면 등록하지 않습니다.

#### 계약 기간 및 수정일부터 미납·예정 변경 반영

월별 가계부 신규 등록·수정은 등록된 계약의 시작~종료 월 범위를 서버에서 검사합니다. 납부 기한도 계약 월 범위 안이어야 합니다. 계약이 미등록이면 기존 독립 고지서 등록은 유지합니다. 내 집 정보 자체(미래 계약 설정 포함)는 저장할 수 있습니다. 수정 시 같은 고정 지출 ID의 오늘 이후 미납·예정 기록만 갱신하며 납부 완료·삭제·과거 기한 기록은 자동 갱신하지 않습니다. 새 납부일이 오늘 이전으로 바뀌는 대상이 있으면 400으로 전체 저장을 취소합니다. DB 07 마이그레이션이 필요합니다. 과거의 무조건 스냅샷 보존 안내는 이 규칙으로 대체합니다.

#### 계약 기간 및 유형 전환 보완 (2026-11-18)

관리비 계약 분리 보완: bill_items.home_contract_kind가 monthly/jeonse인 항목은 현재 계약 유형과 일치할 때만 조회·합산합니다. 계약 유형 전환 시 이전 관리비를 비활성화하고 오늘 이후 미납 예정분을 취소 표시하며 새 유형의 항목을 생성합니다. 일반 지출의 유형은 NULL입니다. 월세 저장 시 남아 있는 오늘 이후 미납 월세 금액을 동기화하며, 새 납부일이 이미 지났다면 해당 기록의 기존 기한을 유지합니다.

반복 납부일은 1~31일이면 오늘 이전이어도 내 집 정보에 저장할 수 있습니다. 저장 시 `payment_effective_from`을 지역 기준 오늘로 기록합니다. 시작월과 종료월이 등록된 월세 계약은 계약 기간 안의 누락 금액을 채웁니다. 전세 이자는 반영일이 속하는 월과 대출 시작일 이후 기한부터 반영합니다. 기존 납부 완료와 지난 기한의 기록은 보존합니다. `payment_effective_from`은 DB 08 마이그레이션에서 추가된 열입니다.

고정 지출 monthly 응답의 housingItems는 현재 contractKind에 해당하는 주거비만 반환합니다. monthly이면 월세, jeonse이면 전세 대출 이자를 반환하며 과거 조회 월에도 동일합니다. 반대 유형의 기존 기록은 조회에서 제외하고 DB에는 보존합니다. 공통 items(관리비·공과금)는 이 유형 필터로 제외하지 않습니다. 가계부 및 같은 응답을 사용하는 홈 합계에 동일하게 반영됩니다.

내 집 정보 저장은 입력 계약 기간에 현재 월이 포함되지 않으면 400입니다. 고정 지출을 직접 등록하거나 수정할 때는 선택 월과 현재 월이 모두 계약 기간 안이어야 합니다. 월세 계약 비용의 자동 등록은 조회한 월이 등록된 계약 기간 안인지 확인합니다. monthly 응답 contractPeriod.currentOutside는 현재 월의 기간 이탈 여부이며 outside는 선택 월의 이탈 여부입니다. 계약 유형 저장 시 오늘 이후 미납인 반대 유형의 월세/이자 예정분을 정리합니다. 과거 및 납부 완료 기록은 보존합니다.

#### 고정 지출 납부 · 해지 (2026-11-19)

PUT `/api/bills/monthly/{id}/payment?month=YYYY-MM&timeZone=Asia/Seoul`에 `{paid: true|false}`를 보내 등록된 월별 납부 상태만 변경합니다(204). id는 숫자 항목 ID 또는 monthly 응답의 `rent:YYYY-MM`, `interest:{loanId}:YYYY-MM`입니다. 반복 납부는 paid_at을 유지하고 취소는 NULL로 복원합니다. 미등록·삭제 건은 404, 미래 월과 잘못된 body는 400입니다. 일반 지출 해지는 POST `/api/bills/monthly/{id}/termination?timeZone=...`에 `{effectiveDate: 'YYYY-MM-DD'}`를 보냅니다(204). 적용일 이후 미납·예정 건을 취소 표시하고 납부 완료와 적용일 이전 기록은 보존합니다. 현재·미래 해지일을 사용자가 입력합니다. 월세·이자·계약 관리비 조건 종료는 내 집 정보에서 관리합니다. monthly 응답의 terminationDate는 해지 적용일입니다. 기존 DB에 20261119_01_bill_termination.sql 적용 필요.

---

## 5. 가계부 (수입 · 기타 지출) ✅

`kind`는 `income` 또는 `spend`입니다. 조회와 저장에 사용하는 시간대는 `timeZone`으로 보냅니다.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/ledger/{kind}?month=2026-10&timeZone=Asia/Seoul` | 수입 조회에 선택 `incomeType` | 거래 목록 `200` |
| POST | `/api/ledger/{kind}?timeZone=Asia/Seoul` | 아래 저장 본문 | `201` |
| PUT | `/api/ledger/{kind}/{id}?timeZone=Asia/Seoul` | 아래 저장 본문 | `204` |
| DELETE | `/api/ledger/{kind}/{id}` | — | `204` |
| GET | `/api/ledger/income-summary?timeZone=Asia/Seoul` | — | 수입이 있는 최근 12개월의 `{ "YYYY-MM": 합계 }` |
| GET | `/api/me/salary` | — | 월급 설정과 선택 초안 |
| PUT | `/api/me/salary?timeZone=Asia/Seoul` | `{ amount, incomePeriod, paymentDay }` | 저장한 월급 설정 |

저장 본문은 `date`, `cat`, `amount`와 선택 `memo`, `memoId`를 받습니다. `incomeType`은 수입 저장에 필수이며 `fixed` 또는 `other`입니다. 수입 조회에서 생략하면 `fixed`를 사용합니다. 금액은 원 단위 양의 정수이며 `memo`는 최대 100자입니다.

```json
{ "id": "77", "date": "2026-10-20", "cat": "식비", "amount": 8500, "memo": "점심 제육덮밥",
  "salaryCategory": false, "salaryManaged": false }
```
거래 목록에는 `id`, `date`, `cat`, `amount`, `memo`, `salaryCategory`, `salaryManaged`가 포함됩니다. 연결 메모가 있으면 `memoId`와 `memoTitle`도 반환합니다. [가계부 OpenAPI](../backend/openapi.yaml) · [프론트 요청 타입](src/features/life/ledgerApi.ts)

---

### 회원별 카테고리·표시 순서

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/ledger-categories?scope=bill` | — | `{ custom: [{ name, color }], order: [name], hidden: [name], salaryLabel }` |
| POST | `/api/me/ledger-categories?scope=bill` | `{ action, name, target? }` | 갱신된 설정 |

- `scope`는 `fixed-income`, `other-income`, `spend`, `bill`이에요. 기본 목록에서 `hidden`을 빼고 `custom`을 합쳐 `order` 순서로 표시해요.
- `action`은 `add`, `rename`, `delete`, `move`예요. 이름 변경에는 새 이름을, 이동에는 기준 카테고리 이름을 `target`으로 보내요.
- 서버는 앞뒤·연속 공백을 정리하고 1~24자, 중복 이름, 이동 대상을 검사해요. 회원별 설정은 `user_settings.ledger_category_settings`에 분류별로 저장해요.
- 이름을 변경하면 같은 계정과 같은 분류 그룹의 기존 거래에도 새 이름이 적용돼요. 카테고리를 삭제하면 선택 목록에서 사라지고 기존 거래에는 마지막 분류명이 표시돼요. 삭제한 기본 이름을 다시 추가하면 기본 카테고리가 복원돼요.
- 서버에 해당 분류 설정이 없으면 `{ action: 'import', previous: { custom, order } }`로 현재 브라우저의 기존 설정을 이관해요. 한 번 설정된 분류에는 다시 이관하지 않아요.

---

## 6. 알림 ✅

> 서버는 댓글과 답글(`COMMUNITY`), 관리 조치와 문의 답변 및 공지(`SYSTEM`), 일정 · 쓰레기 배출일 · 월세 납부 안내를 저장해요. 알림을 끈 회원(`user_settings.noti_on = 0`)에게는 새 알림을 만들지 않아요. 자세한 서버 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#알림)에 있어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/notifications?status=all\|unread\|read` | — | `{ items: [noti], unreadCount }` |
| PATCH | `/api/notifications/read` | `{ ids: ["1","2"] }` (빈 배열이면 전부) | — |
| DELETE | `/api/notifications?ids=1,2` | — | — (읽은 알림 지우기. DELETE 에는 본문을 넣지 않아요) |

```json
{ "id": "1", "type": "RENT", "title": "월세 납부 안내", "body": "납부 기한 2026-10-15 · 550,000원",
  "link": "budget", "refId": "202610", "notifyAt": "2026-10-12T00:00:00Z", "read": false }
```
- `type`: `EVENT` · `TRASH` · `RENT` · `BILL` · `COMMUNITY` · `SYSTEM` (`notifications.noti_type`)
- `TRASH`(쓰레기 배출일): 서버가 만들어요(`notification/TrashReminderService`). 내 집 주소(`homeAddress`, 없으면 회원 주소 `address` — 가입 · 주거 설문에서 정함)에서 시군구를 찾고, 그 동네 배출표(`trash_schedules`)에 오늘 요일이 있으면 **그날 0시(자정, 한국 시간)** 에 하루 한 번 `{ title: "오늘은 쓰레기 배출일이에요", body: "생활쓰레기 · 음식물 · 18:00부터 · 내 집 혹은 내 점포 앞" }`. 알림을 끄면(`notiOn: false`) 안 만들고, 서버가 0시에 꺼져 있었으면 켜진 뒤 그날 안에 만들어요(`notifyAt`은 그날 0시). 장소가 여러 곳인 군 지역은 장소 대신 "배출장소는 사는 곳마다 달라요". `link`는 없어요. 배출표가 아예 없는 시군구(13곳)면 `{ title: "우리 동네는 쓰레기 배출 정보가 없어요" }` 안내를 (회원, 동네)마다 **한 번만** 보내고 그 뒤로는 보내지 않아요(지워도 다시 안 옴, `refId` = 동네 번호).
- `EVENT`(일정 알림): 목록 조회 시 오늘부터 3일 뒤까지의 일정과 기념일을 동기화해요. 일정 3일 전 오전 9시부터 표시하고 `calendar:YYYY-MM-DD` 링크로 해당 날짜를 열어요. 일정이 바뀌면 안 읽은 알림을 갱신하거나 정리해요.
- `RENT`(월세 납부 안내)는 스케줄러가 계약 기간 안의 이번 달 `rent_payments` 미납 기록을 확인해 납부 3일 전부터 당일까지 한 번 저장해요. 가계부의 저장된 시간대(없으면 한국 시간)로 날짜를 판단해요. `refId`는 납부 대상 연월(`YYYYMM`)이고 알림을 누르면 그 달의 가계부 고정 지출을 열어요. 기존 `budget:YYYY-MM-DD` 링크도 같은 달의 발송 이력으로 봐요. 월세를 납부하면 해당 월의 안 읽은 알림은 목록에서 숨겨요.
- `read`는 `read_at`이 있으면 `true`. `unreadCount`가 메뉴·종의 빨간 점이 돼요.
- 알림 화면은 **안 읽음 / 읽음**으로 나눠 보고(`status`), "모두 읽음"은 `ids: []`, 읽은 알림은 골라서 **삭제**해요. 지운 알림은 다시 안 나와야 해요 (줄을 지우거나 `deleted_at`을 두고 목록에서 빼기).
- 설정에서 알림을 끄면(`notiOn: false`) 만들지 않거나 빈 목록을 주세요.
- 모의 모드에서 계산하는 일정·월세 알림의 읽음과 삭제는 `zip-life`에 저장해요. 서버 모드에서는 위 API를 사용해요.
- 공지 알림: 관리자가 공지를 올릴 때 `notify: true` 면 `SYSTEM`, `link: notice`, `refId` = 공지 번호 (14장).
- **홈 알림 칸**: 메모 옆에 알림이 세로로 쌓여요(넓은 화면 4개 · 좁은 화면 3개, 나머지는 "+N개 더 있어요"). "닫기"는 **그날 하루만 숨김**이라 브라우저에만 저장해요(`zip-home-noti-closed`, "닫은 알림 다시 보기"로 되살림). 읽음 처리와는 달라서 서버 API는 필요 없어요.

---

## 7. 커뮤니티 · 첨부 · 신고 ✅

> **2026-11-15 백엔드 구현 · 프론트 연결 (회원 기능)**: 아래 표의 API가 모두 있어요. 서버 모드(`VITE_USE_MOCK=false`)에서 동네생활 화면 · 글 상세 · 글쓰기 · 홈 꿀팁이 서버를 써요. 응답에는 표의 모양에 `reported`(내가 신고했는지) · `homeTip` 이 더 있어요. 첨부는 사진(JPEG · PNG)만, 쓰기는 동네가 있어야 해요(403 `REGION_REQUIRED`). 관리자 화면의 게시글 관리 · 신고 관리(삭제 · 운영자 댓글 · 홈 꿀팁 지정 · 신고 처리)도 서버 모드에서 `/api/admin/**` 를 써요(11장). 회원 관리 · 경고 · 정지는 아직 브라우저 기록이에요. 자세한 서버 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#커뮤니티).

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/posts?scope=here\|near\|all&category=TIP&q=&page=0` | — | `{ items: [post], hasNext }` |
| GET | `/api/posts/my-count` | — | `{ count }` (로그인한 회원의 전체 공개 게시글 수) |
| GET | `/api/posts/popular` | — | `[post]` (내 동네 공개 글, 조회 수순 최대 3개) |
| GET | `/api/posts/neighbors` | — | `{ region: { id, name, sido } \| null, neighbors: [{ id, name, sido }] }` — "주변 동네" 탭 안내. 내 동네(`users.region_id`, 주거 설문 · 내 정보 주소로 정해짐)와 이웃 동네(`region_neighbors`, 같은 시 · 도 먼저 · 이름 순). `scope=near` 글 목록과 같은 기준. 동네가 없으면 `region: null` |
| POST | `/api/posts/{id}/views` | — | 204 (공개 글 상세를 열 때 조회 수 1 증가) |
| GET | `/api/posts/home-tips` | — | `[post]` (기존 관리자 지정 글 API) |
| GET | `/api/posts/{id}` | — | `post` (댓글 포함) |
| POST | `/api/posts` | `{ category, title, body, attachmentIds }` | `post` |
| PATCH | `/api/posts/{id}` | `{ category, title, body, attachmentIds }` | `post` (내 글만) |
| DELETE | `/api/posts/{id}` | — | — (내 글만, `status = DELETED`) |
| PUT · DELETE | `/api/posts/{id}/like` | — | `{ liked, likes }` |
| POST | `/api/posts/{id}/comments` | `{ body, parentId? }` | `comment` (`parentId` = 답글. 한 단계만: 답글에 단 답글은 그 묶음의 맨 위 댓글로. 응답 · 상세의 댓글에도 `parentId`) |
| PATCH | `/api/comments/{id}` | `{ body }` | `comment` (내 댓글만) |
| DELETE | `/api/comments/{id}` | — | — (내 댓글만) |
| POST | `/api/files` | `multipart/form-data` (`file`) | `{ id, name, type, size, url }` |
| POST | `/api/reports` | `{ targetType, targetId, reason, detail }` | — |

```json
{ "id": "10", "region": { "id": "2", "name": "마포구" }, "category": "TIP",
  "title": "곰팡이 제거 꿀팁", "body": "…", "author": { "id": "3", "nickname": "청소고수" }, "mine": false,
  "createdAt": "2026-10-20T21:10:00+09:00", "updatedAt": "2026-10-20T21:10:00+09:00",
  "likes": 12, "liked": true, "commentCount": 1, "views": 24,
  "attachments": [{ "id": "40", "name": "before.jpg", "type": "image/jpeg", "size": 183000, "url": "https://…" }],
  "comments": [{ "id": "8", "author": { "id": "1", "nickname": "지기" }, "body": "감사해요!", "mine": true, "createdAt": "…" }] }
```
- `scope`: `here`(우리 동네) · `near`(주변 동네, `region_neighbors` — 육지 경계가 맞닿은 시 · 군 · 구, 전국) · `all`(전체). 동네는 글쓴이의 `users.region_id`.
- `category`: `FREE` 자유 · `TIP` 꿀팁 · `QUESTION` 질문 · `TOWN` 동네 (프론트는 한글 이름으로 보여요)
- `mine`: 토큰의 사용자가 쓴 글·댓글이면 `true` → 수정·삭제 버튼이 보여요. `liked`도 토큰 기준.
- 숨김(`HIDDEN`)·삭제(`DELETED`) 글과 댓글은 목록에 넣지 마세요. `like_count`·`comment_count`는 서버가 맞춰 주세요.
- **첨부**: 파일을 먼저 `POST /api/files`로 올리고 받은 `id`를 글 저장 때 `attachmentIds`로 보내요 (`uploaded_files` + `post_attachments`, 순서 = 배열 순서).
  - 최대 5개 · 합계 2MB · **사진(JPEG · PNG)만** · 내가 올린 파일만 붙일 수 있게 서버에서 검사. 문서(PDF 등)는 악성 파일 · 개인정보 노출 위험이 있어 받지 않기로 했어요(2026-11-15).
  - 수정할 때 `attachmentIds`에서 빠진 파일은 연결을 끊고 지워 주세요.
  - 브라우저 저장 모드도 같은 규칙(사진만)이에요. 브라우저 모드는 첨부를 data URL로 저장하고(`Attachment { name, type, size, data }`), 서버 모드는 `/api/files/content/…` 주소를 써요.
- **신고**: `targetType` `POST` · `COMMENT`, `reason` `ABUSE` · `FALSE_INFO` · `PRIVACY` · `AD_ILLEGAL` · `COPYRIGHT` · `OTHER` (`reports`).
  - COMMENT targetId는 **comments.id**예요. 현재 브라우저의 postId/commentIndex를 서버 ID로 그대로 사용할 수 없어요. 서버 연결 때 안정적인 댓글 ID로 전환해야 해요.
  - DB UNIQUE(reporter_id,target_type,target_id)는 기각/숨김 처리 후에도 같은 회원의 재신고를 막아요. target_author_snapshot/target_text_snapshot은 서버가 실제 대상에서 복사하고 클라이언트 값을 신뢰하지 않아요.
  - 화면: 남의 글은 작성자 줄, 남의 댓글은 오른쪽의 **[신고]** → 사유 하나 + 자세한 내용(기타는 필수, 200자) → 접수 후 "신고됨". 같은 사람이 같은 대상을 두 번 신고하면 409로 막아 주세요.
  - 지금 프론트는 브라우저 `zip-reports`에 저장하고(`features/community/reports.ts`), 관리자 화면 게시글 관리에 "신고 N" 배지 · "신고된 글만" · 신고 내역이 보여요.
- 정지된 회원은 글쓰기 · 댓글 · 좋아요가 403이어야 해요.
- [동네 인증](#동네-인증)을 안 했거나 30일이 지난 회원도 글쓰기 · 댓글 · 좋아요가 403이어야 해요 (읽기는 누구나).
- 프론트 대응: `features/community/types.ts` (지금은 댓글에 `id`가 없어 순서로 고쳐요. 서버가 생기면 `id`로 바꿔요)

---

## 8. AI ✅

> **현재 서버**: 대화 목록 · 만들기 · 메시지 · 삭제와 `POST /api/ai/conversations/{id}/exchanges`(답변 기록), 고지서 사진(`/bill-photo`, 4-1 참고)이 있어요. `GET /api/ai/topics` 는 만들지 않았고 분야 목록은 프론트 `features/ai/topics.ts` 에 있어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/ai/topics` | — | `[{ code, name, description, photoSupported }]` |
| GET | `/api/ai/conversations?entryPoint=HOME_MODAL` | — | `[{ id, title, topic, updatedAt }]` |
| POST | `/api/ai/conversations` | `{ entryPoint, topic }` | `{ id }` ("새 대화") |
| GET | `/api/ai/conversations/{id}/messages` | — | `[message]` |
| POST | `/api/ai/conversations/{id}/messages` | `{ text }` 또는 `multipart` (`text` + `photo`) | `{ user: message, reply: message }` |
| DELETE | `/api/ai/conversations/{id}` | — | — |
> ✅ **AI 대화는 서버에 구현돼 있어요** (Gemini, DB `ai_conversations` · `ai_messages` · `ai_usage_daily`). 아래 주소가 동작해요.
>
> | 주소 | 하는 일 |
> |---|---|
> | `GET /api/ai/conversations?entryPoint=` | 내 대화방 목록(최근 20개, 새것 먼저) |
> | `POST /api/ai/conversations` `{ entryPoint, topic? }` | 새 대화방 → `{ id }` (201) |
> | `GET /api/ai/conversations/{id}/messages` | 대화방의 말풍선 `[{ id, role, text, createdAt, card? }]` |
> | `POST /api/ai/conversations/{id}/messages` `{ text, topic? }` | **AI 에게 질문** → `{ user, reply }`. 지난 대화는 서버가 DB에서 읽어 함께 보냄 |
> | `POST /api/ai/conversations/{id}/exchanges` `{ text, reply, card? }` | 앱이 직접 답한 질문·답(정해진 분야·지출 요약 카드·데모 답변)을 저장. AI 호출·하루 한도 없음 |
> | `DELETE /api/ai/conversations/{id}` · `DELETE /api/ai/conversations` | 대화방 하나 / 내 대화 전부(데이터 초기화) 삭제 → 204 |
>
> - 다른 사람의 대화방은 모두 404예요. 회원 탈퇴 시 대화도 함께 지워져요(FK CASCADE).
> - 질문 1번마다 `ai_usage_daily`가 +1 (하루 기본 30번, 넘으면 429 `AI_LIMIT`). AI 호출이 실패하면(502 `AI_FAILED`) 아무것도 저장하지 않고 횟수도 되돌려요. 키가 없으면 503 `AI_DISABLED`.
> - Gemini의 사용량 제한 응답(429)은 503 `AI_QUOTA`로 안내하고 질문 횟수를 되돌려요. `/ai`의 ‘사용 방법’에서 전체 기능 안내를 분류별로 볼 수 있어요. 고객센터 문의 방법도 바로 확인할 수 있어요. 각 안내는 브라우저에서 표시하고, ‘질문 다시 보내기’를 누르면 같은 대화방에 원래 질문을 다시 보내요.
> - 제목(`title`)은 첫 질문 30자. 대화방 하나에 말풍선 400개까지. 사진은 저장하지 않아요(`attachment_id`는 비워 둠).
> - 프론트: 홈 "AI와 대화"는 열 때 최근 대화를 불러와 이어가고 "새 대화"는 새 대화방을 만들어요. AI 화면은 화면을 열 때마다 새 대화방을 만들어요(이전 대화 복원은 아직 없음). 가짜 API 모드이거나 서버를 쓸 수 없으면 예전처럼 이 브라우저에서만 대화해요.
> - 키는 `secrets/gemini.properties`의 `GEMINI_API_KEY`, 모델은 `GEMINI_MODEL`(기본 `gemini-3.1-flash-lite`).


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

## 9. 지도 ✅

동네 화면 (네이버 지도처럼): 움직이는 지도(Leaflet + OpenStreetMap)에 장소 핀 · 🏠 우리 집, 장소 목록(가까운 순 · 24시간 · 저렴한 · 조용한), 장소 상세(저장 · 길찾기 · 큰 지도), **검색 = 장소 이름 + AI 장소 찾기**, **★ 저장(즐겨찾기)**, **종류 편집**(켜기·끄기, 직접 검색어 추가).
- 모바일: 화면 가득 지도 + 위 검색창 · 종류 칩 + 아래 끌어올리는 목록 시트 / PC: 왼쪽 목록 칸 + 오른쪽 지도

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/places/categories` | — | `[{ id, name, icon }]` (15종류 + 검색용 `기타`) |
| GET | `/api/places?regionId=2&category=세탁방&lat=37.5496&lon=126.9137` | — | `[place]` (가까운 순. `lat` · `lon` = 지도 중심, 생략하면 우리 집) |
| GET | `/api/places?regionId=2&q=빵집` | — | `[place]` (직접 추가한 검색어 칩: 이름 · 설명 · 종류에 글자 포함. 검색창은 `&wide=true` — 가게 이름 · 유명한 곳까지, 이름이 맞는 곳부터) |
| POST | `/api/places/ai-search` | `{ q: "밤에 갈 수 있는 약국", regionId }` | `[{ place, reasons: ["약국", "24시간·심야 운영"], walkMin }]` (최대 5곳) |
| GET | `/api/places/reviews/mine` | — | `[{ id, placeId, placeName, rating, body, createdAt }]` 로그인한 회원의 DB·카카오 장소 리뷰 통합 목록, 최신순. 마이페이지 내 정보의 내가 쓴 리뷰에서 장소 리뷰로 연결 |
| GET | `/api/places/{id}/reviews` | — | `[{ id, rating, body, photos: [{ id, url }], author: { id, nickname, avatarUrl, avatarEmoji, avatarColor, reviewCount, ratingAvg }, createdAt, reportedByMe }]` 최신순 (장소 상세 아래 리뷰). id = DB 장소 `12` 또는 카카오 장소 `kakao:123` |
| POST | `/api/places/{id}/reviews` | `{ rating(1~5), body(300자, 선택), name(카카오 장소만, 60자), photoIds(선택, 5장까지 — 먼저 `POST /api/files` 로 올린 내 사진) }` | — (한 사람당 한 장소 하나, 두 번이면 409. 카카오 장소는 `name` 없으면 400) |
| PUT | `/api/places/{id}/reviews/mine` | `{ rating, body, photoIds }` | — 내 리뷰 고치기 (빠진 사진은 서버가 지움, 없으면 404) |
| DELETE | `/api/places/{id}/reviews/mine` | — | — 내 리뷰 지우기 (없으면 404) |
| POST | `/api/places/{id}/reviews/{reviewId}/reports` | `{ reason, detail }` (사유는 커뮤니티 신고와 같음) | — 남의 리뷰 신고 (내 리뷰 400 · 같은 리뷰 두 번 409) |
| GET | `/api/places/review-summary?ids=12,kakao:123` | — | `[{ id, rating, count }]` 지도 목록 별점 (100곳까지, 리뷰 없는 곳은 빠짐) |
| GET | `/api/admin/place-review-reports?status=` | — | 관리자 리뷰 신고 목록 `[{ id, reviewKind, reviewId, placeId, placeName, review: { author, text, rating, deleted }, reason, detail, reporter, status, createdAt }]` |
| PATCH | `/api/admin/place-review-reports/{id}` | `{ status: HIDDEN \| DISMISSED }` | — HIDDEN = 리뷰 삭제 + 쓴 사람 알림, DISMISSED = 문제없음 (그 리뷰의 접수 중 신고 전부) |
| GET | `/api/me/place-favorites` | — | `[placeId]` (DB 장소는 번호, 카카오 장소는 `"kakao:카카오장소id"`) |
| PUT · DELETE | `/api/me/place-favorites/{placeId}` | 카카오 장소만 `{ name, category }` | — (★ 누르기 · 풀기) |
| GET | `/api/me/place-favorites/kakao` | — | `[{ id: "kakao:…", name, category }]` (저장 목록에 보일 이름 · 종류) |
| GET | `/api/me/place-lists` | — | `[{ id, name, color, placeIds }]` (★ 저장 창의 내 리스트. 처음이면 "내 장소"를 만들고 리스트에 안 든 저장 장소를 넣어 줌) |
| POST | `/api/me/place-lists` | `{ name, color }` (20자 · `#RRGGBB`) | `{ id, name, color, placeIds: [] }` (같은 이름 409, 20개까지) |
| PATCH · DELETE | `/api/me/place-lists/{id}` | `{ name, color }` | — (삭제하면 이 리스트에만 있던 장소는 저장도 풀림) |
| PUT | `/api/me/place-favorites/{placeId}/lists` | `{ listIds, name?, category? }` | — (★ 저장 창의 [저장]: 고른 리스트들에 넣음, 비우면 저장 풂. 처음 저장하는 카카오 장소는 name · category 필요) |
| GET · PUT | `/api/me/map-settings` | `{ categories: ["세탁방", …], keywords: ["빵집"] }` | 같은 모양 (칩에 보일 종류 · 직접 추가한 검색어) |

```json
{ "id": "3", "category": "세탁방", "name": "코인빨래방 합정점", "description": "도보 약 3분 · 24시간",
  "lat": 37.5496, "lon": 126.9137, "walkMin": 3, "address": null, "phone": null, "openHours": "24시간", "rating": 4.5, "reviewCount": 12 }
```
- **종류 15개**: 세탁방 · 편의점 · 약국 · 마트 · 카페 · 병원 · 헬스장 · 은행 · 미용실 · 다이소 · 공원 · 식당 · 반찬가게 · 세탁소 · 주민센터. 처음 칩에는 앞의 4개만 보여요.
  - DB place_categories 기본 데이터에 15개 모두 반영돼 있어요. 여기에 `기타`(📍, 정렬 99)가 있어요: 검색어로 찾은 장소 중 15종류에 안 맞는 곳을 담고, 칩 · 종류 편집에는 보이지 않아요.
- **카카오 로컬 API (2026-11-15 변경)**: 서버에 `KAKAO_REST_KEY`가 있으면 `category` · `q` 검색은 서버가 카카오에서 지도 중심 근처를 찾아 **저장하지 않고 그대로** 줘요. 카카오 장소의 `id`는 `kakao:카카오장소id`예요(카카오 운영 정책: 장소 정보 장기 저장 제한). **즐겨찾기는 카카오 장소 id와 표시용 이름 · 종류만** `kakao_place_favorites`에 저장하고 주소 · 좌표는 저장하지 않아요(한 사람당 200곳). 그래서 저장 탭에서 지금 검색 결과에 없는 카카오 장소는 지도 핀 없이 목록으로 보이고, 누르면 카카오맵 장소 페이지가 열려요. 리뷰는 카카오 장소 id · 이름과 함께 `kakao_place_reviews` 에 따로 저장해요(주소 · 좌표 없음). 화면에 "장소 검색 © Kakao"를 표시해요. 무료 쿼터 보호: 같은 검색 10분 캐시, 사람당 1분 30번, 서버 하루 30000번(설정으로 변경). 한도 · 실패면 DB 장소만 주고 응답 헤더 `X-Place-Notice`(`user-limit` · `daily-limit` · `error`)로 알려 주면 프론트가 안내 문구를 띄워요. 종류 칩 · 검색어 칩은 반경 1km, 검색창(`wide=true`)은 반경 5km + 거리 제한 없는 정확도 검색을 합쳐 이름이 같은 곳 → 이름에 든 곳 순이에요. 15종류에 안 맞는 검색 결과는 `기타`예요. 분류 코드가 있는 종류(편의점 CS2 · 약국 PM9 · 마트 MT1 · 카페 CE7 · 병원 HP8 · 은행 BK9 · 식당 FD6)는 코드로, 나머지는 키워드(세탁방 → "빨래방" 등)로 찾아요. 키가 없거나 실패하면 DB 장소만. 카카오는 영업시간을 주지 않아 `openHours`는 비어 있고, 24시간 · 저렴 · 조용 조건은 설명 글자로만 걸러요. 장기적으로는 공공데이터(소상공인 상가정보)를 우리 DB에 적재해 외부 호출을 줄이는 방안을 검토해요.
- **AI 장소 찾기**: 지금은 프론트가 예시 데이터 안에서 말을 읽어 골라요 (`features/map/aiFind.ts` — "빨래·이불 → 세탁방", "밤·24 → 24시간 운영 가산점" 같은 규칙). 서버가 생기면 AI + 지도 검색 API(예: 카카오 로컬)로 바꾸고, 화면에 보일 **추천 이유**(`reasons`)를 같이 주세요.
- **도보 시간**: 프론트는 설명의 "도보 약 N분"을 읽어 써요. 서버는 `walkMin`(우리 집 기준)을 따로 주면 좋아요.
- **우리 집 위치 (🏠, "우리 집으로" 버튼, 길찾기 출발점)**: 지금은 예시 좌표(`HOME`, `features/map/data/places.ts`)예요. 서버가 생기면 `GET /api/auth/me`의 주소를 좌표로 바꿔 `home: { lat, lon }`으로 같이 주세요 (users.home_lat/home_lon). home은 현재 User 타입에 없는 확장 제안이에요. 인증 GPS·설문 중심점은 집 위치와 구분하고 덮어쓰지 마세요.
- **조건 칩**(24시간 · 저렴한 · 조용한)은 지금 설명 글자로 걸러요. 서버는 `openHours` · 태그로 걸러 주면 더 정확해요 (`GET /api/places?…&filter=24h|cheap|quiet`).
- **길찾기 · 큰 지도**는 카카오맵 링크를 새 창으로 열어요 (서버 필요 없음). 길찾기는 `map.kakao.com/link/to/…`(출발지는 카카오맵에서 현재 위치 등으로), 카카오 장소의 상세 버튼은 "영업시간 · 사진"으로 `place.map.kakao.com/{id}`(영업시간 · 사진 · 후기)를 열고, DB 장소는 `map.kakao.com/link/map/이름,lat,lon`을 열어요.
- **홈 "내 주변 지도" 카드**: 브라우저 위치(Geolocation)로 현재 위치 주변을 보여 줘요(파란 점, ◎ 내 위치 버튼). 위치를 못 받으면 예시 좌표(`HOME`)로 보여 줘요. 서버 필요 없고, 카드를 누르면 `/map`으로 가며 `state.mapCenter`로 그 위치를 넘겨요. 장소 핀은 예시 데이터예요.
- **홈 날씨 카드**: 프론트가 Open-Meteo(날씨) · Nominatim(주소 → 좌표)을 직접 불러요. 서버 API 없음.
- **즐겨찾기 번호**: 지금은 `"종류:이름"`을 써요. 서버가 생기면 `places.id`로 바꿔요. DB는 place_favorites에 저장해요.
- 프론트 대응: `Place { n: name, d: description, lat, lon }` (`features/map/data/places.ts`), 지도 설정 저장 `zip-map` (`features/map/store.ts`)

---

## 10. 약관 ✅

> 이용약관 · 개인정보 처리방침 화면과 가입 화면의 상세보기는 공개 API `GET /api/terms`에서 시행 중인 약관을 보여 줘요. 서버 본문은 빈 줄로 조항을 나누고 조항 첫 줄을 제목으로 사용해요(`features/legal/api.ts`의 `toLegalDoc`). 불러오는 중 · 실패 · 목업 모드에서는 `content.ts`의 문구를 보여 줘요. 가입 동의는 배포된 `LEGAL_VERSION`을 `termsVersion`으로 보내므로 DB 시행 버전과 함께 갱신해요.
> 약관 문구를 고칠 때는 `content.ts` 를 고친 뒤 `node db/tools/terms-sync.cjs <새 마이그레이션 이름>` 으로 `schema.sql` · 기존 DB 를 맞춰요. `frontend/tests/legal-terms.test.mjs` 가 두 쪽이 같은지 확인해요.

| 메서드 | 주소 | 받는 값 |
|---|---|---|
| GET | `/api/terms` | `[{ docType, version, title, content, consentKind, required }]` (지금 시행 중인 것) |

- 약관 본문은 지금 프론트의 `src/features/legal/content.ts`에 있고, DB `terms_documents`에도 **같은 본문 · 버전(`2026-10-18`)**이 들어 있어요.
- 약관을 고칠 땐 **프론트 `LEGAL_VERSION`과 DB에 새 버전 줄을 같이** 추가해 주세요. 이전 버전 동의 기록은 지우지 않아요.

---

## 11. 관리자 · 이용 정지 ✅

> **2026-11-15 백엔드 구현 · 프론트 연결**: 아래 API가 모두 있어요(`stats` · `members` · `sanctions` · `bulk` · 정지 해제 · 게시글 · 신고). 서버 모드에서 관리자 화면의 회원 관리 · 신고 관리 · 게시글 관리, 회원 화면의 경고 안내 창 · 받은 경고/정지 내역 · 쓰는 중 정지(403 `SUSPENDED` → 안내 후 로그아웃)가 서버를 써요. 추가: `GET /api/me/sanctions`, `POST /api/me/warnings/seen`. 자세한 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#회원-관리--경고--정지).

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
| DELETE | `/api/admin/posts/{id}?reason=` · `/api/admin/comments/{id}?reason=` | — (사유는 쿼리로, 200자. `delete_reason` 에 저장) | — |
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
- 정지 중이면: 로그인 · 글쓰기 · 댓글 · 좋아요 막기, 재가입은 막지 않아요(`banned_identities` 표 삭제).
  - 탈퇴 시 user_sanctions는 함께 삭제돼요.
- **현재 브라우저 가짜 API의 화면**: 정지된 계정은 앱 대신 **이용 정지 안내(`/suspended`)**만 보고(정지 기간 · 사유 · 횟수 · 문의하기 · 로그아웃), 아직 확인 안 한 **경고**가 있으면 앱에 들어올 때 **경고 안내 창**(사유 · 누적 경고)이 한 번 떠요.
  - 예시 보기: `/suspended?demo`, 아무 화면 주소 뒤 `?demo=warn`
  - 서버가 생기면 `GET /api/auth/me`의 `user`에 `suspension: { until, permanent, reason, count } | null`, `warnCount`, `unseenWarnings: [{ id, reason, at }]`를 같이 주세요.
  - 정지 중인 사람의 다른 API 요청은 **403** + `{ "message": "이용이 정지된 계정이에요. …", "code": "SUSPENDED" }`로 주는 것을 제안해요. **현재 apiClient는 401만 공통 처리**하므로 403/code 기반 정지 화면 이동은 프론트 연동 때 추가해야 해요.
  - 경고 창에서 "확인했어요"를 누르면 `POST /api/me/warnings/seen { ids }`로 알려 줄게요 (DB: `user_sanctions.seen_at`에 반영).
- 글 · 댓글 삭제는 `status = DELETED` + 작성자에게 경고/정지를 같이 걸 수 있어요 (위 `sanctions` API를 이어서 호출).
- 지금은 가짜 API와 `src/features/moderation`이 브라우저(`zipban-records`)에서 이 규칙을 흉내 내요.

---

## 12. 메모 ✅

> **2026-11-19 백엔드 구현 · 프론트 연결**: 아래 API와 홈 메모 순서 API가 모두 있어요. 서버 모드에서는 `features/memo/sync.ts`가 들어올 때 서버 메모를 받고, 고친 것을 0.5초 모았다가 저장해요(화면은 그대로 `useMemoStore`). 자세한 서버 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#메모).

마이페이지 **"메모" 탭(`/my/memo`, 메모장)**과 **홈 메모 위젯**이 써요. React 화면이 다 있고(`features/memo`), 지금은 브라우저(`zip-memos`)에 저장해요.

- 메모장: 왼쪽 목록(고정 먼저 → 최근 수정 순, 검색) | 오른쪽 쓰기. 제목 · 글, 또는 **체크리스트**(줄마다 체크, Enter로 다음 줄), **📌 고정**, **색 6가지**, 삭제(확인 창). 쓰는 대로 자동 저장.
- 홈 위젯: **고른 메모 최대 3개를 쪽지로** 나란히 + **빠른 메모**(한 줄 적고 Enter → 새 메모). 체크리스트 쪽지는 **위젯에서 바로 체크** → `PATCH`로 `items` 전체를 보내요.
  - "메모 고르기"에서 체크한 순서대로 보여요. 안 고르면 자동(고정 → 최근 수정 순 3개). 쪽지를 꾹 눌러 끌면 자리가 바뀌어요.
  - 홈에 보일 메모 · 순서: `GET · PUT /api/me/home-memos` → `{ ids: ["5", "9"] }`, `{ ids: null }` = 자동. DB user_settings.home_memo_ids에 반영돼 있어요. 최대 3개, 본인 메모인지 서버가 검사해요.
- 홈에서 메모를 누르면 `/my/memo?id=5`로 그 메모를 열어요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/memos?q=` | — | `[memo]` (고정 먼저, 그다음 최근 수정 순) |
| POST | `/api/memos` | `{ title, body, color, pinned, checklist, items, folderId }` (전부 선택) | `201`과 `memo` |
| PATCH | `/api/memos/{id}` | 바꾼 칸만 (`items`는 배열 통째로), 가계부 초안 확정은 `complete: true` | `200`과 `memo` |
| DELETE | `/api/memos/{id}` | — | — |
| POST | `/api/memos/ledger-draft` | `{ kind, label, key, incomeType?, memoId? }` | `200`과 `{ id }` |
| DELETE | `/api/memos/ledger-draft/{key}` | — | `204`, 본인의 거래에 연결하기 전인 메모만 폐기 |
| GET | `/api/memo-folders` | — | `[{ id, name }]` 본인 폴더만 |
| POST | `/api/memo-folders` | `{ name }` 1~40자, 회원당 100개, 중복 이름 불가 | `{ id, name }` |
| PATCH | `/api/memo-folders/{id}` | `{ name }` | `{ id, name }` |
| DELETE | `/api/memo-folders/{id}` | — | 204, 메모는 미분류로 보존 |

메모 응답의 `folderId`는 문자열 또는 null(미분류)입니다. PATCH에서 생략/null은 기존 폴더 유지, 빈 문자열 `""`은 미분류로 이동합니다. 폴더별 개수·전체·고정·미분류 조회와 폴더 선택은 기존 메모 목록을 기준으로 표시하며 가계부 연결은 유지합니다. DB 변경: `db/migrations/20261122_06_memo_folders.sql`.

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

## 13. 고객센터 ✅

마이페이지 > 내 정보 > 고객센터(`/my/settings/support`): 자주 묻는 질문 · 1대1 문의 · 내 문의 내역. 관리자는 `/admin`에서 문의에 답변해요.

> **2026-11-19 백엔드 구현 · 프론트 연결**: 아래 API가 모두 있어요. 서버 모드(`VITE_USE_MOCK=false`)에서 고객센터 화면과 관리자 "문의 관리" 탭이 서버를 써요 (`features/support/api.ts`). 자세한 서버 규칙은 [backend/IMPLEMENTATION.md](../backend/IMPLEMENTATION.md#고객센터).

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/support/inquiries` | — | `[inquiry]` (내 문의, 최근 것부터) |
| POST | `/api/support/inquiries` | `{ category, title, content }` | 201 `inquiry` (하루 20개까지, 넘으면 429) |
| GET | `/api/admin/support/inquiries` | — | `[inquiry]` (관리자만, 전체 · 답변 대기부터) |
| POST | `/api/admin/support/inquiries/{id}/answer` | `{ content }` | `inquiry` (관리자만, 문의당 답변 하나 — 이미 있으면 409) |

```json
{ "id": "5", "userId": "2", "nickname": "지은", "category": "이용 문의", "title": "일정이 안 보여요", "content": "…", "createdAt": "2026-10-31T09:00:00Z", "answer": { "content": "…", "createdAt": "2026-10-31T11:00:00Z" } }
```
- `category`: 이용 문의 · 오류 신고 · 개선 제안 · 계정 문의 · 기타. 제목 100자, 내용 · 답변 3,000자 이내.
- 내 문의만 보이고 답변은 관리자만 쓸 수 있게 **서버에서 권한을 확인**해요. 가짜 API 모드는 지금처럼 브라우저 `zip-support`에 저장해요.
- DB: `support_inquiries` (`answer_content` · `answered_by` · `answered_at`, 답변 대기 = `answered_at IS NULL`).
- 프론트 대응: `Inquiry` (`features/support/store.ts`)

---

## 14. 공지사항 ✅

> **2026-11-21 백엔드 구현 · 프론트 연결**: 회원은 내 정보 → 고객센터 → **공지사항**(`/my/settings/notices`), 관리자는 관리자 화면 **공지 관리** 탭에서 써요. 목업 모드는 이 브라우저(`zip-notices`)에 저장해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/notices` | — | `[notice]` (고정 먼저, 새 것부터, 최대 100개, `body` 없음) |
| GET | `/api/notices/popups` | — | `[notice]` 앱을 열면 띄울 팝업 공지 (`body` 포함, 새 것부터 최대 5개) |
| GET | `/api/notices/{id}` | — | `notice` (`body` 포함). 없으면 404 |
| POST | `/api/admin/notices` | `{ title, body, pinned, popup, notify }` | 201 `notice` (관리자만. `notify: true` 면 알림을 켠 일반 회원 모두에게 알림) |
| PATCH | `/api/admin/notices/{id}` | `{ title, body, pinned, popup }` | `notice` (관리자만) |
| DELETE | `/api/admin/notices/{id}` | — | 204 (관리자만) |

```json
{ "id": "3", "title": "11월 점검 안내", "body": "…", "pinned": true, "popup": false, "author": "운영자", "createdAt": "2026-11-21T02:00:00Z", "updatedAt": "2026-11-21T02:00:00Z" }
```
- 제목 1~100자, 내용 1~5,000자(앞뒤 공백 제거). 비면 · 넘으면 400.
- **팝업**(`popup: true`): 회원이 앱을 열면 모달로 떠요. 아래 **일주일 동안 보지 않기**(이 브라우저에 회원별로 7일 기억)와 **닫기**(이번 방문만, 다음에 앱을 열면 다시 뜸)가 있어요. 여러 개면 새 것부터 하나씩. 관리자가 팝업을 끄면 더는 안 떠요.
- 로그인 회원만 볼 수 있어요(비로그인 401). 일반 회원이 `/api/admin/notices` 를 부르면 403.

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
| 정지·경고 | user_sanctions.seen_at/revoked_at |
| 알림·지원·AI | notifications.deleted_at, support_inquiries, ai_topics.guide, ai_messages.LINK |

- 본인 확인은 이메일 인증만 써요(`password_resets.method = EMAIL`). 휴대전화 인증은 없앴어요.
- 첨부 MIME·5개/2MB, 소유권, JSON 내부 원소, 관리자 역할, 동네 인증 유효기간은 서버가 검사해요.
- DB 구조 감사는 54테이블 + VIEW 2개 (세부 수치는 `db/tests/schema_expected.json`) 기준이에요. API 구현이나 권한 테스트 통과를 뜻하지 않아요.

## 브라우저 저장 (localStorage)

서버가 관리하는 기록은 서버 모드(`VITE_USE_MOCK=false`)에서 API 응답을 기준으로 삼아요. 예를 들어 설정의 ‘내가 쓴 글’은 서버 모드에서 `GET /api/posts/my-count`로 조회하고, 모의 모드에서만 `zip-posts`를 집계해요. 일정·메모의 브라우저 캐시는 `lib/listSync.ts`로 서버와 동기화해요. 모드 설정과 개발·배포 기준은 [모의 API 사용 범위](README.md#모의-api-사용-범위)를 참고하세요.

| 저장 키 | 들어 있는 것 | 파일 | 서버 모드의 기준 |
|---|---|---|---|
| `zip-auth` | 로그인 토큰 · 내 정보 · 로그인한 시각 | `features/auth/store/authStore.ts` | 1번 |
| `zip-life` | 일정 · 월세 · 고정 지출 · 수입 · 지출 · 알림 읽음 · 지운 알림 · 동네 인증 · 설정 | `features/life/store.ts` | 2 ~ 6번 |
| `zip-posts` | 커뮤니티 글 · 댓글 · 좋아요 · 첨부 | `features/community/store.ts` | 7번 |
| `zip-ai-chat` | 홈 AI 대화 (최근 40개) | `features/ai/store.ts` | 8번 |
| `zip-map` | 지도 칩에 보일 종류 · 직접 검색어 · 즐겨찾기 | `features/map/store.ts` | 9번 |
| `zip-memos` | 메모 | `features/memo/store.ts` | 12번 |
| `zip-housing-survey` | 처음 로그인 설문 답변 | `features/onboarding/store.ts` | 2번 `/api/me/housing-onboarding` · `home-info` |
| `zip-loan-interest` | 회원별 대출 설정·월별 이자 기록 | `features/loan/store.ts` | 2번 `/api/me/home-info/loan` |
| `zip-ledger-categories` | 회원별 사용자 카테고리·표시 순서 | `features/life/ledgerCategories.ts` | 5번 `/api/me/ledger-categories` |
| `zip-reports` | 신고·처리 상태·신고 당시 내용 | `features/community/reports.ts` | 7번 신고 API |
| `zip-support` | 고객센터 문의 · 답변 | `features/support/store.ts` | 13번 |
| `zip-profile` | 프로필 사진 · 캐릭터 · 배경 색 · 한 줄 소개 | `features/profile/store.ts` | 1번 (프로필 꾸미기) |
| `zip-home-noti-closed` | 홈 알림 회전창에서 오늘 닫은 알림 | `features/life/components/HomePhotoCard.tsx` | (서버 필요 없음) |
| `zipban-records` · `zipban-warn-seen` | 정지 · 경고 기록, 확인한 경고 횟수 (데이터 초기화로 안 지워지게 `zip-`로 시작하지 않음) | `features/moderation` | 11번 |

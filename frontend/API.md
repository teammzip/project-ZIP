# 백엔드 API 약속

프론트(React)와 백엔드가 주고받을 API를 정리한 문서예요. **DB는 [`../db/schema.sql`](../db/schema.sql)(2026-10-21 설계)이 기준**이고, 표마다 어느 API가 쓰는지 같이 적었어요.

- ✅ **프론트 코드 있음**: `src/features/auth/api/realAuthApi.ts`가 이미 이 주소로 요청해요. 백엔드만 만들면 바로 연결돼요.
- 📝 **약속만 있음**: 아직 프론트는 브라우저(localStorage)에 저장해요. 백엔드가 만들면 프론트가 이 모양대로 붙일게요.

| 영역 | 상태 | DB 표 |
|---|---|---|
| [인증 · 내 정보](#1-인증--내-정보) | ✅ | `users` `social_accounts` `auth_sessions` `phone_verifications` `password_resets` `user_term_agreements` `withdrawal_logs` |
| [설정 · 동네](#2-설정--동네) | 📝 | `user_settings` `regions` `region_neighbors` |
| [일정 · 쓰레기 배출](#3-일정--쓰레기-배출) | 📝 | `events` `trash_schedules` |
| [월세 · 공과금](#4-월세--공과금) | 📝 | `rent_payments` `bill_items` `bill_payments` |
| [가계부](#5-가계부-수입--기타-지출) | 📝 | `ledger_categories` `incomes` `expenses` + VIEW 2개 |
| [알림](#6-알림) | 📝 | `notifications` |
| [커뮤니티 · 첨부 · 신고](#7-커뮤니티--첨부--신고) | 📝 | `posts` `post_likes` `comments` `uploaded_files` `post_attachments` `reports` |
| [AI](#8-ai) | 📝 | `ai_topics` `ai_conversations` `ai_messages` `ai_usage_daily` |
| [지도](#9-지도) | 📝 | `places` `place_categories` `place_reviews` |
| [약관](#10-약관) | 📝 | `terms_documents` |
| [메모](#12-메모) | 📝 | `memos` (**DB에 아직 없음**) |
| [관리자 · 이용 정지](#11-관리자--이용-정지) | 📝 | `user_sanctions` `users.status` `reports` |

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
| ENUM 값 | API에서는 DB 값을 그대로 써요 (`TIP`, `GENERAL` …). `provider`만 예외로 소문자 (`email`, `kakao` …) |
| 실패 | `{ "message": "이미 가입된 이메일이에요." }` — 이 문장이 화면에 그대로 보여요 |
| 401 | 토큰이 없거나 만료되면 **401**. 프론트가 자동으로 로그아웃시켜요 |
| 403 | 권한이 없으면 **403** (일반 회원이 관리자 API, 정지된 회원이 글쓰기 등) |
| 목록 | 개수가 늘어나는 목록(글·알림·회원)은 `?page=0&size=20` → `{ items: [...], hasNext: true }` |
| 내 데이터만 | 일정·가계부 등 개인 데이터는 **토큰의 사용자 것만** 보이고 고칠 수 있어야 해요 (남의 id로 요청하면 404) |

---

## 1. 인증 · 내 정보 ✅

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

### user 모양
```json
{
  "id": "1", "username": "zipdemo", "email": "demo@zip.com", "nickname": "지기",
  "address": "서울시 마포구 합정동", "region": { "id": "2", "name": "마포구" },
  "provider": "email", "role": "USER", "status": "ACTIVE",
  "agreedAt": "2026-10-18T00:00:00+09:00"
}
```
| 키 | DB | 설명 |
|---|---|---|
| `username` | `users.login_id` | 소셜 가입자는 `null` |
| `region` | `users.region_id` → `regions` | 주소에서 구를 찾아 연결. 못 찾으면 `null` |
| `provider` | `users.signup_provider` | `EMAIL` → `email` 처럼 **소문자**로 |
| `role` | `users.role` | `ADMIN`은 로그인하면 관리자 화면(`/admin`)만 보여요 |
| `status` | `users.status` | 정지된 계정은 로그인이 막히니 보통 `ACTIVE` |
| `agreedAt` | `user_term_agreements.agreed_at` | 소셜로 처음 들어온 사람은 `null` → 프론트가 동의 화면(`/welcome`)을 띄워요 |

### 로그인
- `loginId`는 **아이디 또는 이메일** (`users.login_id` 또는 `users.email`로 찾기).
- `remember`(로그인 유지)가 `true`면 세션 만료를 길게 (`auth_sessions.remember`). 성공하면 `users.last_login_at` 갱신.
- 정지된 계정이면 403 + `{ "message": "이용이 정지된 계정이에요. (10/24 18:00 해제) 사유: …" }`.
- **재발급 토큰**(`auth_sessions.refresh_token_hash`)은 httpOnly 쿠키로 주는 걸 추천해요. 그때 `POST /api/auth/refresh` → `{ accessToken }`을 만들어 주시면 프론트가 401 대신 자동 재발급을 붙일게요. (지금 프론트는 401이면 로그아웃)

### 회원가입
```json
{ "username": "tester01", "password": "abcd123!", "nickname": "테스터",
  "phone": "010-1234-5678", "phoneVerificationToken": "…",
  "email": "t@zip.com", "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true,
  "termsVersion": "2026-10-18" }
```
- **입력 규칙** (`src/features/auth/schema.ts`와 같게 서버에서도 검사)
  - 아이디 6~16자 영문 소문자·숫자 / 비밀번호 8~16자 영문·숫자·특수문자 모두 / 닉네임 2~12자
  - 아이디 · 이메일 · 휴대전화는 겹치면 안 돼요 (`uk_users_*`)
- **저장할 곳**
  - `phone`은 숫자만 (`01012345678`), `phone_verified_at` = 인증 시각
  - `ageOver14` → `users.age_confirmed_at`
  - `agreeTerms` · `agreePrivacy` · `agreePolicy` → `termsVersion`의 `terms_documents` 3줄(SERVICE · PRIVACY · POLICY)을 `user_term_agreements`에 기록
  - 정지 기록이 있는 아이디 · 닉네임 · 휴대전화로는 가입을 막아 주세요 ([관리자](#11-관리자--이용-정지))

### 휴대전화 인증
- `purpose`: `SIGNUP` · `FIND_ID` · `RESET_PASSWORD` (`phone_verifications.purpose`)
- 흐름: `send` → 문자로 받은 6자리 입력 → `verify` → 받은 `verificationToken`을 가입·찾기 요청에 함께 보냄
- 인증번호는 3분, 틀린 횟수 제한(`attempt_count`), `verificationToken`은 **한 번만** 사용(`consumed_at`)
- 비밀번호 찾기: `password-reset/verify`로 `resetToken`을 받고(`password_resets.method = PHONE`), 같은 화면에서 `password-reset`으로 새 비밀번호 저장. 메일은 보내지 않아요.

### 소셜 로그인
1. 프론트가 `/api/oauth2/authorization/kakao`로 이동 → 백엔드가 소셜 로그인 처리 (`social_accounts`)
2. 끝나면 `/oauth/callback?token=<accessToken>`으로 돌려보내기 → 프론트가 `GET /api/auth/me` 호출
3. 처음 온 사람(`agreedAt: null`)은 동의 화면에서 `PATCH /api/auth/me`로 아래를 보내요
```json
{ "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true, "termsVersion": "2026-10-18" }
```

### 회원 탈퇴
- `users` 한 줄을 지우면 개인 데이터는 CASCADE로 같이 지워져요. `withdrawal_logs`에는 지워진 번호와 시각만 남겨요.
- 업로드한 파일의 실제 저장소 파일은 서버가 따로 지워 주세요.
- 이용 정지 기록은 탈퇴해도 남겨야 재가입을 막을 수 있어요 (아래 [11번](#11-관리자--이용-정지) 참고).

---

## 2. 설정 · 동네 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/me/settings` | — | `settings` |
| PUT | `/api/me/settings` | `settings` | `settings` |
| GET | `/api/regions` | — | `[{ id, name, parentId, level }]` |
| GET | `/api/regions/{id}/neighbors` | — | `[{ id, name }]` |

```json
{ "regionId": "2", "regionName": "서울 마포구",
  "rent": 55, "rentDay": 15, "moveIn": "2026-02", "contractEnd": "2027-02", "notiOn": true }
```
| 키 | DB | 프론트 (`LifeSettings`) |
|---|---|---|
| `regionId` · `regionName` | `users.region_id` | `region` ('서울 마포구') |
| `rent` | `user_settings.rent_amount` (**만원**) | `rent` |
| `rentDay` | `rent_day` (1~31) | `rentDay` |
| `moveIn` · `contractEnd` | `move_in_ym` · `contract_end_ym` | 같음 |
| `notiOn` | `noti_on` | 같음 |

- 닉네임은 설정이 아니라 `PATCH /api/auth/me`로 바꿔요.
- 가입하면 `user_settings` 기본 줄을 같이 만들어 주세요.

---

## 3. 일정 · 쓰레기 배출 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/events?from=2026-10-01&to=2026-10-31` | — | `[event]` |
| GET | `/api/events/search?q=월세` | — | `[event]` (상단 검색) |
| POST | `/api/events` | `{ date, time, title }` | `event` |
| PATCH | `/api/events/{id}` | `{ date, time, title }` 중 바꿀 것 | `event` |
| PATCH | `/api/events/{id}/done` | `{ done: true }` | `event` |
| DELETE | `/api/events/{id}` | — | — |
| GET | `/api/trash-schedules?regionId=2` | — | `[{ weekday, wasteType, description }]` |

```json
{ "id": "31", "date": "2026-10-24", "time": "18:00", "title": "택배 반품", "done": false, "source": "USER" }
```
- `time`이 빈 문자열(`""`)이면 종일 (`event_time = NULL`).
- `source`: `USER`(직접 입력) · `RENT`("월세 캘린더에 추가"로 자동 등록).
- **할 일은 일정에 합쳤어요** (백엔드 담당 시안 PR #12와 같은 방식). 체크한 일정은 `done: true`.
  - ⚠️ 지금 `schema.sql`에는 `events`에 완료 칸이 없고 `todos` 표가 따로 있어요. **`events.is_done`(+ `done_at`)을 추가**하고 `todos`는 빼는 걸 제안해요.
- 쓰레기 배출은 일정으로 저장하지 않고, 프론트가 `trash_schedules` 요일표로 달력에 그려요.
  - `weekday` 0=일 ~ 6=토, `wasteType`: `GENERAL`(일반) · `RECYCLE`(재활용) · `FOOD`(음식물)

---

## 4. 월세 · 공과금 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/rent-payments?from=2026-05&to=2026-10` | — | `[{ month, amount, paid, paidAt }]` |
| PUT | `/api/rent-payments/{month}` | `{ paid: true }` | `{ month, amount, paid, paidAt }` |
| GET | `/api/bills?month=2026-10` | — | `[bill]` |
| POST | `/api/bills` | `{ name, amount }` | `bill` |
| PUT | `/api/bills/{id}/payments/{month}` | `{ paid: true }` 또는 `{ amount: 41000 }` | `bill` |
| POST | `/api/bills/reset?month=2026-10` | — (이번 달 모두 미납으로) | `[bill]` |
| DELETE | `/api/bills/{id}` | — (해지: `is_active = 0`) | — |

```json
{ "id": "5", "name": "전기", "amount": 32000, "paid": false, "paidAt": null }
```
- 월세 `amount`는 **원 단위** (설정의 `rent` × 10000, `rent_payments.amount`).
- 공과금 `id`는 항목(`bill_items.id`), `amount`·`paid`는 그 달 납부 기록(`bill_payments`)의 값이에요.
- 그 달 줄이 없으면 서버가 만들어 주세요 (월세: 설정 금액, 공과금: `default_amount`). 같은 달 줄이 두 번 생기지 않게 (`uk_*_period_ym`).
- 프론트 대응: `rentPaid['2026-10']` · `Bill { id, name, amount, paid }` (`features/life/types.ts`)

---

## 5. 가계부 (수입 · 기타 지출) 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/ledger/categories?kind=INCOME` | — | `[{ id, kind, name, color }]` |
| GET | `/api/incomes?month=2026-10` | — | `[record]` |
| POST | `/api/incomes` | `{ date, categoryId, amount, memo }` | `record` |
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
- 통계는 저장하지 않고 VIEW로 계산: 월별 수입 = `v_monthly_income`, 지출 구성(월세 + 공과금 + 기타 지출) = `v_monthly_spend_breakdown`.
- 프론트 대응: `MoneyRecord { id, date, cat, amount, memo }`

---

## 6. 알림 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/notifications?status=all\|unread\|read` | — | `{ items: [noti], unreadCount }` |
| PATCH | `/api/notifications/read` | `{ ids: ["1","2"] }` (빈 배열이면 전부) | — |

```json
{ "id": "1", "type": "RENT", "title": "월세 납부일이 3일 남았어요", "body": "매월 15일 · 55만원",
  "link": "budget", "refId": null, "notifyAt": "2026-10-12T09:00:00+09:00", "read": false }
```
- `type`: `EVENT` · `TRASH` · `RENT` · `BILL` · `COMMUNITY` · `SYSTEM` (`notifications.noti_type`)
- `read`는 `read_at`이 있으면 `true`. `unreadCount`가 메뉴·종의 빨간 점이 돼요.
- 설정에서 알림을 끄면(`notiOn: false`) 만들지 않거나 빈 목록을 주세요.
- 지금 프론트는 일정·쓰레기·월세로 알림을 직접 계산해요(`features/life/derive.ts`의 `buildNotis`). 서버가 알림을 만들기 시작하면 이 API로 바꿀게요.

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
- **신고**: `targetType` `POST` · `COMMENT`, `reason` `ABUSE` · `FALSE_INFO` · `PRIVACY` · `AD_ILLEGAL` · `COPYRIGHT` · `OTHER` (`reports`). 신고 버튼 화면은 아직 없어요.
- 정지된 회원은 글쓰기 · 댓글 · 좋아요가 403이어야 해요.
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
- `topic` 코드는 `ai_topics.code`와 같아요: `qna` `nearby` `trash` `cook` `clean` `contract` `landlord` `bill` `summary` (`features/ai/topics.ts`).
- `entryPoint`: `HOME_MODAL`(홈 "AI와 대화") · `AI_PAGE`(AI 메뉴)
- 지출 요약 카드는 **보낸 그때의 숫자**를 `card_data` JSON에 저장해서 다시 열어도 같게 보여요.
- **사진은 답을 만든 뒤 저장하지 않아요** (개인정보 처리방침). `ai_messages.attachment_id`는 비워 두세요.
- 질문할 때마다 `ai_usage_daily.question_count` +1, 하루 한도를 넘으면 429 + `{ message }`.
- 지금 프론트는 답을 브라우저 안에서 만들고(`features/ai/topics.ts`), 대화는 `zip-ai-chat`에 최근 40개만 저장해요 (`ChatMsg { role: 'bot' | 'user', text, card }`).

---

## 9. 지도 📝

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/places/categories` | — | `[{ id, name }]` (세탁방 · 편의점 · 약국 · 마트) |
| GET | `/api/places?regionId=2&categoryId=1` | — | `[place]` |
| GET | `/api/places/{id}/reviews` | — | `[{ id, rating, body, author, createdAt }]` (확장 기능) |
| POST | `/api/places/{id}/reviews` | `{ rating, body }` | — (한 사람당 한 장소 하나) |

```json
{ "id": "3", "category": "세탁방", "name": "코인빨래방 합정점", "description": "도보 약 3분 · 24시간",
  "lat": 37.5496, "lon": 126.9137, "address": null, "phone": null, "openHours": "24시간", "rating": 4.5, "reviewCount": 12 }
```
- 프론트 대응: `Place { n: name, d: description, lat, lon }` (`features/map/data/places.ts`)

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
| DELETE | `/api/admin/posts/{id}` · `/api/admin/comments/{id}` | `{ reason }` | — |
| GET | `/api/admin/reports?status=RECEIVED` | — | `[report]` |
| PATCH | `/api/admin/reports/{id}` | `{ status: "HIDDEN" \| "DISMISSED" }` | — |

```json
{ "id": "3", "nickname": "청소고수", "username": "cleanking", "joinedAt": "2026-05-15",
  "posts": 1, "comments": 0, "warns": 0, "bans": 1,
  "status": "SUSPENDED", "until": "2026-10-27T18:00:00+09:00", "permanent": false }
```
- **조치 → DB** (`user_sanctions`)

| 화면의 조치 | `type` · `days` | `sanction_type` | `ends_at` | `users.status` |
|---|---|---|---|---|
| 경고 | `WARNING`, `null` | `WARNING` | `NULL` | 그대로 |
| 1 · 3 · 5 · 10일 정지 | `SUSPEND`, `1`·`3`·`5`·`10` | `SUSPEND` | 지금 + N일 | `SUSPENDED` |
| 영구 정지 | `BAN`, `null` | `BAN` | `NULL` | `SUSPENDED` |
| 해제 | (DELETE) | 진행 중 조치의 `ends_at` = 지금 | — | `ACTIVE` |

- `warns` · `bans`는 지금까지 받은 경고 · 정지 횟수예요. 기간이 끝나거나 해제돼도 **횟수와 이력은 남아요**.
- 정지 기간이 끝나면 `users.status`를 `ACTIVE`로 돌려 주세요 (로그인할 때 확인해도 돼요).
- 정지 중이면: 로그인 · 글쓰기 · 댓글 · 좋아요 막기, 같은 **아이디 · 닉네임 · 휴대전화로 재가입** 막기.
  - ⚠️ 탈퇴하면 `user_sanctions`도 CASCADE로 지워져서 재가입을 못 막아요. 정지된 사람의 아이디·휴대전화(해시)를 따로 남기는 표가 필요해요.
- 글 · 댓글 삭제는 `status = DELETED` + 작성자에게 경고/정지를 같이 걸 수 있어요 (위 `sanctions` API를 이어서 호출).
- 지금은 가짜 API와 `src/features/moderation`이 브라우저(`zipban-records`)에서 이 규칙을 흉내 내요.

---

## 12. 메모 📝

마이페이지 "메모" 탭(메모장)과 홈의 메모 카드가 써요. 지금은 시안(`variants/app/js/views/memo.js`)만 있고 브라우저(`zip-memos`)에 저장해요.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| GET | `/api/memos?q=` | — | `[memo]` (고정 먼저, 그다음 최근 수정 순) |
| POST | `/api/memos` | `{ title, body, color, pinned, checklist, items }` (전부 선택) | `memo` |
| PATCH | `/api/memos/{id}` | 바꾼 칸만 | `memo` (쓰는 대로 자동 저장 → 짧은 간격으로 자주 와요) |
| DELETE | `/api/memos/{id}` | — | — |

```json
{ "id": "5", "title": "장보기", "body": "", "color": "노랑", "pinned": true, "checklist": true,
  "items": [{ "text": "두부", "done": false }, { "text": "계란 한 판", "done": true }],
  "createdAt": "2026-10-23T10:38:00+09:00", "updatedAt": "2026-10-24T10:38:00+09:00" }
```
- `checklist`가 `true`면 `items`(줄마다 체크), 아니면 `body`(글)를 써요.
- `color`: `노랑` · `분홍` · `하늘` · `초록` · `보라` · `흰색` (영문 코드로 바꿔도 돼요: `YELLOW` 등)
- 제안 표: `memos(id, user_id FK CASCADE, title VARCHAR(60), body TEXT, color, is_pinned, is_checklist, items JSON, created_at, updated_at)` + `(user_id, is_pinned, updated_at)` 인덱스

---

## DB와 아직 안 맞는 곳 (백엔드 확인 필요)

| # | 내용 | 제안 |
|---|---|---|
| 1 | 할 일이 일정에 합쳐졌는데 DB에 `todos`가 따로 있고 `events`에 완료 칸이 없어요 | `events.is_done`, `events.done_at` 추가, `todos` 제거 |
| 2 | 탈퇴하면 정지 기록이 사라져 재가입을 못 막아요 | 정지된 아이디·휴대전화 해시를 보관하는 표 추가 (예: `banned_identities`) |
| 3 | `password_resets.method`에 `EMAIL`이 남아 있어요 | 지금 화면은 `PHONE`만 써요. 남겨 둬도 되지만 문서에 "미사용" 표시 |
| 4 | 첨부 형식 제한이 DB에 없어요 | 서버에서 MIME 검사 (이미지 · PDF 등) |
| 5 | `user_settings`에 동네가 없고 `users.region_id`에 있어요 | 그대로 두고 설정 API에서 같이 주고받기 (위 2번 참고) |
| 6 | 메모 기능이 생겼는데 DB에 표가 없어요 | 위 [12번](#12-메모)의 `memos` 표 추가 |

## 프론트에서 서버를 붙이는 순서 (예: 일정)

1. `features/life/api/`에 API 함수 만들기 (`apiClient` 사용, 이 문서의 주소)
2. `features/life/hooks/`에 `useQuery` · `useMutation` 훅 만들기
3. 화면이 `useLifeStore` 대신 그 훅을 쓰게 바꾸기
4. 다 옮기면 localStorage 저장(`zip-life` 등)을 지우기

지금 브라우저에 저장하는 곳: 일정 · 월세 · 공과금 · 수입 · 지출 · 알림 읽음 · 설정 → `features/life/store.ts`, 커뮤니티 → `features/community/store.ts`, AI 대화 → `features/ai/store.ts`, 정지 기록 → `features/moderation/store.ts`.

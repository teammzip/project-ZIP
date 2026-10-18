# 백엔드 API 약속

프론트가 기대하는 API예요. 바뀌면 `src/features/auth/api/realAuthApi.ts`와 `types.ts`만 고치면 돼요.

## 공통

- 개발 중 프론트는 `localhost:3000`, `/api` 요청은 `localhost:8080`(백엔드)으로 넘어가요. 백엔드는 3000 말고 다른 포트를 써 주세요.
- 로그인 후 요청에는 `Authorization: Bearer <토큰>` 헤더가 붙어요.
- 실패하면 `{ "message": "이미 가입된 이메일이에요." }`처럼 주세요. 그 문장이 화면에 그대로 보여요.
- 토큰이 만료되면 **401**로 응답해 주세요. 프론트가 자동으로 로그아웃시켜요.

## 인증

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| POST | `/api/auth/signup` | 아래 [회원가입](#회원가입) 참고 | `{ accessToken, user }` |
| POST | `/api/auth/login` | `{ loginId, password }` (loginId = 아이디 또는 이메일) | `{ accessToken, user }` |
| POST | `/api/auth/phone/send` | `{ phone, purpose }` | — |
| POST | `/api/auth/phone/verify` | `{ phone, code, purpose }` | `{ verificationToken }` |
| POST | `/api/auth/find-id` | `{ nickname, phone, phoneVerificationToken }` | `{ username }` (가리지 않고 그대로) |
| POST | `/api/auth/password-reset/verify` | `{ username, phone, phoneVerificationToken }` | `{ resetToken }` |
| POST | `/api/auth/password-reset` | `{ resetToken, newPassword }` | — (토큰은 한 번만 사용) |
| PATCH | `/api/auth/me/password` | `{ currentPassword, newPassword }` | — (현재 비밀번호가 틀리면 실패) |
| GET | `/api/auth/me` | — | `user` |
| PATCH | `/api/auth/me` | `{ nickname }` 또는 소셜 첫 가입 때 주소 + 동의 | `user` |
| POST | `/api/auth/logout` | — | — |
| DELETE | `/api/auth/me` | — (회원 탈퇴) | — |
| GET | `/api/oauth2/authorization/{kakao\|google\|naver}` | 소셜 로그인 시작 | 끝나면 `/oauth/callback?token=...`으로 보내 주세요 |

### 휴대전화 인증
- `purpose`: `SIGNUP`(가입) · `FIND_ID`(아이디 찾기) · `RESET_PASSWORD`(비밀번호 찾기) — DB `phone_verifications.purpose`와 같아요.
- 흐름: `send` → 사용자가 받은 6자리 입력 → `verify` → 받은 `verificationToken`을 가입 · 찾기 요청에 함께 보냄.
- 비밀번호 찾기는 `password-reset/verify`로 `resetToken`을 받은 뒤, 같은 화면에서 `password-reset`으로 새 비밀번호를 저장해요 (메일 발송 없음).

### user 모양
```json
{ "id": "…", "username": "zipdemo", "email": "demo@zip.com", "nickname": "지기",
  "address": "서울시 마포구 합정동", "provider": "email", "agreedAt": "2026-10-18T00:00:00Z" }
```
- `provider`: `email` · `kakao` · `google` · `naver`
- `agreedAt`: 약관에 동의한 시각. 소셜로 처음 들어온 사람은 `null`로 주세요. 그러면 프론트가 동의 화면(`/welcome`)을 띄워요.

### 회원가입
```json
{ "username": "tester01", "password": "abcd123!", "nickname": "테스터",
  "phone": "010-1234-5678", "phoneVerificationToken": "…",
  "email": "t@zip.com", "address": "서울 마포구 합정동",
  "agreeTerms": true, "agreePrivacy": true, "agreePolicy": true, "ageOver14": true,
  "termsVersion": "2026-10-18" }
```
- **입력 규칙** (`src/features/auth/schema.ts`와 같게 검사해 주세요)
  - 아이디: 6~16자, 영문 소문자·숫자
  - 비밀번호: 8~16자, 영문·숫자·특수문자 모두 포함 (가입 · 비밀번호 찾기 · 변경 모두 같은 규칙)
  - 닉네임: 2~12자
- **동의 기록**(누가 · 언제 · 어느 `termsVersion`에 동의했는지)은 꼭 서버에 남겨 주세요. 약관 문구는 `src/features/legal/content.ts`에 있어요.

## 아직 프론트에만 있는 데이터

할 일 · 일정 · 공과금 · 월세 · 수입 · 지출 · 알림 · 설정은 `src/features/life/store.ts`에, 커뮤니티 글은 `features/community/store.ts`에, AI 대화는 `features/ai/store.ts`에 있어요. 지금은 브라우저에 저장돼요.
데이터 모양은 각 폴더의 `types.ts`를 기준으로 맞춰 주세요. DB 설계는 `../db/schema.sql`과 `../db/README.md`에 있어요 (수입은 `incomes`, 지출은 `expenses` 테이블).

서버를 붙이는 순서 (예: 일정)
1. `features/life/api/`에 API 함수 만들기
2. `hooks/`에 useQuery · useMutation 훅 만들기
3. 화면이 `useLifeStore` 대신 그 훅을 쓰게 바꾸기

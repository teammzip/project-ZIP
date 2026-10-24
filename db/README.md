# ZIP 데이터베이스 설계 (현재 SQL 기준)

이 문서는 **2026-10-24에 확인한 [schema.sql](schema.sql)**을 기준으로 작성했습니다. 테이블 정의와 기본 데이터가 기준이며, API 동작이나 자동 작업이 이미 구현되었다는 의미는 아닙니다.

- 테이블 **35개**, 집계 VIEW **2개**입니다.
- 소셜 회원의 로그인 아이디는 NULL을 허용하며, 일반 가입의 필수·형식 검사는 서버에서 수행합니다.
- 첨부파일 연결, 댓글 수정 시각, 동네·요일·쓰레기 종류별 중복 방지 규칙을 본문에 반영했습니다.
- 약관 기본 데이터 버전은 `2026-10-18`이며 React 약관의 제목·본문을 사용합니다.
- 새 DB에는 `schema.sql`을 실행합니다. 기존 DB의 테이블 구조는 CREATE TABLE IF NOT EXISTS만으로 바뀌지 않습니다. 현재 저장소에 마이그레이션 파일이 없으므로 기존 DB 변경 시 별도 마이그레이션을 준비해야 합니다.

| 항목 | 내용 |
|---|---|
| DB | MySQL 8.0 이상, InnoDB, utf8mb4 |
| 규모 | 테이블 35개 + VIEW 2개 |
| 기준 파일 | [schema.sql](schema.sql) |
| 새 DB 생성 | `mysql -u root -p < db/schema.sql` |

## 1. 구조와 용어

현재 저장소에는 기존 ERD PNG 파일이 없습니다. 관계는 아래 각 테이블의 외래키 설명과 SQL을 확인하세요.

| 용어 | 의미 |
|---|---|
| PK | 행을 식별하는 기본키 |
| FK | 다른 테이블의 행을 가리키는 외래키 |
| UK | 값 또는 값 조합의 중복 방지 |
| VIEW | 원본 데이터를 조회·집계하는 저장된 쿼리 |


## 2. 표 한눈에 보기

### 1. 계정 · 인증 · 약관

| 표 이름 | 한글 이름 | 사용 상태 | 무엇을 담나요 (어느 화면이 쓰나요) |
|---|---|---|---|
| `regions` | 동네 | 지금 화면이 쓰는 데이터 | 시·도와 구·군 같은 "동네" 목록. |
| `region_neighbors` | 주변 동네 | 지금 화면이 쓰는 데이터 | 어느 동네가 어느 동네와 이웃한지 적어 둔 표. |
| `users` | 사용자 | 지금 화면이 쓰는 데이터 | 가입한 사람 한 명당 한 줄. |
| `social_accounts` | 소셜 로그인 계정 | 지금 화면이 쓰는 데이터 | 카카오·구글·네이버로 로그인한 사용자가 어느 소셜 계정인지 연결해 두는 표. |
| `auth_sessions` | 로그인 세션 | 서버를 붙일 때 필요 | 로그인한 기기마다 한 줄. |
| `phone_verifications` | 휴대전화 인증 | 지금 화면이 쓰는 데이터 | 문자로 보낸 인증번호 기록. |
| `password_resets` | 비밀번호 재설정 토큰 | 서버를 붙일 때 필요 | 비밀번호를 다시 정하도록 허락하는 1회용 토큰. |
| `terms_documents` | 약관 문서 | 지금 화면이 쓰는 데이터 | 가입 화면에 보이는 약관의 본문과 버전. |
| `user_term_agreements` | 약관 동의 이력 | 지금 화면이 쓰는 데이터 | 누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표. |
| `withdrawal_logs` | 회원 탈퇴 기록 | 서버를 붙일 때 필요 | 탈퇴가 있었다는 사실만 남기는 표(통계·문의 대응용). |

### 2. 마이페이지 · 생활 관리

| 표 이름 | 한글 이름 | 사용 상태 | 무엇을 담나요 (어느 화면이 쓰나요) |
|---|---|---|---|
| `user_settings` | 사용자 설정 | 지금 화면이 쓰는 데이터 | 내 정보 화면의 설정값(월세·월세 납부일·입주한 달·계약 끝나는 달·알림 수신). |
| `todos` | 할 일 | 지금 화면이 쓰는 데이터 | 마이페이지 "할 일" 탭과 오른쪽 패널의 이번 주 할 일 목록. |
| `events` | 일정 | 지금 화면이 쓰는 데이터 | 마이페이지 "일정" 탭의 달력과 일정 목록. |
| `bill_items` | 공과금 항목 | 지금 화면이 쓰는 데이터 | 내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액. |
| `bill_payments` | 공과금 납부 | 지금 화면이 쓰는 데이터 | 공과금 항목별 월별 청구·납부 기록. |
| `rent_payments` | 월세 납부 | 지금 화면이 쓰는 데이터 | 월별 월세 납부 기록. |
| `notifications` | 알림 | 지금 화면이 쓰는 데이터 | 알림 화면과 빨간 점이 쓰는 표. |

### 3. 가계부

| 표 이름 | 한글 이름 | 사용 상태 | 무엇을 담나요 (어느 화면이 쓰나요) |
|---|---|---|---|
| `ledger_categories` | 가계부 분류 | 지금 화면이 쓰는 데이터 | 수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다. |
| `incomes` | 수입 | 지금 화면이 쓰는 데이터 | 가계부 "수입" 탭에서 기록하는 수입 한 건. |
| `expenses` | 기타 지출 | 지금 화면이 쓰는 데이터 | 가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등). |
| `v_monthly_income` | 월별 수입 합계 (VIEW) | 집계 VIEW | 홈의 "월별 수입" 막대 그래프와 수입 탭의 월 합계. |
| `v_monthly_spend_breakdown` | 월별 지출 구성 (VIEW) | 집계 VIEW | 홈의 "이번 달 지출 구성" 도넛과 AI "이번 달 지출 요약". |

### 4. 커뮤니티 · 신고 · 이용 제한

| 표 이름 | 한글 이름 | 사용 상태 | 무엇을 담나요 (어느 화면이 쓰나요) |
|---|---|---|---|
| `posts` | 커뮤니티 글 | 지금 화면이 쓰는 데이터 | 커뮤니티의 글 한 개. |
| `post_likes` | 글 좋아요 | 지금 화면이 쓰는 데이터 | 누가 어느 글에 좋아요를 눌렀는지. |
| `comments` | 댓글 | 화면 데이터 대응 | 글에 달린 댓글과 수정 시각. |
| `post_attachments` | 게시글 첨부파일 연결 | 서버 연결용 | 게시글·파일 연결과 표시 순서. |
| `reports` | 신고 | 확장(미리 열어 둠) | 운영 정책에 어긋나는 글·댓글을 신고한 기록(정책 제3조). |
| `user_sanctions` | 이용 제한 | 확장(미리 열어 둠) | 운영 정책 위반에 따른 조치 기록(정책 제7조: 경고 → 게시 제한 → 이용 제한 → 이용 정지). |

### 5. AI · 지도 · 공용 데이터

| 표 이름 | 한글 이름 | 사용 상태 | 무엇을 담나요 (어느 화면이 쓰나요) |
|---|---|---|---|
| `ai_topics` | AI 분야 | 지금 화면이 쓰는 데이터 | AI 화면의 분야 카드와 홈 AI 대화 칩의 목록(자유 질문·근처 탐색·분리배출·냉장고 요리·청소·계약·집주인 문자·공과금·지출 요약). |
| `uploaded_files` | 업로드 파일 | 서버를 붙일 때 필요 | 커뮤니티 첨부파일 등의 이름·주소·형식·크기. |
| `ai_conversations` | AI 대화 | 지금 화면이 쓰는 데이터 | AI와의 대화 한 건(대화방). |
| `ai_messages` | AI 메시지 | 지금 화면이 쓰는 데이터 | 대화 안의 말풍선 한 개. |
| `ai_usage_daily` | AI 하루 사용량 | 서버를 붙일 때 필요 | 사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표. |
| `trash_schedules` | 쓰레기 배출 일정 | 지금 화면이 쓰는 데이터 | 동네별 요일 배출표. |
| `place_categories` | 장소 분류 | 지금 화면이 쓰는 데이터 | 지도 화면의 칩(세탁방·편의점·약국·마트) 목록. |
| `places` | 주변 장소 | 지금 화면이 쓰는 데이터 | 지도 화면과 AI "근처 탐색"에 나오는 가게·시설. |
| `place_reviews` | 장소 리뷰 | 확장(미리 열어 둠) | 사용자가 장소에 남기는 별점과 한 줄 리뷰(확장 기능). |

## 3. 브라우저 저장 데이터와 DB의 대응

아래는 기존 브라우저 저장 구조를 DB로 옮길 때의 대응표입니다. 최신 API의 일정 통합·관리자 요구사항과 현재 SQL의 차이는 6절에 구분했습니다. 실제 서버 연결 완료 여부를 뜻하지 않습니다.

| 지금 저장 위치 (localStorage 키 / 파일) | 들어 있는 것 | 옮겨 갈 DB 표 |
|---|---|---|
| `zip-account` + 가입 페이지 입력 | 아이디, 닉네임, 비밀번호 해시, 휴대전화 해시 | `users` (+ `phone_verifications`, 재설정은 `password_resets`) |
| 가입 페이지의 약관 체크 | 서비스 이용약관 · 개인정보 안내 확인 · 운영 정책 동의 | `user_term_agreements` (본문은 `terms_documents`) |
| 로그인 창 / 소셜 로그인 버튼 | 로그인, 카카오·구글·네이버 | `auth_sessions`, `social_accounts` |
| 아이디 찾기 · 비밀번호 찾기 | 휴대전화 인증, 재설정 | `users`, `phone_verifications`, `password_resets` |
| `zip-settings` | 이름(닉네임), 동네, 월세, 납부일, 알림 | `users`(닉네임·동네) + `user_settings` (React 앱은 입주한 달·계약 끝나는 달도 저장) |
| `zip-todos` | 할 일 | `todos` |
| `zip-events` | 일정 | `events` |
| `zip-bills` | 공과금 항목과 납부 체크 | `bill_items` + `bill_payments` |
| `zip-rent-paid` | 월별 월세 납부 체크 | `rent_payments` |
| `zip-incomes` | 수입 기록 | `incomes` (종류는 `ledger_categories`) |
| `zip-spends` | 기타 지출 기록 | `expenses` (분류는 `ledger_categories`) |
| 홈 월별 수입 그래프 / 이번 달 지출 구성 / AI 지출 요약 | 위 기록을 합산한 값 | 저장하지 않고 VIEW `v_monthly_income`, `v_monthly_spend_breakdown` 로 계산 |
| `zip-noti-read` | 알림을 읽었는지 | `notifications.read_at` |
| `zip-posts` | 커뮤니티 글·좋아요·댓글·첨부 | `posts`, `post_likes`, `comments`, `post_attachments`, `uploaded_files` |
| 신고·운영 조치 데이터 | 신고와 제재 이력 | `reports`, `user_sanctions` (해제 이력은 미설계) |
| `zip-ai-chat` | AI 대화 말풍선(지출 요약 카드 포함) | `ai_conversations`, `ai_messages` |
| AI 화면의 분야 카드 | 분야 목록 | `ai_topics` |
| AI 화면의 사진 첨부 | 처리 후 보관하지 않는 사진 | 현재 영구 저장 대상 아님. `uploaded_files`와 AI 첨부 FK는 확장용 |
| `variants/app/js/data/trash.js` | 요일별 배출표 | `trash_schedules` |
| `variants/app/js/data/places.js` | 지도의 장소 | `places`, `place_categories` |
| `variants/app/js/data/posts-seed.js` | 동네·주변 동네, 기본 글 | `regions`, `region_neighbors`, `posts` |
| `frontend/src/features/legal/content.ts` | 현재 SQL 기본 데이터의 약관 원문·버전 | `terms_documents` |

### React 앱(`frontend/`)의 저장 위치

| React 저장 위치 | 들어 있는 것 | 옮겨 갈 DB 표 |
|---|---|---|
| `zip-life` (한 곳에 모아 저장) | 일정(할 일은 일정의 `done` 체크로 합침), 공과금, 수입, 지출, 월세 납부 체크, 알림 읽음, 설정(동네·월세·납부일·알림·입주한 달·계약 끝나는 달) | `events`(완료 칸 `is_done` 추가 필요), `bill_items` + `bill_payments`, `incomes`, `expenses`, `rent_payments`, `notifications.read_at`, `users.region_id` + `user_settings` |
| `zip-auth` | 로그인 토큰과 내 정보 (`id, username, email, nickname, address, region, provider, role, status, agreedAt`) | `auth_sessions`, `users` (`provider` = `users.signup_provider` 소문자, `agreedAt` = `user_term_agreements`) |
| `zip-mock-users` | 가짜 API가 저장한 가입 계정 | `users` (+ 휴대전화는 `phone_verifications` 로 확인) |
| `zip-posts` | 커뮤니티 글·좋아요·댓글·첨부 | `posts`, `post_likes`, `comments`, `post_attachments`, `uploaded_files` |
| `zip-posts` | 커뮤니티 글·좋아요·댓글·첨부 | `posts`, `post_likes`, `comments`, `uploaded_files` + `post_attachments` |
| `zipban-records` | 이용 정지·경고 기록 (데이터 초기화로 안 지워지게 `zip-`로 시작하지 않음) | `user_sanctions`, `users.status` |
| `zip-map` | 지도 칩에 보이는 장소 종류 · 직접 추가한 검색어 · 즐겨찾기한 장소 | (표 없음) 즐겨찾기를 서버에 두려면 `place_favorites(user_id, place_id)` 추가 |
| `zip-memos` | 메모장 (글 · 체크리스트 · 색 · 고정) | (표 없음) `memos` 추가 필요 — `frontend/API.md` 12번 |
| `zip-profile` | 프로필 사진(240px) · 캐릭터 · 배경 색 · 한 줄 소개 | (칸 없음) `users.bio`, 프로필 사진 파일 연결 추가 필요 |
| `zip-ai-chat` | AI 대화 말풍선 (지출 요약 카드 `{month,total,prevTotal,fixed,rows,top}` 포함) | `ai_conversations`, `ai_messages` (카드는 `card_data` JSON) |
## 4. 표마다 자세한 설명

현재 `schema.sql`의 모든 컬럼과 키를 정리했습니다. **필수**는 NOT NULL, **허용**은 NULL입니다. 기본값이 없으면 `—`로 표시합니다. 자동 번호와 자동 수정 시각은 설명에 따로 표시합니다.

### 1. 계정 · 인증 · 약관

#### `regions` — 동네

시·도와 구·군 같은 "동네" 목록. 사용자가 사는 동네, 커뮤니티 글의 동네, 쓰레기 배출표, 주변 장소가 모두 이 표를 가리킵니다. (내 정보의 "우리 동네", 커뮤니티의 "우리 동네 / 주변 동네 / 전체" 범위)

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 — 자동 증가 / 자동 번호 |
| `parent_id` | BIGINT UNSIGNED | 허용 | — | 상위 동네 아이디 — 시·도 → 구·군 |
| `name` | VARCHAR(30) | 필수 | — | 동네 이름 — 예: 마포구 |
| `level` | TINYINT UNSIGNED | 필수 | — | 동네 단계 — 1=시·도, 2=구·군 |

- 기본키: `id`
- 중복 불가: `parent_id`, `name`
- 외래키 `parent_id` → `regions`.`id`: 참조 대상 삭제 시 **삭제 차단**

#### `region_neighbors` — 주변 동네

어느 동네가 어느 동네와 이웃한지 적어 둔 표. 커뮤니티의 "주변 동네" 범위로 글을 모아 볼 때 씁니다. (마포구 ↔ 서대문구·용산구·영등포구)

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 |
| `neighbor_region_id` | BIGINT UNSIGNED | 필수 | — | 주변 동네 아이디 — 이웃한 동네 |

- 기본키: `region_id`, `neighbor_region_id`
- 외래키 `region_id` → `regions`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `neighbor_region_id` → `regions`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `users` — 사용자

가입한 사람 한 명당 한 줄. 로그인 정보(아이디·비밀번호), 본인 확인 정보(휴대전화·이메일), 닉네임과 사는 동네를 담습니다. 모든 개인 데이터(일정·할 일·가계부·글 등)가 이 표의 id 를 따라갑니다. 회원 탈퇴를 하면 이 줄과 딸린 데이터가 모두 지워집니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 — 자동 증가 / 자동 번호 |
| `login_id` | VARCHAR(16) | 허용 | — | 로그인 아이디 — 일반 가입은 6~16자 영문 소문자·숫자 필수, 소셜 가입은 NULL 허용 |
| `password_hash` | VARCHAR(100) | 허용 | — | 비밀번호(해시) — 원문은 저장 안 함. 소셜 가입자는 비어 있음 |
| `nickname` | VARCHAR(12) | 필수 | — | 닉네임 — 2~12자, 앱 인사말에 쓰임 |
| `email` | VARCHAR(100) | 허용 | — | 이메일 |
| `phone` | VARCHAR(11) | 허용 | — | 휴대전화 — 숫자만 (01012345678) |
| `phone_verified_at` | DATETIME | 허용 | — | 휴대전화 인증 일시 — 가입 때 인증을 마친 시각 |
| `region_id` | BIGINT UNSIGNED | 허용 | — | 사는 동네 아이디 — 내 정보의 "우리 동네" |
| `address` | VARCHAR(200) | 허용 | — | 입력한 주소 — 가입할 때 쓴 주소 글자 |
| `age_confirmed_at` | DATETIME | 허용 | — | 만 14세 이상 확인 일시 — 가입 때 "만 14세 이상" 체크한 시각 |
| `signup_provider` | ENUM('EMAIL','KAKAO','GOOGLE','NAVER') | 필수 | `'EMAIL'` | 가입 경로 — 화면의 provider 값. 소셜 첫 가입자는 약관·주소를 나중에 받음 |
| `role` | ENUM('USER','ADMIN') | 필수 | `'USER'` | 사용자 권한 — 운영자만 ADMIN |
| `status` | ENUM('ACTIVE','SUSPENDED') | 필수 | `'ACTIVE'` | 이용 상태 — 이용 제한 중이면 SUSPENDED |
| `password_changed_at` | DATETIME | 허용 | — | 비밀번호 변경 일시 — 내 정보·비밀번호 찾기로 바꾼 시각 |
| `last_login_at` | DATETIME | 허용 | — | 마지막 로그인 일시 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 가입 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 정보 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 중복 불가: `login_id`
- 중복 불가: `email`
- 중복 불가: `phone`
- 외래키 `region_id` → `regions`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**

#### `social_accounts` — 소셜 로그인 계정

카카오·구글·네이버로 로그인한 사용자가 어느 소셜 계정인지 연결해 두는 표. 한 사용자가 여러 소셜을 연결할 수 있고, 같은 소셜 계정은 한 사용자에게만 붙습니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 소셜계정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 연결된 사용자 아이디 |
| `provider` | ENUM('KAKAO','GOOGLE','NAVER') | 필수 | — | 소셜 서비스 |
| `provider_user_id` | VARCHAR(100) | 필수 | — | 소셜 서비스 사용자 번호 — 소셜 쪽에서 준 고유 번호 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 연결 일시 |

- 기본키: `id`
- 중복 불가: `provider`, `provider_user_id`
- 중복 불가: `user_id`, `provider`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `auth_sessions` — 로그인 세션

로그인한 기기마다 한 줄. 토큰 원문 대신 해시만 저장합니다. 로그아웃하면 revoked_at 이 채워지고, "로그인 유지"를 켜면 만료가 길어집니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 세션 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 로그인한 사용자 아이디 |
| `refresh_token_hash` | CHAR(64) | 필수 | — | 재발급 토큰(해시) — 원문은 저장 안 함 |
| `remember` | TINYINT(1) | 필수 | `0` | 로그인 유지 여부 — 로그인 창의 "로그인 유지" 체크 |
| `user_agent` | VARCHAR(255) | 허용 | — | 접속 기기 정보 — 브라우저 이름 등 |
| `ip_address` | VARCHAR(45) | 허용 | — | 접속 IP |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 로그인 일시 |
| `expires_at` | DATETIME | 필수 | — | 만료 일시 |
| `revoked_at` | DATETIME | 허용 | — | 로그아웃(무효) 일시 — 비어 있으면 아직 유효 |

- 기본키: `id`
- 중복 불가: `refresh_token_hash`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `phone_verifications` — 휴대전화 인증

문자로 보낸 인증번호 기록. 가입, 아이디 찾기, 비밀번호 찾기에서 같은 방식으로 씁니다. 인증에 성공하면 "인증 완료 값"이 발급되고, 가입 요청(가입 화면의 휴대전화 인증)이나 비밀번호 재설정(password_resets)에 그 값을 함께 보냅니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 인증 아이디 — 자동 증가 / 자동 번호 |
| `purpose` | ENUM('SIGNUP','FIND_ID','RESET_PASSWORD') | 필수 | — | 인증 목적 — 가입 / 아이디 찾기 / 비밀번호 찾기 |
| `phone` | VARCHAR(11) | 필수 | — | 인증받는 휴대전화 — 숫자만 |
| `user_id` | BIGINT UNSIGNED | 허용 | — | 대상 사용자 아이디 — 찾기일 때만 채움(가입 때는 비움). 탈퇴하면 함께 삭제 |
| `code_hash` | CHAR(64) | 필수 | — | 인증번호(해시) — 6자리 번호를 해시로 저장 |
| `attempt_count` | TINYINT UNSIGNED | 필수 | `0` | 틀린 횟수 — 횟수가 넘으면 잠금 |
| `requested_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 인증번호 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 인증번호 만료 일시 — 보통 3분 |
| `verified_at` | DATETIME | 허용 | — | 인증 성공 일시 |
| `verified_token_hash` | CHAR(64) | 허용 | — | 인증 완료 값(해시) — 인증 성공 때 발급. 가입·찾기 요청에 함께 보내는 값 |
| `consumed_at` | DATETIME | 허용 | — | 사용 일시 — 인증 완료 값을 가입·재설정에 쓴 시각(한 번만 사용) |

- 기본키: `id`
- 중복 불가: `verified_token_hash`
- 조회 색인: `phone`, `requested_at`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `password_resets` — 비밀번호 재설정 토큰

비밀번호 변경을 허락하는 1회용 토큰의 해시·만료 시각·사용 시각을 저장합니다. 현재 API는 휴대전화 인증 후 method=PHONE으로 발급합니다. SQL의 EMAIL 값은 이메일 방식 확장도 허용한다는 뜻입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 재설정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 재설정하는 사용자 아이디 |
| `method` | ENUM('PHONE','EMAIL') | 필수 | — | 본인 확인 방법 — 휴대전화 인증 / 이메일 링크 |
| `token_hash` | CHAR(64) | 필수 | — | 재설정 토큰(해시) — 원문은 저장 안 함 |
| `requested_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 만료 일시 — 보통 10~30분 |
| `used_at` | DATETIME | 허용 | — | 사용 일시 — 비어 있으면 아직 안 씀 |

- 기본키: `id`
- 중복 불가: `token_hash`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `terms_documents` — 약관 문서

가입 화면에 보이는 약관의 본문과 버전. 서비스 이용약관, 개인정보 처리방침, 커뮤니티·AI 운영 정책 세 종류이고, 내용이 바뀌면 새 버전 줄을 추가합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 약관 아이디 — 자동 증가 / 자동 번호 |
| `doc_type` | ENUM('SERVICE','PRIVACY','POLICY') | 필수 | — | 약관 종류 — 이용약관 / 개인정보 처리방침 / 운영 정책 |
| `version` | VARCHAR(20) | 필수 | — | 약관 버전 — frontend LEGAL_VERSION과 동일 (예: 2026-10-18) |
| `title` | VARCHAR(100) | 필수 | — | 약관 제목 |
| `content` | MEDIUMTEXT | 필수 | — | 약관 본문 — 조항 전체 |
| `consent_kind` | ENUM('AGREE','CONFIRM') | 필수 | — | 받는 방식 — 동의(이용약관·운영정책) / 안내 확인(개인정보 처리방침) |
| `is_required` | TINYINT(1) | 필수 | `1` | 필수 여부 — 필수면 체크해야 가입 가능 |
| `effective_at` | DATETIME | 필수 | — | 시행 일시 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 등록 일시 |

- 기본키: `id`
- 중복 불가: `doc_type`, `version`

#### `user_term_agreements` — 약관 동의 이력

누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표. 분쟁이 생기면 증거가 되므로 사용자가 탈퇴하기 전까지 보관합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 동의 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 동의한 사용자 아이디 |
| `terms_id` | BIGINT UNSIGNED | 필수 | — | 동의한 약관 아이디 |
| `agreed_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 동의 일시 |

- 기본키: `id`
- 중복 불가: `user_id`, `terms_id`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `terms_id` → `terms_documents`.`id`: 참조 대상 삭제 시 **삭제 차단**

#### `withdrawal_logs` — 회원 탈퇴 기록

탈퇴가 있었다는 사실만 남기는 표(통계·문의 대응용). 탈퇴하면 개인정보와 개인 데이터는 모두 지워지므로 이름·연락처는 저장하지 않고, 사용자 번호도 연결(FK)하지 않습니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 탈퇴기록 아이디 — 자동 증가 / 자동 번호 |
| `former_user_id` | BIGINT UNSIGNED | 필수 | — | 탈퇴한 사용자 번호 — 이미 지워진 번호(연결 없음) |
| `withdrawn_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 탈퇴 일시 |

- 기본키: `id`

### 2. 마이페이지 · 생활 관리

#### `user_settings` — 사용자 설정

내 정보 화면의 설정값(월세·월세 납부일·입주한 달·계약 끝나는 달·알림 수신). 사용자 한 명당 한 줄. 이름(닉네임)과 동네는 users 에 있습니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 |
| `rent_amount` | INT UNSIGNED | 필수 | `0` | 월세 금액 — 만원 단위 (55 = 55만원) |
| `rent_day` | TINYINT UNSIGNED | 필수 | `15` | 월세 납부일 — 매월 며칠 (1~31) |
| `move_in_ym` | CHAR(7) | 허용 | — | 입주한 달 — 오른쪽 패널의 "거주 N개월" 계산 (예: 2026-02) |
| `contract_end_ym` | CHAR(7) | 허용 | — | 계약 끝나는 달 — "계약 N개월 남음" 계산 |
| `noti_on` | TINYINT(1) | 필수 | `1` | 알림 수신 여부 — 끄면 빨간 점·알림을 숨김 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 설정 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `user_id`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `todos` — 할 일

마이페이지 "할 일" 탭과 오른쪽 패널의 이번 주 할 일 목록. 체크하면 완료 처리되고, 홈 카드의 남은 개수와 진행 막대가 여기서 계산됩니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 할 일 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 할 일 주인 아이디 |
| `content` | VARCHAR(40) | 필수 | — | 할 일 내용 |
| `is_done` | TINYINT(1) | 필수 | `0` | 완료 여부 |
| `sort_order` | INT | 필수 | `0` | 정렬 순서 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 등록 일시 |
| `done_at` | DATETIME | 허용 | — | 완료 일시 — 비우면 아직 안 함 |

- 기본키: `id`
- 조회 색인: `user_id`, `is_done`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `events` — 일정

마이페이지 "일정" 탭의 달력과 일정 목록. 일정 추가·수정·삭제와 상단 검색의 대상이며, 가까운 일정은 알림으로도 보입니다. "월세 캘린더에 추가"로 자동 등록된 일정은 source 로 구분합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 일정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 일정 주인 아이디 |
| `title` | VARCHAR(60) | 필수 | — | 일정 제목 |
| `event_date` | DATE | 필수 | — | 일정 날짜 |
| `event_time` | TIME | 허용 | — | 일정 시간 — 비우면 종일 |
| `source` | ENUM('USER','RENT') | 필수 | `'USER'` | 등록 경로 — 직접 입력 / 월세 납부일 자동 등록 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 등록 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 수정 일시 — 일정 수정 기능이 갱신 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `event_date`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `bill_items` — 공과금 항목

내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액. 항목은 한 번 만들어 두고 달마다 납부 기록(bill_payments)을 붙입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 공과금 주인 아이디 |
| `name` | VARCHAR(30) | 필수 | — | 공과금 이름 — 가스, 전기, 수도 등 |
| `default_amount` | INT UNSIGNED | 필수 | `0` | 평소 금액 — 원 단위 |
| `is_active` | TINYINT(1) | 필수 | `1` | 사용 여부 — 해지한 항목은 0 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 등록 일시 |

- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `bill_payments` — 공과금 납부

공과금 항목별 월별 청구·납부 기록. 홈의 "이번 달 공과금 % 납부"와 공과금 상세 화면, 가계부의 고정 지출이 여기서 계산됩니다. paid_at 이 비어 있으면 미납입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금납부 아이디 — 자동 증가 / 자동 번호 |
| `bill_item_id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | INT UNSIGNED | 필수 | — | 그 달 금액 — 원 단위 |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- 중복 불가: `bill_item_id`, `period_ym`
- 외래키 `bill_item_id` → `bill_items`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `rent_payments` — 월세 납부

월별 월세 납부 기록. 월세 상세 화면의 최근 6개월 체크 목록, 홈 월세 D-day 카드, 가계부 고정 지출이 이 표를 씁니다. paid_at 이 비어 있으면 미납입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 월세납부 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 월세 내는 사용자 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | INT UNSIGNED | 필수 | — | 그 달 월세 — 원 단위 (설정의 월세 × 10000) |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- 중복 불가: `user_id`, `period_ym`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `notifications` — 알림

알림 화면과 빨간 점이 쓰는 표. 일정·쓰레기 배출·월세·공과금·커뮤니티 댓글 알림이 생길 때 한 줄씩 쌓이고, 누르면 read_at 이 채워져 "읽음"이 됩니다. 안 읽은 알림 개수가 메뉴·종·마이페이지 탭의 빨간 점이 됩니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 알림 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 알림 받는 사용자 아이디 |
| `noti_type` | ENUM('EVENT','TRASH','RENT','BILL','COMMUNITY','SYSTEM') | 필수 | — | 알림 종류 |
| `title` | VARCHAR(100) | 필수 | — | 알림 제목 |
| `body` | VARCHAR(200) | 허용 | — | 알림 설명 |
| `link_view` | VARCHAR(20) | 허용 | — | 이동 화면 — 눌렀을 때 열 화면 이름 |
| `ref_id` | BIGINT UNSIGNED | 허용 | — | 관련 데이터 번호 — 일정·글 번호 등 |
| `notify_at` | DATETIME | 필수 | — | 알릴 일시 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 생성 일시 |
| `read_at` | DATETIME | 허용 | — | 읽은 일시 — 비어 있으면 안 읽음 |

- 기본키: `id`
- 조회 색인: `user_id`, `read_at`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

### 3. 가계부

#### `ledger_categories` — 가계부 분류

수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다. 화면의 칩 색깔도 여기서 가져옵니다. 월세·공과금은 별도 표(rent_payments, bill_payments)에서 옵니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 분류 아이디 — 자동 증가 / 자동 번호 |
| `kind` | ENUM('INCOME','EXPENSE') | 필수 | — | 분류 구분 — 수입 / 기타 지출 |
| `name` | VARCHAR(20) | 필수 | — | 분류 이름 — 월급, 식비 등 |
| `color` | VARCHAR(20) | 필수 | — | 표시 색 — 예: #1fb5a3 |
| `sort_order` | TINYINT UNSIGNED | 필수 | `0` | 정렬 순서 |

- 기본키: `id`
- 중복 불가: `kind`, `name`

#### `incomes` — 수입

가계부 "수입" 탭에서 기록하는 수입 한 건. 월별 합계·가장 큰 종류, 홈의 "월별 수입" 막대 그래프의 원본입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 수입 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 수입 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 수입 종류 아이디 — 월급, 아르바이트 등 |
| `amount` | INT UNSIGNED | 필수 | — | 수입 금액 — 원 단위 |
| `income_date` | DATE | 필수 | — | 번 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 주말 카페 알바 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 기록 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `income_date`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `category_id` → `ledger_categories`.`id`: 참조 대상 삭제 시 **삭제 차단**

#### `expenses` — 기타 지출

가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등). 월별 보기, 홈의 "이번 달 지출 구성" 도넛, AI "이번 달 지출 요약" 카드가 월세·공과금과 합쳐 계산합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 지출 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 지출 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 지출 분류 아이디 — 식비, 교통 등 |
| `amount` | INT UNSIGNED | 필수 | — | 지출 금액 — 원 단위 |
| `expense_date` | DATE | 필수 | — | 쓴 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 점심 제육덮밥 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 기록 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `expense_date`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `category_id` → `ledger_categories`.`id`: 참조 대상 삭제 시 **삭제 차단**

### 4. 커뮤니티 · 신고 · 이용 제한

#### `posts` — 커뮤니티 글

커뮤니티의 글 한 개. 동네와 분류(자유·꿀팁·질문·동네)로 걸러 보고, 홈의 "자취 꿀팁"은 is_home_tip 이 켜진 꿀팁 글입니다. 좋아요·댓글 수는 목록을 빨리 보여주려고 글에 같이 적어 둡니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 글 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 글 작성자 아이디 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 글 동네 아이디 — 어느 동네 글인지 |
| `category` | ENUM('FREE','TIP','QUESTION','TOWN') | 필수 | — | 글 분류 — 자유 / 꿀팁 / 질문 / 동네 |
| `title` | VARCHAR(100) | 필수 | — | 글 제목 |
| `body` | TEXT | 필수 | — | 글 내용 |
| `like_count` | INT UNSIGNED | 필수 | `0` | 좋아요 수 |
| `comment_count` | INT UNSIGNED | 필수 | `0` | 댓글 수 |
| `is_home_tip` | TINYINT(1) | 필수 | `0` | 홈 꿀팁 노출 — 켜면 홈에 보임 |
| `status` | ENUM('VISIBLE','HIDDEN','DELETED') | 필수 | `'VISIBLE'` | 글 상태 — 신고로 숨김 / 삭제 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 작성 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 — 소프트 삭제 |

- 기본키: `id`
- 조회 색인: `region_id`, `category`, `created_at`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `region_id` → `regions`.`id`: 참조 대상 삭제 시 **삭제 차단**

#### `post_likes` — 글 좋아요

누가 어느 글에 좋아요를 눌렀는지. 한 사람이 한 글에 한 번만 누를 수 있어서 (글, 사용자)가 기본키입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 받은 글 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 누른 사용자 아이디 — 한 사람당 한 번 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 좋아요 일시 |

- 기본키: `post_id`, `user_id`
- 외래키 `post_id` → `posts`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `comments` — 댓글

글에 달린 댓글. 지금 화면은 한 줄 댓글이지만 parent_id 로 대댓글도 만들 수 있게 열어 뒀습니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 댓글 아이디 — 자동 증가 / 자동 번호 |
| `post_id` | BIGINT UNSIGNED | 필수 | — | 댓글이 달린 글 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 댓글 작성자 아이디 |
| `parent_id` | BIGINT UNSIGNED | 허용 | — | 부모 댓글 아이디 — 대댓글일 때만 |
| `body` | VARCHAR(200) | 필수 | — | 댓글 내용 |
| `status` | ENUM('VISIBLE','HIDDEN','DELETED') | 필수 | `'VISIBLE'` | 댓글 상태 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 작성 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 댓글 수정 일시 / 수정 시 현재 시각으로 자동 갱신 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 — 소프트 삭제 |

- 기본키: `id`
- 조회 색인: `post_id`, `created_at`
- 외래키 `post_id` → `posts`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `parent_id` → `comments`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `reports` — 신고

운영 정책에 어긋나는 글·댓글을 신고한 기록(정책 제3조). 운영자가 확인해 숨김 처리하거나 기각합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 신고 아이디 — 자동 증가 / 자동 번호 |
| `reporter_id` | BIGINT UNSIGNED | 필수 | — | 신고한 사용자 아이디 |
| `target_type` | ENUM('POST','COMMENT') | 필수 | — | 신고 대상 종류 — 글 / 댓글 |
| `target_id` | BIGINT UNSIGNED | 필수 | — | 신고 대상 번호 — 글 또는 댓글 아이디 |
| `reason` | ENUM('ABUSE','FALSE_INFO','PRIVACY','AD_ILLEGAL','COPYRIGHT','OTHER') | 필수 | — | 신고 사유 — 욕설·허위·개인정보·광고/불법·저작권·기타 |
| `detail` | VARCHAR(200) | 허용 | — | 자세한 내용 |
| `status` | ENUM('RECEIVED','HIDDEN','DISMISSED') | 필수 | `'RECEIVED'` | 처리 상태 — 접수 / 숨김 처리 / 기각 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 신고 일시 |
| `handled_by` | BIGINT UNSIGNED | 허용 | — | 처리한 운영자 아이디 |
| `handled_at` | DATETIME | 허용 | — | 처리 일시 |

- 기본키: `id`
- 조회 색인: `target_type`, `target_id`
- 외래키 `reporter_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `handled_by` → `users`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**

#### `user_sanctions` — 이용 제한

운영 정책 위반에 따른 조치 기록(정책 제7조: 경고 → 게시 제한 → 이용 제한 → 이용 정지). 기간이 있는 제한은 ends_at 까지 적용됩니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 조치 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 조치 받은 사용자 아이디 |
| `sanction_type` | ENUM('WARNING','POST_RESTRICT','SUSPEND','BAN') | 필수 | — | 조치 종류 — 경고 / 게시 제한 / 이용 제한 / 정지 |
| `reason` | VARCHAR(200) | 필수 | — | 조치 사유 |
| `report_id` | BIGINT UNSIGNED | 허용 | — | 관련 신고 아이디 |
| `starts_at` | DATETIME | 필수 | — | 시작 일시 |
| `ends_at` | DATETIME | 허용 | — | 끝나는 일시 — 비우면 기간 없음(정지) |
| `created_by` | BIGINT UNSIGNED | 허용 | — | 조치한 운영자 아이디 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 기록 일시 |

- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `report_id` → `reports`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**
- 외래키 `created_by` → `users`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**

### 5. AI · 지도 · 공용 데이터

#### `ai_topics` — AI 분야

AI 화면의 분야 카드와 홈 AI 대화 칩의 목록(자유 질문·근처 탐색·분리배출·냉장고 요리·청소·계약·집주인 문자·공과금·지출 요약). 분야를 추가·숨기는 것은 이 표만 고치면 됩니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 분야 아이디 — 자동 증가 / 자동 번호 |
| `code` | VARCHAR(20) | 필수 | — | 분야 코드 — trash, cook, summary 등 |
| `name` | VARCHAR(30) | 필수 | — | 분야 이름 |
| `description` | VARCHAR(60) | 필수 | — | 분야 설명 — 카드에 보이는 한 줄 |
| `photo_supported` | TINYINT(1) | 필수 | `0` | 사진 첨부 지원 — 사진을 올리면 "추천" 표시 |
| `sort_order` | TINYINT UNSIGNED | 필수 | `0` | 정렬 순서 |
| `is_active` | TINYINT(1) | 필수 | `1` | 사용 여부 |

- 기본키: `id`
- 중복 불가: `code`

#### `uploaded_files` — 업로드 파일

커뮤니티 첨부파일 등의 이름·저장 주소·형식·크기를 보관합니다. 파일 원문은 별도 저장소에 둡니다. 실제 파일 삭제는 서버가 처리해야 합니다. 현재 AI 사진은 처리 후 보관하지 않으며 AI 메시지의 첨부 연결은 향후 확장용입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 파일 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 올린 사용자 아이디 |
| `original_name` | VARCHAR(255) | 필수 | — | 원래 파일 이름 |
| `storage_url` | VARCHAR(500) | 필수 | — | 저장 주소 — 파일 저장소 주소 |
| `mime_type` | VARCHAR(50) | 필수 | — | 파일 형식 — 예: image/jpeg |
| `size_bytes` | INT UNSIGNED | 필수 | — | 파일 크기 — 바이트 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 업로드 일시 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 |

- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `post_attachments` — 게시글 첨부파일 연결

게시글과 uploaded_files를 연결하고 표시 순서를 저장합니다. 파일 하나는 하나의 게시글에 연결되며, 같은 글 안의 표시 순서는 중복되지 않습니다. 최대 5개·합계 2MB와 파일 소유권은 서버에서 검사해야 합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 첨부한 게시글 아이디 |
| `file_id` | BIGINT UNSIGNED | 필수 | — | 업로드 파일 아이디 |
| `sort_order` | TINYINT UNSIGNED | 필수 | `0` | 게시글 안의 표시 순서 — 0부터 |

- 기본키: `post_id`, `file_id`
- 중복 불가: `file_id`
- 중복 불가: `post_id`, `sort_order`
- 외래키 `post_id` → `posts`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `file_id` → `uploaded_files`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `ai_conversations` — AI 대화

AI와의 대화 한 건(대화방). 홈의 "AI와 대화" 모달에서 시작한 대화와 AI 메뉴 화면에서 시작한 대화를 구분하고, "새 대화"를 누르면 새 줄이 생깁니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 대화 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 대화한 사용자 아이디 |
| `topic_id` | BIGINT UNSIGNED | 허용 | — | 대화 분야 아이디 — 분야를 고르고 시작했을 때 |
| `entry_point` | ENUM('HOME_MODAL','AI_PAGE') | 필수 | — | 시작한 곳 — 홈 모달 / AI 화면 |
| `title` | VARCHAR(100) | 허용 | — | 대화 제목 — 첫 질문 요약 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 대화 시작 일시 |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 마지막 대화 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `updated_at`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `topic_id` → `ai_topics`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**

#### `ai_messages` — AI 메시지

대화 안의 말풍선 한 개. 사용자가 보낸 말과 AI의 답을 순서대로 쌓습니다. "이번 달 지출 요약"처럼 카드로 보이는 답은 그때의 숫자를 card_data(JSON)에 같이 저장해 다시 열어도 같은 모습으로 보입니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 메시지 아이디 — 자동 증가 / 자동 번호 |
| `conversation_id` | BIGINT UNSIGNED | 필수 | — | 메시지가 속한 대화 아이디 |
| `role` | ENUM('USER','ASSISTANT') | 필수 | — | 보낸 쪽 — 사용자 / AI |
| `content` | TEXT | 필수 | — | 메시지 내용 |
| `card_type` | ENUM('SPEND_SUMMARY') | 허용 | — | 카드 종류 — 카드로 보이는 답일 때 |
| `card_data` | JSON | 허용 | — | 카드 내용 — 카드에 보이는 숫자. 예: {month,total,prevTotal,fixed,rows,top} |
| `attachment_id` | BIGINT UNSIGNED | 허용 | — | 첨부 파일 아이디 — 사진 첨부(선택) |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 작성 일시 |

- 기본키: `id`
- 조회 색인: `conversation_id`, `created_at`
- 외래키 `conversation_id` → `ai_conversations`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `attachment_id` → `uploaded_files`.`id`: 참조 대상 삭제 시 **연결값을 NULL로 변경**

#### `ai_usage_daily` — AI 하루 사용량

사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표. 실제 AI를 연결할 때 하루 한도를 걸거나 비용을 확인하는 데 씁니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 |
| `usage_date` | DATE | 필수 | — | 사용 날짜 |
| `question_count` | INT UNSIGNED | 필수 | `0` | 하루 질문 횟수 |

- 기본키: `user_id`, `usage_date`
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `trash_schedules` — 쓰레기 배출 일정

동네별 요일 배출표. 홈 쓰레기 카드, 쓰레기 화면의 요일표, 오른쪽 패널, 알림이 모두 이 표로 "오늘 무슨 쓰레기를 내놓는지"를 알려줍니다. 배출 없는 요일은 줄이 없습니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 배출일정 아이디 — 자동 증가 / 자동 번호 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 |
| `weekday` | TINYINT UNSIGNED | 필수 | — | 배출 요일 — 0=일 ~ 6=토 |
| `waste_type` | ENUM('GENERAL','RECYCLE','FOOD') | 필수 | — | 배출 종류 — 일반쓰레기 / 재활용 / 음식물 |
| `description` | VARCHAR(100) | 필수 | — | 배출 안내 — 예: 저녁 6시 ~ 자정, 종량제 봉투 사용 |

- 기본키: `id`
- 중복 불가: `region_id`, `weekday`, `waste_type`
- 외래키 `region_id` → `regions`.`id`: 참조 대상 삭제 시 **함께 삭제**

#### `place_categories` — 장소 분류

지도 화면의 칩(세탁방·편의점·약국·마트) 목록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 장소 분류 아이디 — 자동 증가 / 자동 번호 |
| `name` | VARCHAR(20) | 필수 | — | 장소 분류 이름 — 세탁방, 편의점 등 |
| `sort_order` | TINYINT UNSIGNED | 필수 | `0` | 정렬 순서 |

- 기본키: `id`
- 중복 불가: `name`

#### `places` — 주변 장소

지도 화면과 AI "근처 탐색"에 나오는 가게·시설. 이름·위치뿐 아니라 전화번호·영업시간·평점도 담을 수 있게 열어 뒀고, 공공데이터에서 가져온 장소는 source_id 로 원본과 연결합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 장소 아이디 — 자동 증가 / 자동 번호 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 장소 동네 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 장소 분류 아이디 |
| `name` | VARCHAR(60) | 필수 | — | 장소 이름 |
| `description` | VARCHAR(100) | 허용 | — | 장소 설명 — 예: 도보 약 3분 · 24시간 |
| `lat` | DECIMAL(9,6) | 필수 | — | 위도 |
| `lon` | DECIMAL(9,6) | 필수 | — | 경도 |
| `address` | VARCHAR(200) | 허용 | — | 주소 |
| `phone` | VARCHAR(20) | 허용 | — | 전화번호 |
| `open_hours` | VARCHAR(100) | 허용 | — | 영업시간 |
| `rating_avg` | DECIMAL(2,1) | 허용 | — | 평균 별점 — 리뷰로 계산 |
| `review_count` | INT UNSIGNED | 필수 | `0` | 리뷰 수 |
| `source` | ENUM('MANUAL','PUBLIC_DATA') | 필수 | `'MANUAL'` | 정보 출처 — 직접 입력 / 공공데이터 |
| `source_id` | VARCHAR(50) | 허용 | — | 원본 데이터 번호 — 공공데이터 원본 ID |
| `updated_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 정보 갱신 일시 / 수정 시 현재 시각으로 자동 갱신 |

- 기본키: `id`
- 조회 색인: `region_id`, `category_id`
- 외래키 `region_id` → `regions`.`id`: 참조 대상 삭제 시 **삭제 차단**
- 외래키 `category_id` → `place_categories`.`id`: 참조 대상 삭제 시 **삭제 차단**

#### `place_reviews` — 장소 리뷰

사용자가 장소에 남기는 별점과 한 줄 리뷰(확장 기능). 평균 별점과 리뷰 수는 이 표로 계산해 places 에 채웁니다. 한 사람이 한 장소에 하나만 남깁니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 리뷰 아이디 — 자동 증가 / 자동 번호 |
| `place_id` | BIGINT UNSIGNED | 필수 | — | 리뷰 받은 장소 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 리뷰 쓴 사용자 아이디 |
| `rating` | TINYINT UNSIGNED | 필수 | — | 별점 — 1~5 |
| `body` | VARCHAR(300) | 허용 | — | 리뷰 내용 |
| `created_at` | DATETIME | 필수 | `CURRENT_TIMESTAMP` | 작성 일시 |

- 기본키: `id`
- 중복 불가: `place_id`, `user_id`
- 외래키 `place_id` → `places`.`id`: 참조 대상 삭제 시 **함께 삭제**
- 외래키 `user_id` → `users`.`id`: 참조 대상 삭제 시 **함께 삭제**

### 집계용 VIEW

#### `v_monthly_income` — 월별 수입 합계

`incomes`를 사용자와 실제 수입 날짜의 연월로 묶어 금액을 합산합니다. 반환 컬럼은 `user_id`, `period_ym`, `total_amount`입니다. 해당 월 기록이 없으면 결과 행도 없습니다.

#### `v_monthly_spend_breakdown` — 월별 지출 구성

월별 월세, 공과금 합계, 기타 지출의 분류별 합계를 UNION ALL로 합칩니다. 반환 컬럼은 `user_id`, `period_ym`, `label`, `amount`입니다. 월세·공과금은 저장된 `period_ym`, 기타 지출은 `expense_date`의 연월을 사용합니다.

- `paid_at` 조건이 없으므로 **미납 월세·공과금도 집계**합니다.
- 월별 납부 행이 없으면 월세·공과금은 집계되지 않습니다. SQL에 월별 자동 생성 작업은 없습니다.
- 월세·공과금을 `expenses`에도 넣으면 중복 집계됩니다.
- SUM 결과 등 VIEW의 실제 SQL 타입은 원본 타입과 MySQL 표현식에서 결정되므로 고정 BIGINT라고 가정하지 않습니다.

## 5. DB 규칙과 서버에서 처리할 일

- **비밀번호·인증·토큰**: SQL에는 해시를 담을 컬럼이 있습니다. 해시 생성, 인증번호 전송, 만료·시도 횟수·일회 사용 검사는 서버가 수행합니다. 컬럼이 있다고 자동으로 검사되지는 않습니다.
- **가입·소셜 로그인**: 일반 가입 아이디는 필수로 검사합니다. 소셜 회원은 login_id가 NULL일 수 있습니다. API의 username은 login_id, 소문자 provider는 signup_provider의 대문자 값에 대응합니다.
- **휴대전화**: API의 하이픈을 제거한 숫자 문자열을 phone에 저장합니다. 인증 목적·번호·토큰이 요청과 일치하는지 확인하고 사용 완료를 기록해야 합니다.
- **비밀번호 찾기**: 현재 API는 휴대전화 인증 → password_resets(method=PHONE) 발급 → 새 비밀번호 저장 순서입니다. EMAIL은 SQL에서 허용하는 확장 경로이며 현재 메일 발송을 요구하지 않습니다.
- **아이디 찾기**: 닉네임과 휴대전화 인증을 확인한 뒤 users.login_id를 반환합니다. 소셜 회원처럼 아이디가 없는 경우의 응답도 서버에서 정해야 합니다.
- **약관·나이 확인**: 필수 약관 3종의 문서 ID별 동의 시각은 user_term_agreements에, 14세 확인은 users.age_confirmed_at에 기록합니다. 현재 필수 약관과 나이 확인이 모두 완료된 경우에만 agreedAt을 만들어 반환합니다. 약관 본문이 변경되면 새 버전 행을 추가하고 기존 이력을 보존합니다.
- **돈 단위**: user_settings.rent_amount만 만원 단위(55=55만원), rent_payments.amount와 나머지 금액은 원 단위입니다. 과거 월세는 당시 월별 기록 금액을 사용합니다.
- **금액·범위 검사**: UNSIGNED는 음수를 막지만 0원은 허용합니다. 양수 금액, 납부일 1~31, 별점 1~5, 요일 0~6, 연월 형식 등은 현재 별도 CHECK가 없으므로 서버 검사가 필요합니다.
- **가계부 분류**: 외래키는 분류의 존재만 검사합니다. incomes에는 INCOME, expenses에는 EXPENSE 분류인지 서버가 확인해야 합니다.
- **월별 청구 생성**: rent_payments와 bill_payments는 월별 행이 있어야 VIEW에 반영됩니다. 매달 시작·월 중 가입 시 중복 없이 생성하는 서버 작업이 필요합니다. SQL은 스케줄러나 생성 프로시저를 제공하지 않습니다.
- **게시글·댓글**: status와 deleted_at을 이용한 소프트 삭제를 지원합니다. 작성자·관리자 권한 검사는 서버가 수행하고, like_count·comment_count와 실제 행의 수가 일치하도록 관리해야 합니다.
- **파일**: DB에는 파일 메타데이터와 연결만 저장합니다. 최대 5개·합계 2MB, 소유권, 파일 형식은 서버에서 검사합니다. 글·회원·파일 메타데이터 삭제만으로 실제 저장소 파일이 삭제되지는 않습니다. AI 사진의 현재 보관 정책과 확장용 FK를 구분합니다.
- **회원 탈퇴**: users를 실제 삭제하면 연결된 개인 데이터가 CASCADE로 삭제됩니다. withdrawal_logs는 외래키 없이 남기도록 설계되어 있으며, 기록 삽입 자체는 서버가 수행해야 합니다. 공용 동네·분류·약관 등은 남습니다. 회원과 연결되지 않은 인증 기록은 별도 정리해야 합니다.
- **신고 대상**: reports.target_type과 target_id는 다형 참조이며 대상 글·댓글로 향하는 FK가 없습니다. 서버가 대상 존재 여부를 확인해야 합니다.
- **API ID**: BIGINT ID는 JavaScript 정밀도 문제를 피하도록 API에서 문자열로 전달하는 편이 좋습니다. API의 401·오류 message·포트·리다이렉트는 SQL이 아닌 서버 설정과 응답 처리 사항입니다.

## 6. 최신 API 약속과 현재 SQL의 차이

다음은 보내주신 최신 API 문서와 비교한 결과입니다. **이 README 수정으로 SQL이나 API 구현이 변경된 것은 아닙니다.**

| API 요구사항 | 현재 SQL | 남은 작업 |
|---|---|---|
| 할 일을 일정에 통합하고 done 사용 | todos와 events가 분리되어 있고 events에 is_done이 없음 | 날짜 없는 할 일의 처리 방식을 정하고 데이터 이전·일정 완료 컬럼을 별도 설계 |
| 경고·기간 정지·영구 정지 | user_sanctions의 WARNING·SUSPEND·BAN과 starts_at·ends_at으로 표현 가능 | API WARN을 WARNING으로 변환하고 허용 정지 기간을 서버에서 검사 |
| 정지 해제와 해제 이력 | 해제 시각·관리자·사유를 저장하는 전용 필드 없음 | 원래 정지 기간을 보존하면서 해제 이력을 남기도록 SQL 보완 필요 |
| 같은 닉네임·아이디·휴대전화의 재가입 차단 | 기존 아이디·휴대전화의 중복 제한만 존재. nickname은 UNIQUE가 아니며 제재는 회원 삭제 시 함께 삭제됨 | 차단 범위·식별 방식·보관 정책을 정하고 별도 설계 및 서버 검사 필요 |
| 정지 시 로그인·가입·글·댓글·좋아요 차단 | users.status와 user_sanctions는 저장 구조만 제공 | 각 API에서 유효한 정지 확인, 기간 만료·해제와 status 일관성 처리 |
| 관리자 회원 목록의 건수·history·until | users, posts, comments, user_sanctions 조회로 구성 가능 | 집계·필터·정렬 구현, 응답에 제재 요청에 사용할 회원 id 포함 |
| 게시글·댓글 수정·삭제와 첨부 | updated_at, status, deleted_at 및 파일 연결 테이블 있음 | 권한 검사·업로드 API·실제 저장소 정리 구현 |
| 쓰레기 요일표로 달력 표시 | trash_schedules에 동네·요일·종류별 기록 | 달력 표시용 데이터를 서버나 프론트에서 계산. events에 복제할 필요 없음 |
| 공과금·월세·지출 요약 | 월별 납부 기록과 VIEW로 표현 | 월별 행 생성과 과거 금액 조회를 연결. 현재 VIEW는 미납 금액도 포함 |
| 로그인 유지 | auth_sessions.remember 존재 | 요청 전달·토큰 또는 세션 수명 정책 연결. refresh token 전달·재발급 방식은 API 계약 추가 필요 |

## 7. 기본 데이터와 적용 범위

schema.sql은 테이블·VIEW 외에 다음 기본 데이터를 INSERT IGNORE로 추가합니다.

- 서울특별시와 구 11개, 일부 동네 간 이웃 관계
- 수입 분류 6개·기타 지출 분류 6개
- AI 분야 9개, 지도 장소 분류 4개
- 마포구 예시 배출 일정 6개
- 약관 3종: SERVICE·PRIVACY·POLICY, 버전 2026-10-18

배출 일정·지역 목록 등은 서비스 전체 지역을 포괄하는 실제 운영 데이터가 아니라 초기 예시입니다. 약관도 현재 프론트의 초안입니다. INSERT IGNORE는 같은 고유 키가 있으면 기존 행을 갱신하지 않으므로, 재실행만으로 기존 데이터가 새 내용으로 덮어써지지는 않습니다.
| 이름 | 타입 | 한글 이름 | 설명 |
|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 사용자 아이디 |  |
| `period_ym` | CHAR(7) | 연월 |  |
| `label` | VARCHAR(30) | 구성 이름 | 월세 / 공과금 / 식비 … |
| `amount` | BIGINT | 금액 합계 | 원 단위 |

## 5. 설계 규칙과 알아 둘 점

- **개인정보**: 비밀번호·인증번호·재설정 토큰·로그인 토큰은 **해시만** 저장합니다. 휴대전화는 숫자만 저장하고(`01012345678`), 실서비스에서는 암호화를 권장합니다.
- **인증 기록 정리**: `phone_verifications` 에는 휴대전화 번호가 들어 있으므로, 만료된 기록(가입 때처럼 사용자와 연결되지 않은 줄 포함)은 며칠 뒤 정기 작업으로 삭제합니다.
- **회원 탈퇴**: `users` 줄을 지우면 일정·할 일·가계부·글·AI 대화 등이 `ON DELETE CASCADE` 로 함께 지워집니다. 남기는 것은 `withdrawal_logs`(탈퇴했다는 사실과 시각만)뿐입니다.
- **돈 단위**: 금액은 모두 **원 단위 정수**입니다. 단, `user_settings.rent_amount` 는 화면 입력과 같이 **만원 단위**(55 = 55만원)이고 `rent_payments.amount` 는 원 단위(550000)입니다.
- **월세·공과금 행 만들기**: 홈 도넛과 AI 지출 요약이 월세·공과금을 포함하려면 달마다 행이 있어야 합니다. 매달 1일에 `rent_payments`, `bill_payments` 를 미납(`paid_at` 비움)으로 미리 만드는 작업이 필요합니다.
- **비밀번호 찾기(두 방식 모두 한 표로)**: 1회용 재설정 토큰은 `password_resets` 한 곳에 둡니다. **휴대전화 방식**(HTML 시안)은 `phone_verifications` 인증 통과 → `password_resets(method=PHONE)` → 바로 새 비밀번호, **이메일 방식**(React 앱의 현재 구현)은 `password_resets(method=EMAIL)` 토큰 링크를 메일로 보내고 링크에서 새 비밀번호를 정합니다. 어느 쪽을 쓸지는 팀이 정하면 되고, 표는 그대로입니다.
- **아이디 찾기**: 별도 표 없이 `users` 에서 찾습니다. 시안은 닉네임 + 휴대전화 인증(아이디를 그대로 보여줌), React 앱은 닉네임 + 주소(일부를 가려서 보여줌)로 찾습니다.
- **약관**: 이용약관·운영 정책은 "동의", 개인정보 처리방침은 "안내 확인"으로 받습니다(`terms_documents.consent_kind`). 약관이 바뀌면 새 버전 줄을 추가하고 동의 이력은 그대로 둡니다.
- **글·댓글 삭제**: `status` 와 `deleted_at` 으로 숨기는(소프트 삭제) 방식이라 신고 처리 기록이 남습니다.
- **미리 열어 둔 확장 칸**: 장소의 전화번호·영업시간·평점·리뷰, 공공데이터 연결(`source`, `source_id`), 대댓글(`comments.parent_id`)은 지금 화면에는 없지만 나중에 쓸 수 있게 열어 둔 것입니다.
- **가입 동의 4가지**: React 가입의 필수 체크 4개는 서비스 이용약관 · 개인정보 처리방침(안내 확인) · 커뮤니티·AI 운영 정책 · 만 14세 이상입니다. 앞의 셋은 `user_term_agreements`(약관 문서 버전 포함)에, 만 14세 확인은 `users.age_confirmed_at` 에 남깁니다. 소셜로 처음 들어온 사람은 동의가 없는 상태(`agreedAt` 이 null)라서 `user_term_agreements` 줄이 없으면 동의 화면(/welcome)을 띄웁니다.
- **옛 설계와 달라진 점**: 로그인 아이디(`login_id`)·휴대전화·인증 표 추가, 약관 문서·동의 이력 추가, 가계부(분류·수입·지출)와 집계 VIEW 추가, 일정에 수정 일시·등록 경로 추가, 알림에 종류와 읽음 시각 정리, 신고·이용 제한 추가, AI 분야·카드 저장(JSON)·사진 파일 표 정리, 장소에 전화·영업시간·별점 추가, 쓰레기 배출표를 동네별로 분리.

## 6. 현재 프로그램(HTML 시안 + React 앱)과 맞춘 결과

이 설계를 시안(`variants/`)과 React 앱(`frontend/`)의 실제 데이터 모양과 하나씩 비교해 점검한 기록입니다.

**그대로 맞는 것**
- 할 일, 일정(날짜·시간·제목), 수입·기타 지출(날짜·분류·금액·메모), 커뮤니티 글(동네·분류·제목·본문·좋아요·댓글), 쓰레기 배출표, 지도 장소(이름·설명·위도·경도)
- 로그인 아이디·이메일 둘 다로 로그인(`users.login_id`, `users.email` 모두 중복 불가), 소셜 로그인(`social_accounts`), 휴대전화 인증, 약관 버전별 동의
- AI 지출 요약 카드의 숫자 스냅샷(`ai_messages.card_data`)

**이번 점검에서 고친 것**
- `users.age_confirmed_at`: React 가입의 필수 항목 "만 14세 이상" 확인 기록 추가
- `users.signup_provider`: 화면의 `provider`(이메일/카카오/구글/네이버) 값을 바로 줄 수 있게 추가
- `user_settings.move_in_ym`, `contract_end_ym`: 오른쪽 패널의 "거주 N개월 / 계약 N개월 남음" 계산에 쓰는 값 추가
- `password_resets`: 비밀번호 재설정 토큰을 한 표로 분리해, 휴대전화 방식과 이메일 방식을 모두 처리
- `phone_verifications`: 재설정 토큰 칸을 빼고, 가입에 함께 보내는 "인증 완료 값"(`verified_token_hash`)으로 정리
- 표마다 **사용 상태**(지금 화면이 쓰는 데이터 / 서버를 붙일 때 필요 / 확장)를 표시하고, 그림의 표 머리 색으로도 구분

**알아 둘 차이 (설계 문제는 아니지만 맞춰야 할 것)**
- **공과금**: 화면은 "이번 달 목록" 하나만 가지고 새 달에 "새 달 시작"으로 미납 처리합니다. DB는 항목(`bill_items`)과 월별 납부(`bill_payments`)로 나눠서 지난 달 기록이 남습니다. 서버를 붙일 때 화면의 "새 달 시작"은 새 달 납부 행을 만드는 동작으로 바꿉니다.
- **알림**: 화면은 일정·배출·월세로 그때그때 계산하고 읽음 표시만 저장합니다. DB의 `notifications` 는 서버가 알림을 미리 만들어 둘 때를 위한 표입니다.
- **사진**: 화면은 사진을 저장하지 않고 AI 화면으로 넘기기만 합니다. `uploaded_files` 는 서버에 저장할 때 필요합니다.
- **찾기 흐름**: HTML 시안과 React 앱 모두 휴대전화 인증 → 재설정 토큰 → 바로 새 비밀번호, 아이디는 그대로 표시하는 방식으로 맞췄습니다 (`password_resets.method = PHONE`).
- **React 쪽 문서**: `frontend/API.md` 를 이 `schema.sql`(2026-10-21) 기준으로 다시 정리했습니다. 영역별 API 주소·요청·응답과 DB 표 대응, DB와 아직 안 맞는 곳(`events` 완료 칸, 탈퇴 후 재가입 막기 등)이 들어 있습니다.

# ZIP 데이터베이스 설계

Git 공개 전 확인 사항과 검토 범위는 [보안 검토 문서](SECURITY.md)를 참고하세요. 실제 사용자 데이터·DB 백업·인증정보는 저장소에 포함하지 않습니다.

**2026-10-31 기준** [schema.sql](schema.sql)은 현재 프로젝트의 React 데이터 모델과 [백엔드 API 약속](../frontend/API.md)을 반영한 MySQL **8.0.16 이상** 설계입니다. 테이블 **41개**, 집계 VIEW **2개**입니다. 서버 API는 별도 구현 대상이며, 브라우저에 저장된 데이터가 이 SQL만으로 DB에 들어오지는 않습니다.

## 1. 이번에 반영한 변경

| 기능 | DB 반영 |
|---|---|
| 일정에 할 일 통합 | todos 제거, events.is_done·done_at 추가 |
| 일정 카테고리·항목 버튼 | event_categories·event_presets, events.category_id |
| 메모·홈 메모 순서 | memos, user_settings.home_memo_ids |
| 프로필 사진·캐릭터·소개 | user_profiles (회원당 한 행) |
| 지도 즐겨찾기·칩·검색어 | place_favorites, 설정의 map_categories·map_keywords |
| 동네 인증·집 위치 | users.region_verified_at·home_lat·home_lon |
| 고정 지출 태그 | bill_items.tag: 공과금·통신·구독·관리비·기타 |
| 고정·기타 수입 | incomes.income_type: FIXED·OTHER, 수입 분류 4개 추가 |
| 알림 삭제 | notifications.deleted_at |
| AI 사용 방법 | guide 주제, ai_messages.card_type에 LINK 추가 |
| 경고 확인·정지 해제 | user_sanctions.seen_at·revoked_at·revoked_by·revoke_reason |
| 탈퇴 후 재가입 차단 | banned_identities에 식별값 HMAC와 차단 기간 보관 |
| 고객센터 문의·답변 | support_inquiries, 문의당 관리자 답변 하나 |
| 기념일·매년 반복 | events.is_anniv·is_yearly (20261101_event_anniversary.sql) |
| 장소 분류 확대 | place_categories.icon, 15개 분류 기본 데이터 |

현재 frontend/API.md는 10월 25일 문서이므로 DB에 없다고 적힌 항목은 이 설계로 보완했습니다. 그 이후 코드에 추가된 고정·기타 수입과 고객센터도 포함합니다. React 코드는 변경하지 않았습니다.

## 2. 적용 방법

### 새 DB

프로젝트 최상위 폴더에서 실행합니다. 현재 데이터베이스에 적용한 결과가 아니라 **새 DB 생성용 파일**입니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/schema.sql"
```

### 기존 DB

기존 2026-10-21 설계(35개 테이블)를 적용했다면 [마이그레이션](migrations/20261031_current_project.sql)을 사용합니다. [적용 및 확인 안내](migrations/README.md)를 먼저 확인하세요. 데이터 백업 및 쓰기 중단 후 **한 번만** 적용합니다. CREATE TABLE IF NOT EXISTS는 기존 컬럼을 변경하지 않으며, MySQL DDL은 파일 전체를 자동 롤백하지 않습니다.

기존 todos는 events로 이전하고 todos_legacy_20261031로 이름을 바꿔 보관합니다. 따라서 기존 DB에는 **현행 41개 + 보관용 1개** 테이블이 있습니다. 원본에 일정 날짜가 없으므로 등록 날짜를 사용하며, 이는 실제 예정일을 복원한 값이 아닙니다. 완료 여부·완료 시각은 보존합니다.

### 가입 시 초기 데이터

[일정 기본 데이터](seeds/event_defaults.sql)는 현재 회원들에 기본 카테고리 5개+미분류와 항목 30개를 복사합니다. 새 DB 생성 직후에는 회원이 없으므로 자동으로 개인 행을 만들지 않습니다.

서버의 가입 트랜잭션에서 해당 SQL의 SELECT를 **새 회원 ID로 제한**하여 user_settings·user_profiles 생성과 함께 실행하세요. 전체 회원에 반복 실행하면 사용자가 이름을 바꾸거나 지운 기본 항목이 다시 생길 수 있으므로 초기화용으로만 사용합니다.

## 3. 화면과 DB 연결 규칙

### 일정과 카테고리

- 카테고리는 사용자별로 관리합니다. 같은 회원 안에서 이름은 중복되지 않습니다. system_key=UNCATEGORIZED인 행은 미분류이며 서버에서 이름 변경·삭제를 막습니다.
- events.category_id가 NULL이면 API의 category는 미분류입니다. event_presets는 미분류를 포함한 실제 카테고리 행에 연결합니다.
- API가 보내는 category 이름은 로그인한 회원의 카테고리 ID로 변환합니다. 다른 회원의 카테고리·파일·메모를 연결하지 않도록 서버에서 검사합니다.
- 카테고리 이름 변경은 JOIN 결과에 자동 반영됩니다. 삭제는 **트랜잭션으로 일정의 category_id를 NULL 처리 → 미분류와 같은 제목인 항목 중복 정리 → 나머지 항목을 미분류로 이동 → 카테고리 삭제** 순서입니다. 카테고리를 바로 DELETE하면 연결된 항목은 FK CASCADE로 삭제되므로 서비스에서 반드시 먼저 옮깁니다.
- 기본 항목은 is_custom=0, 직접 입력한 항목은 1입니다. 직접 입력 시 같은 카테고리·제목 버튼은 UNIQUE 키로 중복을 막고 일정은 별도로 생성합니다. 항목 수정·삭제는 이미 등록한 일정 제목·날짜에 영향을 주지 않습니다.
- 동일 날짜·제목·카테고리 일정의 중복 추가는 API에서 검사합니다. 기존 일정 자료를 보존하기 위해 해당 조합에 UNIQUE 제약은 추가하지 않았습니다.
- 완료 시 is_done=1과 done_at을 함께 저장하고, 완료 해제 시 done_at=NULL로 바꿉니다. 쓰레기 배출 일정은 events에 복제하지 않고 요일표로 계산합니다.
- 기념일은 is_anniv=1인 일정입니다. 제목에는 API가 붙이는 "🎉 " 접두어가 포함될 수 있고, is_yearly=1이면 한 행만 저장하고 화면에서 매년 날짜로 펼칩니다. 기념일은 완료 처리 대상이 아니며 남은 일 수에서 제외합니다.

### 메모·지도·프로필

- 메모 items는 [{text,done}] 배열이며 본문 최대 5000자, 항목 text 최대 100자는 서버가 검사합니다. body를 생략한 POST는 빈 문자열로 저장합니다.
- home_memo_ids는 **문자열 ID 배열**, 최대 3개이며 순서를 보존합니다. NULL은 자동 선택, []는 명시적으로 선택한 메모 없음입니다. 소유권 검사와 삭제된 메모 ID 정리는 서버 책임입니다.
- map_categories와 map_keywords는 각각 문자열 배열입니다. NULL이면 API가 기본 4개 분류 및 빈 검색어 배열을 반환합니다. API의 {categories,keywords}로 조합합니다.
- 프로필 필드를 users에 직접 넣는 API 문서의 제안 대신 **user_profiles**로 분리했습니다. /auth/me에서 LEFT JOIN하고 avatar_file_id를 uploaded_files.storage_url로 변환해 bio·avatarUrl·avatarEmoji·avatarColor를 반환합니다. 사진→캐릭터→기본 표시 우선순위는 화면과 동일합니다.
- 주소가 바뀌면 집 좌표를 재계산합니다. 동네 인증 위치는 집 위치와 다를 수 있으므로 인증 좌표를 집 위치로 자동 간주하지 않습니다. 동네 변경 시 region_verified_at=NULL, 30일 경과 시 API에서 인증 무효로 판단합니다.

### 가계부·알림·AI

- 월세 설정만 만원 단위이며 나머지 금액은 원 단위입니다. 고정 지출의 현재 기본 금액과 월별 기록 금액을 구분합니다.
- incomes.income_type은 API의 incomeType fixed/other를 FIXED/OTHER로 변환합니다. 월별 수입 VIEW는 두 종류 전체를 합산합니다. 종류별 조회는 incomes를 필터링합니다.
- 월별 지출 VIEW는 고정 지출의 모든 태그를 기존 계약대로 **공과금** 라벨에 합산합니다. 화면의 공과금 전용 합계는 bill_items.tag='공과금'으로 별도 필터링합니다. VIEW는 미납 금액도 포함합니다.
- deleted_at이 있는 알림은 목록·미확인 개수에서 제외하고 재생성하지 않아야 합니다. 홈에서 하루만 숨기는 상태는 기존처럼 브라우저에서 관리합니다.
- AI LINK 카드의 card_data는 {label,to}입니다. to는 API 문서에 나열된 앱 내부 경로만 허용합니다. 사진은 처리 후 보관하지 않으며 attachment_id는 현재 NULL로 둡니다.

### 제재·탈퇴·고객센터

- 경고 확인은 seen_at에 저장합니다. 조기 해제는 **원래 ends_at을 유지**하고 revoked_at·revoked_by·revoke_reason을 기록합니다. API 문서의 ends_at 덮어쓰기 제안과 다른 점이며, 유효 정지는 시작·종료 시각과 revoked_at을 함께 검사해야 합니다.
- banned_identities는 로그인 ID·닉네임·휴대전화 각각을 정규화한 뒤 서버 비밀키 기반 HMAC-SHA256으로 저장합니다. SQL에서 임의 키나 단순 SHA 해시를 생성하지 않습니다. 차단 키 버전도 저장합니다.
- 제재 시 차단 행들을 함께 만들고 해제 시 관련 행을 함께 해제해야 합니다. 탈퇴 시 회원·제재 FK만 NULL로 바뀌어 차단 해시는 남습니다. 제재 원문 이력은 회원 삭제 시 CASCADE되지만 활성 차단 식별값은 보존됩니다. 만료 행 정리는 서버 작업입니다.
- **기존 제재의 HMAC 채우기는 마이그레이션에 포함하지 않았습니다.** 서버 키로 별도 이관한 뒤 탈퇴를 허용해야 기존 정지자의 재가입 차단이 유지됩니다. 닉네임만 같은 다른 사용자의 차단 가능성은 현재 API 요구사항에 따른 정책입니다.
- 고객센터는 본인 문의만 조회하고 ADMIN만 전체 조회·답변합니다. 제목 1~100자, 문의·답변 1~3000자와 유형을 검증합니다. 답변은 UPDATE ... WHERE answered_at IS NULL로 원자적으로 저장해 중복 답변을 막습니다. nickname은 users에서 조회하고 답변 대기/완료는 answered_at으로 계산합니다.
- 날씨는 현재 코드에서 외부 API 조회 및 캐시를 사용하므로 별도 영구 저장 테이블을 추가하지 않았습니다.

## 4. 테이블 한눈에 보기

| 테이블 | 역할 |
|---|---|
| `regions` | 동네 |
| `region_neighbors` | 이웃 동네 |
| `users` | 회원 |
| `social_accounts` | 소셜 계정 |
| `auth_sessions` | 로그인 세션 |
| `phone_verifications` | 휴대전화 인증 |
| `password_resets` | 비밀번호 재설정 |
| `terms_documents` | 약관 원문 |
| `user_term_agreements` | 약관 동의 이력 |
| `withdrawal_logs` | 탈퇴 기록 |
| `user_settings` | 개인 설정 |
| `event_categories` | 일정 카테고리 |
| `event_presets` | 빠른 일정 항목 |
| `events` | 일정 및 할 일 |
| `memos` | 메모와 체크리스트 |
| `bill_items` | 고정 지출 항목 |
| `bill_payments` | 월별 고정 지출 |
| `rent_payments` | 월별 월세 |
| `notifications` | 알림 |
| `ledger_categories` | 가계부 분류 |
| `incomes` | 수입 |
| `expenses` | 기타 지출 |
| `posts` | 게시글 |
| `post_likes` | 좋아요 |
| `comments` | 댓글 |
| `reports` | 신고 |
| `user_sanctions` | 경고 및 정지 |
| `banned_identities` | 재가입 차단 식별값 |
| `support_inquiries` | 고객센터 문의 및 답변 |
| `ai_topics` | AI 주제 |
| `uploaded_files` | 업로드 파일 |
| `user_profiles` | 프로필 |
| `post_attachments` | 게시글 첨부 연결 |
| `ai_conversations` | AI 대화방 |
| `ai_messages` | AI 메시지 |
| `ai_usage_daily` | AI 하루 사용량 |
| `trash_schedules` | 쓰레기 배출 요일표 |
| `place_categories` | 장소 분류 |
| `places` | 장소 |
| `place_favorites` | 장소 즐겨찾기 |
| `place_reviews` | 장소 리뷰 |

## 5. 전체 컬럼과 제약조건

필수는 NOT NULL, 허용은 NULL입니다. 타입·기본값·키는 현재 SQL 정의를 기준으로 정리했습니다. 복합 UNIQUE는 열 조합의 중복을 제한하며 NULL의 의미는 MySQL 규칙을 따릅니다.

### `regions` — 동네

동네: 시·도와 구·군 같은 "동네" 목록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 — 자동 증가 / 자동 번호 |
| `parent_id` | BIGINT UNSIGNED | 허용 | — | 상위 동네 아이디 — 시·도 → 구·군 |
| `name` | VARCHAR(30) | 필수 | — | 동네 이름 — 예: 마포구 |
| `level` | TINYINT UNSIGNED | 필수 | — | 동네 단계 — 1=시·도, 2=구·군 |

- 기본키: `id`
- 중복 불가: `parent_id`, `name`
- 외래키 `parent_id` → `regions`.`id`: RESTRICT

### `region_neighbors` — 이웃 동네

주변 동네: 어느 동네가 어느 동네와 이웃한지 적어 둔 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 |
| `neighbor_region_id` | BIGINT UNSIGNED | 필수 | — | 주변 동네 아이디 — 이웃한 동네 |

- 기본키: `region_id`, `neighbor_region_id`
- 외래키 `region_id` → `regions`.`id`: CASCADE
- 외래키 `neighbor_region_id` → `regions`.`id`: CASCADE

### `users` — 회원

사용자: 가입한 사람 한 명당 한 줄.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 — 자동 증가 / 자동 번호 |
| `login_id` | VARCHAR(16) | 허용 | — | 로그인 아이디 — 일반 가입은 6~16자 영문 소문자·숫자 필수, 소셜 가입은 NULL 허용 |
| `password_hash` | VARCHAR(100) | 허용 | — | 비밀번호(해시) — 원문은 저장 안 함. 소셜 가입자는 비어 있음 |
| `nickname` | VARCHAR(12) | 필수 | — | 닉네임 — 2~12자, 앱 인사말에 쓰임 |
| `email` | VARCHAR(100) | 허용 | — | 이메일 |
| `phone` | VARCHAR(11) | 허용 | — | 휴대전화 — 구분 기호 없이 숫자만 저장 |
| `phone_verified_at` | DATETIME | 허용 | — | 휴대전화 인증 일시 — 가입 때 인증을 마친 시각 |
| `region_id` | BIGINT UNSIGNED | 허용 | — | 사는 동네 아이디 — 내 정보의 "우리 동네" |
| `address` | VARCHAR(200) | 허용 | — | 입력한 주소 — 가입할 때 쓴 주소 글자 |
| `age_confirmed_at` | DATETIME | 허용 | — | 만 14세 이상 확인 일시 — 가입 때 "만 14세 이상" 체크한 시각 |
| `signup_provider` | ENUM('EMAIL','KAKAO','GOOGLE','NAVER') | 필수 | 'EMAIL' | 가입 경로 — 화면의 provider 값. 소셜 첫 가입자는 약관·주소를 나중에 받음 |
| `role` | ENUM('USER','ADMIN') | 필수 | 'USER' | 사용자 권한 — 운영자만 ADMIN |
| `status` | ENUM('ACTIVE','SUSPENDED') | 필수 | 'ACTIVE' | 이용 상태 — 이용 제한 중이면 SUSPENDED |
| `password_changed_at` | DATETIME | 허용 | — | 비밀번호 변경 일시 — 내 정보·비밀번호 찾기로 바꾼 시각 |
| `last_login_at` | DATETIME | 허용 | — | 마지막 로그인 일시 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 가입 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 정보 수정 일시 / 수정 시 자동 갱신 |
| `region_verified_at` | DATETIME | 허용 | — | 동네 인증 일시 — 30일 유효, 동네 변경 시 NULL로 초기화 |
| `home_lat` | DECIMAL(9,6) | 허용 | — | 집 위치 위도 — 주소를 좌표로 변환한 값 |
| `home_lon` | DECIMAL(9,6) | 허용 | — | 집 위치 경도 — 주소를 좌표로 변환한 값 |

- 기본키: `id`
- 중복 불가: `login_id`
- 중복 불가: `email`
- 중복 불가: `phone`
- 외래키 `region_id` → `regions`.`id`: SET NULL

### `social_accounts` — 소셜 계정

소셜 로그인 계정: 카카오·구글·네이버로 로그인한 사용자가 어느 소셜 계정인지 연결해 두는 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 소셜계정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 연결된 사용자 아이디 |
| `provider` | ENUM('KAKAO','GOOGLE','NAVER') | 필수 | — | 소셜 서비스 |
| `provider_user_id` | VARCHAR(100) | 필수 | — | 소셜 서비스 사용자 번호 — 소셜 쪽에서 준 고유 번호 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 연결 일시 |

- 기본키: `id`
- 중복 불가: `provider`, `provider_user_id`
- 중복 불가: `user_id`, `provider`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `auth_sessions` — 로그인 세션

로그인 세션: 로그인한 기기마다 한 줄.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 세션 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 로그인한 사용자 아이디 |
| `refresh_token_hash` | CHAR(64) | 필수 | — | 재발급 토큰(해시) — 원문은 저장 안 함 |
| `remember` | TINYINT(1) | 필수 | 0 | 로그인 유지 여부 — 로그인 창의 "로그인 유지" 체크 |
| `user_agent` | VARCHAR(255) | 허용 | — | 접속 기기 정보 — 브라우저 이름 등 |
| `ip_address` | VARCHAR(45) | 허용 | — | 접속 IP |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 로그인 일시 |
| `expires_at` | DATETIME | 필수 | — | 만료 일시 |
| `revoked_at` | DATETIME | 허용 | — | 로그아웃(무효) 일시 — 비어 있으면 아직 유효 |

- 기본키: `id`
- 중복 불가: `refresh_token_hash`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `phone_verifications` — 휴대전화 인증

휴대전화 인증: 문자로 보낸 인증번호 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 인증 아이디 — 자동 증가 / 자동 번호 |
| `purpose` | ENUM('SIGNUP','FIND_ID','RESET_PASSWORD') | 필수 | — | 인증 목적 — 가입 / 아이디 찾기 / 비밀번호 찾기 |
| `phone` | VARCHAR(11) | 필수 | — | 인증받는 휴대전화 — 숫자만 |
| `user_id` | BIGINT UNSIGNED | 허용 | — | 대상 사용자 아이디 — 찾기일 때만 채움(가입 때는 비움). 탈퇴하면 함께 삭제 |
| `code_hash` | CHAR(64) | 필수 | — | 인증번호(해시) — 6자리 번호를 해시로 저장 |
| `attempt_count` | TINYINT UNSIGNED | 필수 | 0 | 틀린 횟수 — 횟수가 넘으면 잠금 |
| `requested_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 인증번호 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 인증번호 만료 일시 — 보통 3분 |
| `verified_at` | DATETIME | 허용 | — | 인증 성공 일시 |
| `verified_token_hash` | CHAR(64) | 허용 | — | 인증 완료 값(해시) — 인증 성공 때 발급. 가입·찾기 요청에 함께 보내는 값 |
| `consumed_at` | DATETIME | 허용 | — | 사용 일시 — 인증 완료 값을 가입·재설정에 쓴 시각(한 번만 사용) |

- 기본키: `id`
- 중복 불가: `verified_token_hash`
- 조회 색인: `phone`, `requested_at`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `password_resets` — 비밀번호 재설정

비밀번호 재설정 토큰: 비밀번호를 다시 정하도록 허락하는 1회용 토큰.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 재설정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 재설정하는 사용자 아이디 |
| `method` | ENUM('PHONE','EMAIL') | 필수 | — | 본인 확인 방법 — 휴대전화 인증 / 이메일 링크 |
| `token_hash` | CHAR(64) | 필수 | — | 재설정 토큰(해시) — 원문은 저장 안 함 |
| `requested_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 만료 일시 — 보통 10~30분 |
| `used_at` | DATETIME | 허용 | — | 사용 일시 — 비어 있으면 아직 안 씀 |

- 기본키: `id`
- 중복 불가: `token_hash`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `terms_documents` — 약관 원문

약관 문서: 가입 화면에 보이는 약관의 본문과 버전.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 약관 아이디 — 자동 증가 / 자동 번호 |
| `doc_type` | ENUM('SERVICE','PRIVACY','POLICY') | 필수 | — | 약관 종류 — 이용약관 / 개인정보 처리방침 / 운영 정책 |
| `version` | VARCHAR(20) | 필수 | — | 약관 버전 — frontend LEGAL_VERSION과 동일 (예: 2026-10-18) |
| `title` | VARCHAR(100) | 필수 | — | 약관 제목 |
| `content` | MEDIUMTEXT | 필수 | — | 약관 본문 — 조항 전체 |
| `consent_kind` | ENUM('AGREE','CONFIRM') | 필수 | — | 받는 방식 — 동의(이용약관·운영정책) / 안내 확인(개인정보 처리방침) |
| `is_required` | TINYINT(1) | 필수 | 1 | 필수 여부 — 필수면 체크해야 가입 가능 |
| `effective_at` | DATETIME | 필수 | — | 시행 일시 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |

- 기본키: `id`
- 중복 불가: `doc_type`, `version`

### `user_term_agreements` — 약관 동의 이력

약관 동의 이력: 누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 동의 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 동의한 사용자 아이디 |
| `terms_id` | BIGINT UNSIGNED | 필수 | — | 동의한 약관 아이디 |
| `agreed_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 동의 일시 |

- 기본키: `id`
- 중복 불가: `user_id`, `terms_id`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `terms_id` → `terms_documents`.`id`: RESTRICT

### `withdrawal_logs` — 탈퇴 기록

회원 탈퇴 기록: 탈퇴가 있었다는 사실만 남기는 표(통계·문의 대응용).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 탈퇴기록 아이디 — 자동 증가 / 자동 번호 |
| `former_user_id` | BIGINT UNSIGNED | 필수 | — | 탈퇴한 사용자 번호 — 이미 지워진 번호(연결 없음) |
| `withdrawn_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 탈퇴 일시 |

- 기본키: `id`

### `user_settings` — 개인 설정

사용자 설정: 내 정보 화면의 설정값(월세·월세 납부일·입주한 달·계약 끝나는 달·알림 수신).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 |
| `rent_amount` | INT UNSIGNED | 필수 | 0 | 월세 금액 — 만원 단위 (55 = 55만원) |
| `rent_day` | TINYINT UNSIGNED | 필수 | 15 | 월세 납부일 — 매월 며칠 (1~31) |
| `move_in_ym` | CHAR(7) | 허용 | — | 입주한 달 — 오른쪽 패널의 "거주 N개월" 계산 (예: 2026-02) |
| `contract_end_ym` | CHAR(7) | 허용 | — | 계약 끝나는 달 — "계약 N개월 남음" 계산 |
| `noti_on` | TINYINT(1) | 필수 | 1 | 알림 수신 여부 — 끄면 빨간 점·알림을 숨김 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 설정 수정 일시 / 수정 시 자동 갱신 |
| `home_memo_ids` | JSON | 허용 | — | 홈 메모 ID 문자열 배열 — NULL은 자동, 최대 3개, 배열 순서로 표시 |
| `map_categories` | JSON | 허용 | — | 지도에 표시할 장소 분류 이름 배열 — NULL은 기본 4개 |
| `map_keywords` | JSON | 허용 | — | 지도에서 직접 추가한 검색어 배열 — NULL은 없음 |

- 기본키: `user_id`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `event_categories` — 일정 카테고리

사용자별 일정 카테고리

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 고유 번호 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `name` | VARCHAR(20) | 필수 | — | 일정 카테고리 이름 |
| `ico` | VARCHAR(20) | 필수 | '📌' | 카테고리 그림 |
| `system_key` | ENUM('UNCATEGORIZED') | 허용 | — | 미분류 식별값 — 이름 변경 및 삭제 불가 |
| `sort_order` | INT | 필수 | 0 | 표시 순서 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 중복 불가: `user_id`, `name`
- 중복 불가: `user_id`, `system_key`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `event_presets` — 빠른 일정 항목

카테고리 아래의 기본 및 사용자 일정 항목 버튼

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 고유 번호 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 같은 사용자 소유 카테고리 번호 |
| `title` | VARCHAR(60) | 필수 | — | 빠른 일정 항목 이름 |
| `is_custom` | TINYINT(1) | 필수 | 1 | 직접 만든 항목이면 1, 기본 항목이면 0 |
| `sort_order` | INT | 필수 | 0 | 카테고리 안 표시 순서 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 중복 불가: `category_id`, `title`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `category_id` → `event_categories`.`id`: CASCADE

### `events` — 일정 및 할 일

일정: 마이페이지 "일정" 탭의 달력과 일정 목록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 일정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 일정 주인 아이디 |
| `title` | VARCHAR(60) | 필수 | — | 일정 제목 |
| `event_date` | DATE | 필수 | — | 일정 날짜 |
| `event_time` | TIME | 허용 | — | 일정 시간 — 비우면 종일 |
| `source` | ENUM('USER','RENT') | 필수 | 'USER' | 등록 경로 — 직접 입력 / 월세 납부일 자동 등록 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 — 일정 수정 기능이 갱신 / 수정 시 자동 갱신 |
| `category_id` | BIGINT UNSIGNED | 허용 | — | 일정 카테고리 번호 — NULL은 미분류 |
| `is_done` | TINYINT(1) | 필수 | 0 | 할 일 완료 여부 |
| `done_at` | DATETIME | 허용 | — | 완료 일시 — 완료 해제 시 NULL |
| `is_anniv` | TINYINT(1) | 필수 | 0 | 기념일 여부 — 1이면 완료 체크 없이 D-day로 표시 |
| `is_yearly` | TINYINT(1) | 필수 | 0 | 매년 반복 여부 — 기념일일 때만 사용 |

- 외래키 `category_id` → `event_categories`.`id`: SET NULL
- 기본키: `id`
- 조회 색인: `user_id`, `event_date`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `memos` — 메모와 체크리스트

글 메모 및 체크리스트

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 고유 번호 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `title` | VARCHAR(60) | 필수 | '' | 메모 제목 — 빈 제목 허용 |
| `body` | TEXT | 필수 | — | 글 메모 내용 — API에서 생략 시 빈 문자열, 최대 5000자 |
| `color` | ENUM('노랑','분홍','하늘','초록','보라','흰색') | 필수 | '노랑' | 메모 색 |
| `is_pinned` | TINYINT(1) | 필수 | 0 | 목록 상단 고정 여부 |
| `is_checklist` | TINYINT(1) | 필수 | 0 | 체크리스트 여부 |
| `items` | JSON | 필수 | (JSON_ARRAY()) | 체크 항목 배열 — 각 항목은 text와 done, text 최대 100자 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `is_pinned`, `updated_at`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 검사: CONSTRAINT `ck_memos_items_array` CHECK (JSON_TYPE(`items`) = 'ARRAY')

### `bill_items` — 고정 지출 항목

공과금 항목: 내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 공과금 주인 아이디 |
| `name` | VARCHAR(30) | 필수 | — | 공과금 이름 — 가스, 전기, 수도 등 |
| `default_amount` | INT UNSIGNED | 필수 | 0 | 평소 금액 — 원 단위 |
| `is_active` | TINYINT(1) | 필수 | 1 | 사용 여부 — 해지한 항목은 0 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `tag` | ENUM('공과금','통신','구독','관리비','기타') | 필수 | '공과금' | 고정 지출 태그 |

- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `bill_payments` — 월별 고정 지출

공과금 납부: 공과금 항목별 월별 청구·납부 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금납부 아이디 — 자동 증가 / 자동 번호 |
| `bill_item_id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | INT UNSIGNED | 필수 | — | 그 달 금액 — 원 단위 |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- 중복 불가: `bill_item_id`, `period_ym`
- 외래키 `bill_item_id` → `bill_items`.`id`: CASCADE

### `rent_payments` — 월별 월세

월세 납부: 월별 월세 납부 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 월세납부 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 월세 내는 사용자 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | INT UNSIGNED | 필수 | — | 그 달 월세 — 원 단위 (설정의 월세 × 10000) |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- 중복 불가: `user_id`, `period_ym`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `notifications` — 알림

알림: 알림 화면과 빨간 점이 쓰는 표.

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
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 생성 일시 |
| `read_at` | DATETIME | 허용 | — | 읽은 일시 — 비어 있으면 안 읽음 |
| `deleted_at` | DATETIME | 허용 | — | 사용자가 삭제한 시각 — 목록과 미확인 수에서 제외 |

- 기본키: `id`
- 조회 색인: `user_id`, `read_at`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `ledger_categories` — 가계부 분류

가계부 분류: 수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 분류 아이디 — 자동 증가 / 자동 번호 |
| `kind` | ENUM('INCOME','EXPENSE') | 필수 | — | 분류 구분 — 수입 / 기타 지출 |
| `name` | VARCHAR(20) | 필수 | — | 분류 이름 — 월급, 식비 등 |
| `color` | VARCHAR(20) | 필수 | — | 표시 색 — 예: #1fb5a3 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 정렬 순서 |

- 기본키: `id`
- 중복 불가: `kind`, `name`

### `incomes` — 수입

수입: 가계부 "수입" 탭에서 기록하는 수입 한 건.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 수입 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 수입 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 수입 종류 아이디 — 월급, 아르바이트 등 |
| `amount` | INT UNSIGNED | 필수 | — | 수입 금액 — 원 단위 |
| `income_date` | DATE | 필수 | — | 번 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 주말 카페 알바 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 기록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |
| `income_type` | ENUM('FIXED','OTHER') | 필수 | 'OTHER' | 고정 수입 또는 기타 수입 — API incomeType의 fixed/other와 변환 |

- 기본키: `id`
- 조회 색인: `user_id`, `income_date`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `category_id` → `ledger_categories`.`id`: RESTRICT

### `expenses` — 기타 지출

기타 지출: 가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 지출 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 지출 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 지출 분류 아이디 — 식비, 교통 등 |
| `amount` | INT UNSIGNED | 필수 | — | 지출 금액 — 원 단위 |
| `expense_date` | DATE | 필수 | — | 쓴 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 점심 제육덮밥 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 기록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `expense_date`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `category_id` → `ledger_categories`.`id`: RESTRICT

### `posts` — 게시글

커뮤니티 글: 커뮤니티의 글 한 개.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 글 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 글 작성자 아이디 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 글 동네 아이디 — 어느 동네 글인지 |
| `category` | ENUM('FREE','TIP','QUESTION','TOWN') | 필수 | — | 글 분류 — 자유 / 꿀팁 / 질문 / 동네 |
| `title` | VARCHAR(100) | 필수 | — | 글 제목 |
| `body` | TEXT | 필수 | — | 글 내용 |
| `like_count` | INT UNSIGNED | 필수 | 0 | 좋아요 수 |
| `comment_count` | INT UNSIGNED | 필수 | 0 | 댓글 수 |
| `is_home_tip` | TINYINT(1) | 필수 | 0 | 홈 꿀팁 노출 — 켜면 홈에 보임 |
| `status` | ENUM('VISIBLE','HIDDEN','DELETED') | 필수 | 'VISIBLE' | 글 상태 — 신고로 숨김 / 삭제 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 작성 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 — 소프트 삭제 |

- 기본키: `id`
- 조회 색인: `region_id`, `category`, `created_at`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `region_id` → `regions`.`id`: RESTRICT

### `post_likes` — 좋아요

글 좋아요: 누가 어느 글에 좋아요를 눌렀는지.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 받은 글 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 누른 사용자 아이디 — 한 사람당 한 번 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 좋아요 일시 |

- 기본키: `post_id`, `user_id`
- 외래키 `post_id` → `posts`.`id`: CASCADE
- 외래키 `user_id` → `users`.`id`: CASCADE

### `comments` — 댓글

댓글: 글에 달린 댓글.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 댓글 아이디 — 자동 증가 / 자동 번호 |
| `post_id` | BIGINT UNSIGNED | 필수 | — | 댓글이 달린 글 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 댓글 작성자 아이디 |
| `parent_id` | BIGINT UNSIGNED | 허용 | — | 부모 댓글 아이디 — 대댓글일 때만 |
| `body` | VARCHAR(200) | 필수 | — | 댓글 내용 |
| `status` | ENUM('VISIBLE','HIDDEN','DELETED') | 필수 | 'VISIBLE' | 댓글 상태 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 작성 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 댓글 수정 일시 / 수정 시 자동 갱신 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 — 소프트 삭제 |

- 기본키: `id`
- 조회 색인: `post_id`, `created_at`
- 외래키 `post_id` → `posts`.`id`: CASCADE
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `parent_id` → `comments`.`id`: CASCADE

### `reports` — 신고

신고: 운영 정책에 어긋나는 글·댓글을 신고한 기록(정책 제3조).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 신고 아이디 — 자동 증가 / 자동 번호 |
| `reporter_id` | BIGINT UNSIGNED | 필수 | — | 신고한 사용자 아이디 |
| `target_type` | ENUM('POST','COMMENT') | 필수 | — | 신고 대상 종류 — 글 / 댓글 |
| `target_id` | BIGINT UNSIGNED | 필수 | — | 신고 대상 번호 — 글 또는 댓글 아이디 |
| `reason` | ENUM('ABUSE','FALSE_INFO','PRIVACY','AD_ILLEGAL','COPYRIGHT','OTHER') | 필수 | — | 신고 사유 — 욕설·허위·개인정보·광고/불법·저작권·기타 |
| `detail` | VARCHAR(200) | 허용 | — | 자세한 내용 |
| `status` | ENUM('RECEIVED','HIDDEN','DISMISSED') | 필수 | 'RECEIVED' | 처리 상태 — 접수 / 숨김 처리 / 기각 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 신고 일시 |
| `handled_by` | BIGINT UNSIGNED | 허용 | — | 처리한 운영자 아이디 |
| `handled_at` | DATETIME | 허용 | — | 처리 일시 |

- 기본키: `id`
- 조회 색인: `target_type`, `target_id`
- 외래키 `reporter_id` → `users`.`id`: CASCADE
- 외래키 `handled_by` → `users`.`id`: SET NULL

### `user_sanctions` — 경고 및 정지

이용 제한: 운영 정책 위반에 따른 조치 기록(정책 제7조: 경고 → 게시 제한 → 이용 제한 → 이용 정지).

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
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 기록 일시 |
| `seen_at` | DATETIME | 허용 | — | 사용자가 경고를 확인한 시각 |
| `revoked_at` | DATETIME | 허용 | — | 관리자가 조치를 해제한 시각 |
| `revoked_by` | BIGINT UNSIGNED | 허용 | — | 해제한 관리자 번호 |
| `revoke_reason` | VARCHAR(200) | 허용 | — | 해제 사유 |

- 외래키 `revoked_by` → `users`.`id`: SET NULL
- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `report_id` → `reports`.`id`: SET NULL
- 외래키 `created_by` → `users`.`id`: SET NULL

### `banned_identities` — 재가입 차단 식별값

탈퇴 후에도 유지하는 재가입 차단 식별값

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 고유 번호 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 허용 | — | 대상 회원 — 탈퇴 시 연결만 해제 |
| `sanction_id` | BIGINT UNSIGNED | 허용 | — | 관련 제재 — 삭제 시 연결만 해제 |
| `identity_type` | ENUM('LOGIN_ID','NICKNAME','PHONE') | 필수 | — | 재가입 차단 식별값 종류 |
| `identity_hash` | CHAR(64) | 필수 | — | 정규화한 식별값의 서버 비밀키 기반 HMAC-SHA256 — 원문 저장 금지 |
| `hash_key_version` | SMALLINT UNSIGNED | 필수 | 1 | HMAC 키 버전 — 서버에서 키 관리 |
| `starts_at` | DATETIME | 필수 | — | 차단 시작 일시 |
| `expires_at` | DATETIME | 허용 | — | 차단 만료 일시 — NULL은 영구 |
| `revoked_at` | DATETIME | 허용 | — | 차단 해제 일시 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |

- 기본키: `id`
- 조회 색인: `identity_type`, `identity_hash`, `hash_key_version`
- 중복 불가: `sanction_id`, `identity_type`
- 외래키 `user_id` → `users`.`id`: SET NULL
- 외래키 `sanction_id` → `user_sanctions`.`id`: SET NULL

### `support_inquiries` — 고객센터 문의 및 답변

고객센터 문의와 관리자 단일 답변

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 고유 번호 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `category` | ENUM('이용 문의','오류 신고','개선 제안','계정 문의','기타') | 필수 | '이용 문의' | 고객센터 문의 유형 |
| `title` | VARCHAR(100) | 필수 | — | 문의 제목 |
| `content` | TEXT | 필수 | — | 문의 내용 — 1~3000자 |
| `answer_content` | TEXT | 허용 | — | 관리자 답변 — 1~3000자, 문의당 답변 하나 |
| `answered_by` | BIGINT UNSIGNED | 허용 | — | 답변한 관리자 번호 |
| `answered_at` | DATETIME | 허용 | — | 답변 일시 — NULL이면 답변 대기 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |

- 기본키: `id`
- 조회 색인: `user_id`, `created_at`
- 조회 색인: `answered_at`, `created_at`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `answered_by` → `users`.`id`: SET NULL

### `ai_topics` — AI 주제

AI 분야: AI 화면의 분야 카드와 홈 AI 대화 칩의 목록(자유 질문·근처 탐색·분리배출·냉장고 요리·청소·계약·집주인 문자·공과금·지출 요약).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 분야 아이디 — 자동 증가 / 자동 번호 |
| `code` | VARCHAR(20) | 필수 | — | 분야 코드 — trash, cook, summary 등 |
| `name` | VARCHAR(30) | 필수 | — | 분야 이름 |
| `description` | VARCHAR(60) | 필수 | — | 분야 설명 — 카드에 보이는 한 줄 |
| `photo_supported` | TINYINT(1) | 필수 | 0 | 사진 첨부 지원 — 사진을 올리면 "추천" 표시 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 정렬 순서 |
| `is_active` | TINYINT(1) | 필수 | 1 | 사용 여부 |

- 기본키: `id`
- 중복 불가: `code`

### `uploaded_files` — 업로드 파일

커뮤니티 첨부파일 및 파일 저장 메타데이터

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 파일 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 올린 사용자 아이디 |
| `original_name` | VARCHAR(255) | 필수 | — | 원래 파일 이름 |
| `storage_url` | VARCHAR(500) | 필수 | — | 저장 주소 — 파일 저장소 주소 |
| `mime_type` | VARCHAR(50) | 필수 | — | 파일 형식 — 예: image/jpeg |
| `size_bytes` | INT UNSIGNED | 필수 | — | 파일 크기 — 바이트 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 업로드 일시 |
| `deleted_at` | DATETIME | 허용 | — | 삭제 일시 |

- 기본키: `id`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `user_profiles` — 프로필

프로필 꾸미기 — 인증 응답에 users와 함께 조회

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 번호 — 회원당 한 프로필 |
| `bio` | VARCHAR(30) | 필수 | '' | 한 줄 소개 |
| `avatar_file_id` | BIGINT UNSIGNED | 허용 | — | 프로필 사진 파일 번호 — 본인 소유 파일만 허용 |
| `avatar_emoji` | VARCHAR(20) | 허용 | — | 프로필 캐릭터 |
| `avatar_color` | VARCHAR(20) | 허용 | — | 프로필 배경 색 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `user_id`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `avatar_file_id` → `uploaded_files`.`id`: SET NULL

### `post_attachments` — 게시글 첨부 연결

게시글과 첨부파일 연결

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 첨부한 게시글 아이디 |
| `file_id` | BIGINT UNSIGNED | 필수 | — | 업로드 파일 아이디 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 게시글 안의 표시 순서 — 0부터 |

- 기본키: `post_id`, `file_id`
- 중복 불가: `file_id`
- 중복 불가: `post_id`, `sort_order`
- 외래키 `post_id` → `posts`.`id`: CASCADE
- 외래키 `file_id` → `uploaded_files`.`id`: CASCADE

### `ai_conversations` — AI 대화방

AI 대화: AI와의 대화 한 건(대화방).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 대화 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 대화한 사용자 아이디 |
| `topic_id` | BIGINT UNSIGNED | 허용 | — | 대화 분야 아이디 — 분야를 고르고 시작했을 때 |
| `entry_point` | ENUM('HOME_MODAL','AI_PAGE') | 필수 | — | 시작한 곳 — 홈 모달 / AI 화면 |
| `title` | VARCHAR(100) | 허용 | — | 대화 제목 — 첫 질문 요약 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 대화 시작 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 마지막 대화 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 조회 색인: `user_id`, `updated_at`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `topic_id` → `ai_topics`.`id`: SET NULL

### `ai_messages` — AI 메시지

AI 메시지: 대화 안의 말풍선 한 개.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 메시지 아이디 — 자동 증가 / 자동 번호 |
| `conversation_id` | BIGINT UNSIGNED | 필수 | — | 메시지가 속한 대화 아이디 |
| `role` | ENUM('USER','ASSISTANT') | 필수 | — | 보낸 쪽 — 사용자 / AI |
| `content` | TEXT | 필수 | — | 메시지 내용 |
| `card_type` | ENUM('SPEND_SUMMARY','LINK') | 허용 | — | 카드 종류 — 지출 요약 또는 앱 내부 이동 링크 |
| `card_data` | JSON | 허용 | — | 카드 내용 — 카드에 보이는 숫자. 예: {month,total,prevTotal,fixed,rows,top} |
| `attachment_id` | BIGINT UNSIGNED | 허용 | — | 첨부 파일 아이디 — 사진 첨부(선택) |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 작성 일시 |

- 기본키: `id`
- 조회 색인: `conversation_id`, `created_at`
- 외래키 `conversation_id` → `ai_conversations`.`id`: CASCADE
- 외래키 `attachment_id` → `uploaded_files`.`id`: SET NULL

### `ai_usage_daily` — AI 하루 사용량

AI 하루 사용량: 사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 |
| `usage_date` | DATE | 필수 | — | 사용 날짜 |
| `question_count` | INT UNSIGNED | 필수 | 0 | 하루 질문 횟수 |

- 기본키: `user_id`, `usage_date`
- 외래키 `user_id` → `users`.`id`: CASCADE

### `trash_schedules` — 쓰레기 배출 요일표

쓰레기 배출 일정: 동네별 요일 배출표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 배출일정 아이디 — 자동 증가 / 자동 번호 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 |
| `weekday` | TINYINT UNSIGNED | 필수 | — | 배출 요일 — 0=일 ~ 6=토 |
| `waste_type` | ENUM('GENERAL','RECYCLE','FOOD') | 필수 | — | 배출 종류 — 일반쓰레기 / 재활용 / 음식물 |
| `description` | VARCHAR(100) | 필수 | — | 배출 안내 — 예: 저녁 6시 ~ 자정, 종량제 봉투 사용 |

- 기본키: `id`
- 중복 불가: `region_id`, `weekday`, `waste_type`
- 외래키 `region_id` → `regions`.`id`: CASCADE

### `place_categories` — 장소 분류

장소 분류: 지도 화면의 칩(세탁방·편의점·약국·마트) 목록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 장소 분류 아이디 — 자동 증가 / 자동 번호 |
| `name` | VARCHAR(20) | 필수 | — | 장소 분류 이름 — 세탁방, 편의점 등 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 정렬 순서 |
| `icon` | VARCHAR(20) | 필수 | '📍' | 장소 분류 그림 |

- 기본키: `id`
- 중복 불가: `name`

### `places` — 장소

주변 장소: 지도 화면과 AI "근처 탐색"에 나오는 가게·시설.

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
| `review_count` | INT UNSIGNED | 필수 | 0 | 리뷰 수 |
| `source` | ENUM('MANUAL','PUBLIC_DATA') | 필수 | 'MANUAL' | 정보 출처 — 직접 입력 / 공공데이터 |
| `source_id` | VARCHAR(50) | 허용 | — | 원본 데이터 번호 — 공공데이터 원본 ID |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 정보 갱신 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 조회 색인: `region_id`, `category_id`
- 외래키 `region_id` → `regions`.`id`: RESTRICT
- 외래키 `category_id` → `place_categories`.`id`: RESTRICT

### `place_favorites` — 장소 즐겨찾기

사용자별 지도 즐겨찾기

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `place_id` | BIGINT UNSIGNED | 필수 | — | 저장한 장소 번호 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |

- 기본키: `user_id`, `place_id`
- 외래키 `user_id` → `users`.`id`: CASCADE
- 외래키 `place_id` → `places`.`id`: CASCADE

### `place_reviews` — 장소 리뷰

장소 리뷰: 사용자가 장소에 남기는 별점과 한 줄 리뷰(확장 기능).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 리뷰 아이디 — 자동 증가 / 자동 번호 |
| `place_id` | BIGINT UNSIGNED | 필수 | — | 리뷰 받은 장소 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 리뷰 쓴 사용자 아이디 |
| `rating` | TINYINT UNSIGNED | 필수 | — | 별점 — 1~5 |
| `body` | VARCHAR(300) | 허용 | — | 리뷰 내용 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 작성 일시 |

- 기본키: `id`
- 중복 불가: `place_id`, `user_id`
- 외래키 `place_id` → `places`.`id`: CASCADE
- 외래키 `user_id` → `users`.`id`: CASCADE

## 6. VIEW와 기본 데이터

| VIEW | 반환값 | 의미 |
|---|---|---|
| v_monthly_income | user_id, period_ym, total_amount | 회원·월별 전체 수입 합계 |
| v_monthly_spend_breakdown | user_id, period_ym, label, amount | 월세 + 고정 지출 전체 + 기타 지출 분류별 합계 |

두 VIEW는 기존 API 모양을 유지합니다. SUM의 실제 타입은 MySQL 식에서 결정됩니다. 월별 월세·고정 지출 행은 서버가 생성해야 하며 같은 월의 중복은 UNIQUE 키로 막습니다. expenses에 월세·고정 지출을 중복 저장하지 않습니다.

기본 데이터는 동네 12개, 일부 이웃 관계, 수입 분류 10개·지출 분류 6개, AI 주제 10개, 장소 분류 15개, 예시 배출 일정 6개, 약관 3종입니다. 약관 버전은 2026-10-18을 유지합니다. 지역·배출표는 예시이며 실제 운영 지역 데이터와 구분합니다.

INSERT IGNORE는 기존 고유 키의 행을 갱신하지 않습니다. 장소 아이콘은 명시적 UPDATE로 보완합니다. 개인별 일정 기본 카테고리와 항목은 별도 초기 데이터 파일을 사용합니다.

## 7. 서버 연결 시 검증 사항

- 개인 데이터 소유권, 관리자 권한, 파일 MIME·소유권·최대 5개/합계 2MB는 서버에서 검사합니다. FK는 같은 사용자 소유인지까지 보장하지 않습니다.
- 비밀번호·토큰 해시 생성, 휴대전화 인증 만료·사용 횟수·일회 사용, 로그인 세션 회수는 서버 로직입니다.
- 좌표 범위·좌표 쌍, JSON 원소 형식·개수·소유권, 금액·날짜·태그·수입 분류 일치 여부를 검사합니다.
- 재가입 차단과 회원 상태, 제재 기간 만료·해제는 트랜잭션과 조회 시 검사를 통해 일관되게 처리합니다.
- 외부 저장소 파일은 FK 삭제로 제거되지 않으므로 실제 파일 정리가 필요합니다. 프로필·게시글에 연결된 파일을 임의로 재사용하지 않도록 검사합니다.
- 데이터베이스 ID는 API에서 문자열로, DATETIME은 합의된 시간대(권장 UTC 저장 후 ISO 변환)로 반환합니다. 일정 날짜·시간과 납부 연월은 한국의 달력 날짜를 유지합니다.
- 알림·좋아요·댓글 건수 등 파생값, 보고서 대상의 존재 여부는 서버가 관리합니다.

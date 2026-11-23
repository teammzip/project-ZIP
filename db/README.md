# ZIP 데이터베이스 설계

실제 사용자 데이터·DB 백업·인증정보는 저장소에 포함하지 않습니다.

[schema.sql](schema.sql)은 현재 프로젝트의 React 데이터 모델과 [백엔드 API 약속](../frontend/API.md)을 반영한 MySQL **8.0.16 이상** 설계입니다. 테이블 **54개**, 집계 VIEW **2개**입니다.

## 1. 기능별 DB 위치

현재 기준은 **54테이블 · VIEW 2개**예요(세부 수치는 `tests/schema_expected.json`). 언제 누가 무엇을 바꿨는지는 루트 [CHANGELOG.md](../CHANGELOG.md#db)에 있어요.

| 기능 | DB 반영 |
|---|---|
| 일정에 할 일 통합 | todos 제거, events.is_done·done_at 추가 |
| 기념일·매년 반복 | events.is_anniversary·repeat_yearly 추가, 원본 한 행을 연도별로 표시 |
| 일정 카테고리·항목 버튼 | event_categories·event_presets, events.category_id |
| 메모·홈 메모 순서 | memos, user_settings.home_memo_ids |
| 프로필 사진·캐릭터·소개 | user_profiles (회원당 한 행) |
| 지도 즐겨찾기·칩·검색어 | place_favorites, 설정의 map_categories·map_keywords |
| 동네 인증·집 위치 | users.region_verified_at·home_lat·home_lon |
| 고정 지출 태그 | bill_items.tag VARCHAR(24): 기본 5개 + 회원별 사용자 분류 |
| 개인 카테고리·순서 | user_settings.ledger_category_settings JSON, 4개 scope별 custom/order |
| 실제 집 주소 | user_settings.home_address, 가입 주소·동네·설문 스냅샷과 구분 |
| 주거 설문·대출·이자 | housing_surveys·housing_loans·loan_interest_charges, 과거 금액 스냅샷 보존 |
| 고정·기타 수입 | incomes.income_type: FIXED·OTHER, 수입 분류 4개 추가 |
| 알림 삭제 | notifications.deleted_at |
| AI 사용 방법 | guide 주제, ai_messages.card_type에 LINK 추가 |
| 경고 확인·정지 해제 | user_sanctions.seen_at·revoked_at·revoked_by·revoke_reason |
| 고객센터 문의·답변 | support_inquiries, 문의당 관리자 답변 하나 |
| 기념일·매년 반복 | events.is_anniversary·repeat_yearly (20261031_02_event_anniversaries.sql) |
| 장소 분류 확대 | place_categories.icon, 15개 분류 기본 데이터 |

API 문서와 코드의 저장 모델을 함께 대조했습니다. 프론트 코드의 모든 서비스 규칙이 DB 제약으로 구현되는 것은 아니므로 최신 저장 계약의 API 인수 기준도 확인해야 합니다.

## 2. 적용 방법

### 새 DB

프로젝트 최상위 폴더에서 실행합니다. 현재 데이터베이스에 적용한 결과가 아니라 **새 DB 생성용 파일**입니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/schema.sql"
```

### 기존 DB

20261102까지 적용된 DB는 [20261107_life_categories.sql](migrations/20261107_life_categories.sql)을 한 번 적용합니다. 이미 최신 컬럼·타입이 있으면 재실행하지 않습니다. 20261102 이전 44개 표 DB는 먼저 [20261102_requirements_hardening.sql](migrations/20261102_requirements_hardening.sql)의 사전 검사를 마친 뒤 순서대로 적용합니다. 테이블 수만으로 적용 버전을 판단하지 않습니다.

기념일 정식 컬럼까지 적용한 41개 테이블 DB는 [주거·대출 마이그레이션](migrations/20261101_housing_and_loan.sql)을 추가 적용합니다. 구형 기념일 컬럼이 남아 있으면 [마이그레이션 안내](migrations/README.md#구형-기념일-컬럼-정리)를 확인하세요.

기념일 기능까지 반영하려면 기존 변경 파일 이후 [기념일 추가 마이그레이션](migrations/20261031_02_event_anniversaries.sql)을 적용합니다. 이미 첫 번째 파일을 적용했다면 기념일 파일만 실행하세요. 정확한 순서는 [마이그레이션 안내](migrations/README.md)를 따릅니다.

기존 2026-10-21 설계(35개 테이블)를 적용했다면 [마이그레이션](migrations/20261031_current_project.sql)을 사용합니다. [적용 및 확인 안내](migrations/README.md)를 먼저 확인하세요. 데이터 백업 및 쓰기 중단 후 **한 번만** 적용합니다. CREATE TABLE IF NOT EXISTS는 기존 컬럼을 변경하지 않으며, MySQL DDL은 파일 전체를 자동 롤백하지 않습니다.

기존 todos는 events로 이전하고 todos_legacy_20261031로 이름을 바꿔 보관합니다. 따라서 기존 DB에는 **현행 44개 + 보관용 1개** 테이블이 있습니다. 원본에 일정 날짜가 없으므로 등록 날짜를 사용하며, 이는 실제 예정일을 복원한 값이 아닙니다. 완료 여부·완료 시각은 보존합니다.

### 가입 시 초기 데이터

[일정 기본 데이터](seeds/event_defaults.sql)는 현재 회원들에 기본 카테고리 5개+미분류와 항목 30개를 복사합니다. 새 DB 생성 직후에는 회원이 없으므로 자동으로 개인 행을 만들지 않습니다.

서버의 가입 트랜잭션에서 해당 SQL의 SELECT를 **새 회원 ID로 제한**하여 user_settings·user_profiles 생성과 함께 실행하세요. 전체 회원에 반복 실행하면 사용자가 이름을 바꾸거나 지운 기본 항목이 다시 생길 수 있으므로 초기화용으로만 사용합니다.

### 전국 지역 · 쓰레기 배출표 · 주변 동네

전국 시도 · 시군구(`regions` 249행), 쓰레기 배출표(`trash_schedules` 6,218행), 주변 동네(`region_neighbors` 1,286행)는 데이터 마이그레이션 세 개(`20261122_01_regions_nationwide` · `02` · `04`)로 넣습니다. 백엔드가 자동으로 넣지 않으니 각자 DB 에 한 번 실행하세요(여러 번 실행해도 같음, 각자 DB 의 지역 번호는 그대로).

1. [`migrations/20261121_06_trash_schedule_columns.sql`](migrations/20261121_06_trash_schedule_columns.sql) — 배출표 구조 (동네 · 장소 한 줄에 생활쓰레기 · 음식물 · 재활용 요일 · 시작 시각)
2. [`migrations/20261122_01_regions_nationwide.sql`](migrations/20261122_01_regions_nationwide.sql) — 전국 시도 16 · 시군구 233 (없는 것만 추가)
3. [`migrations/20261122_02_trash_schedules_nationwide.sql`](migrations/20261122_02_trash_schedules_nationwide.sql) — 배출표를 모두 지우고 다시 넣음. 마지막에 `파일 줄 수 6218 · 넣은 줄 수 6218 · 지역 없음 0` 이면 정상
4. [`migrations/20261122_04_region_neighbors_nationwide.sql`](migrations/20261122_04_region_neighbors_nationwide.sql) — 주변 동네를 모두 지우고 다시 넣음(예시 12줄도 바뀜). 마지막에 `파일 줄 수 1286 · 넣은 줄 수 1286 · 지역 없음 0` 이면 정상

**주변 동네 기준** (`20261122_04`, 커뮤니티 "주변 동네" 탭이 씀): **육지 경계선을 함께 쓰는(맞닿은) 시 · 군 · 구**끼리 이웃이고 양쪽이 같아요. 강 가운데 경계는 이웃(마포구 ↔ 영등포구), 바다 위 경계는 빼요(제주시 ↔ 완도군 같은 바다 건너는 이웃 아님). 인천 옛 구(중구 · 동구 · 서구)는 이어받은 새 구 + 그 이웃, 맞닿은 곳이 없는 울릉군 · 진도군은 중심이 가장 가까운 2곳. 동네당 이웃은 1 ~ 12곳(평균 5.5). 예: 마포구 → 강서구 · 고양시 · 서대문구 · 영등포구 · 용산구 · 은평구 · 중구.
OpenStreetMap 행정구역 경계(© OpenStreetMap contributors, ODbL)에서 `python db/tools/region_neighbors_import.py --fetch` 로 만들어요(받은 경계 목록은 `db/data/`, 저장소에 안 올림). 경계선 좌표는 받지 않고 경계를 이루는 선 번호 · 중심 좌표만 써요.

`20261122_01` · `02` 는 공공데이터포털 「전국생활쓰레기배출정보표준데이터」 CSV(`db/data/`, 저장소에 안 올림)를 `python db/tools/trash_import.py` 로 바꿔 만든 파일이에요. 표 구조는 아래 [`trash_schedules`](#trash_schedules--쓰레기-배출-요일표) 항목을 보세요.

**이용허락 · 출처**: 제공기관 행정안전부, 공공데이터포털 [15025450](https://www.data.go.kr/data/15025450/standard.do) 의 이용허락범위는 **"이용허락범위 제한 없음"**(2026-11-22 확인 · 상업적 이용 · 변경 가능). 출처 표시 의무는 없지만 앱에서 이용약관 제2조와 브랜드 페이지 아래(`BrandFooter`)에 출처를 적어 두었어요. 쓰레기 배출 화면을 만들면 화면 아래에도 같은 출처를 적어요.

## 3. 화면과 DB 연결 규칙

### 일정과 카테고리

- API `anniv` → `is_anniversary`, `yearly` → `repeat_yearly`로 변환합니다. 생략하면 false입니다. 반복은 기념일에만 허용하고 DB CHECK로 유효한 0/1 조합을 검사합니다.
- 기념일도 events에 원본 한 행으로 저장합니다. 현재 화면은 제목에 `🎉 `를 붙여 보내므로 서버가 중복 추가하지 않습니다. 제목으로 기념일 여부를 판정하지 않습니다.
- 기념일은 완료 조작과 남은 할 일 집계에서 제외합니다. 서버 생성 시 is_done=0, done_at=NULL을 사용하고 기념일 완료 요청은 거부합니다. 이 규칙은 위 플래그 CHECK가 아니라 API에서 검사합니다.
- 매년 반복 표시는 원본 event_date의 연도부터 시작합니다. 2월 29일은 평년에 2월 28일로 표시하지만 원본 날짜를 덮어쓰지 않습니다. 기간 조회 시 event_date 범위 조건만 사용하면 과거 원본을 놓치므로 반복 기념일 원본도 포함해야 합니다.
- 현재 프론트가 연도별 표시를 펼치므로 API는 원본을 반환하고 이중 확장을 피합니다. `12@2027`은 표시용 ID이며 DB BIGINT ID가 아닙니다. 수정·삭제는 원본 ID와 소유권을 검증해 원본 전체에 적용합니다. 특정 연도만 예외 처리하는 기능은 현재 범위에 없습니다.
- 반복 기념일 알림은 원본 ID와 발생 날짜를 함께 구분해 읽음·삭제 상태가 다른 연도로 번지지 않게 합니다. notifications.ref_id에는 표시용 문자열 대신 원본 ID를 사용합니다.

- 카테고리는 사용자별로 관리합니다. 같은 회원 안에서 이름은 중복되지 않습니다. system_key=UNCATEGORIZED인 행은 미분류이며 서버에서 이름 변경·삭제를 막습니다.
- events.category_id가 NULL이면 API의 category는 미분류입니다. event_presets는 미분류를 포함한 실제 카테고리 행에 연결합니다.
- API가 보내는 category 이름은 로그인한 회원의 카테고리 ID로 변환합니다. 다른 회원의 카테고리·파일·메모를 연결하지 않도록 서버에서 검사합니다.
- 카테고리 이름 변경은 JOIN 결과에 자동 반영됩니다. 삭제는 **트랜잭션으로 일정의 category_id를 NULL 처리 → 미분류와 같은 제목인 항목 중복 정리 → 나머지 항목을 미분류로 이동 → 카테고리 삭제** 순서입니다. 카테고리를 바로 DELETE하면 연결된 항목은 FK CASCADE로 삭제되므로 서비스에서 반드시 먼저 옮깁니다.
- 기본 항목은 is_custom=0, 직접 입력한 항목은 1입니다. 직접 입력 시 같은 카테고리·제목 버튼은 UNIQUE 키로 중복을 막고 일정은 별도로 생성합니다. 항목 수정·삭제는 이미 등록한 일정 제목·날짜에 영향을 주지 않습니다.
- 동일 날짜·제목·카테고리 일정의 중복 추가는 API에서 검사합니다. 기존 일정 자료를 보존하기 위해 해당 조합에 UNIQUE 제약은 추가하지 않았습니다.
- 완료 시 is_done=1과 done_at을 함께 저장하고, 완료 해제 시 done_at=NULL로 바꿉니다. 쓰레기 배출 일정은 events에 복제하지 않고 요일표로 계산합니다.
- 기념일은 is_anniversary=1인 일정입니다. 제목에는 API가 붙이는 "🎉 " 접두어가 포함될 수 있고, repeat_yearly=1이면 한 행만 저장하고 화면에서 매년 날짜로 펼칩니다. 기념일은 완료 처리 대상이 아니며 남은 일 수에서 제외합니다.

### 메모·지도·프로필

- 현재 지도·날씨는 등록 동네 주소 기반 좌표를 사용하고 GPS는 동네 인증에만 사용합니다. users.home_lat/home_lon을 인증 GPS 위치로 덮어쓰지 않으며 위치 이력 표를 추가하지 않습니다.

- 메모 items는 [{text,done}] 배열이며 본문 최대 5000자, 항목 text 최대 100자는 서버가 검사합니다. body를 생략한 POST는 빈 문자열로 저장합니다.
- home_memo_ids는 **문자열 ID 배열**, 최대 3개이며 순서를 보존합니다. NULL은 자동 선택, []는 명시적으로 선택한 메모 없음입니다. 소유권 검사와 삭제된 메모 ID 정리는 서버 책임입니다.
- map_categories와 map_keywords는 각각 문자열 배열입니다. NULL이면 API가 기본 4개 분류 및 빈 검색어 배열을 반환합니다. API의 {categories,keywords}로 조합합니다.
- 프로필은 최신 API 문서와 같이 **user_profiles**에 저장합니다. /auth/me에서 LEFT JOIN하고 avatar_file_id를 uploaded_files.storage_url로 변환해 bio·avatarUrl·avatarEmoji·avatarColor를 반환합니다. 사진→캐릭터→기본 표시 우선순위는 화면과 동일합니다.
- 주소가 바뀌면 집 좌표를 재계산합니다. 동네 인증 위치는 집 위치와 다를 수 있으므로 인증 좌표를 집 위치로 자동 간주하지 않습니다. 동네 변경 시 region_verified_at=NULL, 30일 경과 시 API에서 인증 무효로 판단합니다.

### 가계부·알림·AI

- 실제 집 주소는 user_settings.home_address, 현재 동네는 region_name/source/lat/lon, 가입 주소는 users.address, 설문 주소/좌표는 housing_surveys 스냅샷입니다. 서로 자동 덮어쓰지 않습니다.
- ledger_category_settings는 fixed-income/other-income/spend/bill별 {custom,order} 객체입니다. NULL은 기본 목록, 개인 표시색·순서는 이 설정을 우선합니다. ledger_categories는 수입/지출 기록 FK용 공용 사전이므로 다른 회원의 사용자 목록으로 노출하지 않습니다.
- 월별 납부 true/false는 해당 월의 paid_at 값으로 변환하며 다른 달을 덮어쓰지 않습니다. 항목의 default_amount 수정은 기존 월별 amount를 변경하지 않습니다. 일반 항목 제거는 is_active=0으로 과거 납부 기록을 보존합니다.

- 월세 설정만 만원 단위이며 나머지 금액은 원 단위입니다. 고정 지출의 현재 기본 금액과 월별 기록 금액을 구분합니다.
- incomes.income_type은 API의 incomeType fixed/other를 FIXED/OTHER로 변환합니다. 월별 수입 VIEW는 두 종류 전체를 합산합니다. 종류별 조회는 incomes를 필터링합니다.
- 월별 지출 VIEW는 고정 지출의 모든 태그를 기존 계약대로 **공과금** 라벨에 합산합니다. 회원별 태그 차트는 bill_items.tag로 별도 집계합니다. VIEW는 미납 청구도 포함하므로 실제 납부 합계는 paid_at 조건으로 구분해야 합니다.
- deleted_at이 있는 알림은 목록·미확인 개수에서 제외하고 재생성하지 않아야 합니다. 홈에서 하루만 숨기는 상태는 기존처럼 브라우저에서 관리합니다.
- AI LINK 카드의 card_data는 {label,to}입니다. to는 API 문서에 나열된 앱 내부 경로만 허용합니다. 사진은 처리 후 보관하지 않으며 attachment_id는 현재 NULL로 둡니다.

### 제재·탈퇴·고객센터

- 경고 확인은 seen_at에 저장합니다. 조기 해제는 **원래 ends_at을 유지**하고 revoked_at·revoked_by·revoke_reason을 기록합니다. API 문서도 이 해제 규칙을 따르며, 유효 정지는 시작·종료 시각과 revoked_at을 함께 검사해야 합니다.
- 재가입 차단(banned_identities)은 2026-11-15에 하지 않기로 해서 표를 삭제했습니다. 정지·차단 회원이 탈퇴 후 다시 가입하는 것은 막지 않습니다.
- 고객센터는 본인 문의만 조회하고 ADMIN만 전체 조회·답변합니다. 제목 1~100자, 문의·답변 1~3000자와 유형을 검증합니다. 답변은 UPDATE ... WHERE answered_at IS NULL로 원자적으로 저장해 중복 답변을 막습니다. nickname은 users에서 조회하고 답변 대기/완료는 answered_at으로 계산합니다.
- 날씨는 현재 코드에서 외부 API 조회 및 캐시를 사용하므로 별도 영구 저장 테이블을 추가하지 않았습니다.

## 4. 테이블 한눈에 보기

| 테이블 | 역할 |
|---|---|
| `regions` | 동네 |
| `region_neighbors` | 이웃 동네 |
| `housing_surveys` | 최신 주거 설문 |
| `housing_loans` | 회원별 전세 대출 설정 |
| `loan_interest_charges` | 월별 이자 스냅샷 |
| `users` | 회원 |
| `social_accounts` | 소셜 계정 |
| `auth_sessions` | 로그인 세션 |
| `email_verifications` | 이메일 인증 |
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
| `kakao_place_favorites` | 카카오 검색 장소 즐겨찾기 (id · 이름만) |
| `place_lists` · `place_list_items` | 지도 저장 리스트와 그 안의 장소 |
| `home_contracts` | 내 집 계약 (월세/전세 · 보증금 · 관리비 · 자동 등록 시간대) |
| `user_personal_info` | 회원 개인 정보 (생년월일, 주거 계약과 분리) |
| `salary_settings` · `salary_records` | 월급 자동 등록 설정과 월별 1건 기록 |
| `bill_document_keys` · `bill_photo_imports` | 고지서 중복 등록 방지 해시 (문서 · 사진) |
| `bill_photo_drafts` | 고지서 사진 인식 결과 (사용자 확인 전 임시, 30분) |
| `notices` | 관리자 공지사항 (고정 · 쓴 관리자) |

> 2026-11-15 이후 추가된 위 8줄(표 11개)과 일부 칸(`users.housing_survey_status` 등, 고정 지출의 `due_date` · `memo` · `deleted_at` 등)은 아래 5장 컬럼 설명에 아직 없어요. 정확한 칸은 [`schema.sql`](schema.sql)을 보세요.

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
- UNIQUE `uk_regions_parent_id_name`: `parent_id`, `name`
- 외래키 `fk_regions_parent_id`: `parent_id` → `regions` (`id`), ON DELETE RESTRICT

### `region_neighbors` — 이웃 동네

주변 동네: 어느 동네가 어느 동네와 이웃한지 적어 둔 표. 데이터는 [위 "주변 동네 기준"](#전국-지역--쓰레기-배출표--주변-동네) (`20261122_04`, 전국 1,286행 · 육지 경계가 맞닿은 시 · 군 · 구).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 |
| `neighbor_region_id` | BIGINT UNSIGNED | 필수 | — | 주변 동네 아이디 — 이웃한 동네 |

- 기본키: `region_id`, `neighbor_region_id`
- 외래키 `fk_region_neighbors_region_id`: `region_id` → `regions` (`id`), ON DELETE CASCADE
- 외래키 `fk_region_neighbors_neighbor_region_id`: `neighbor_region_id` → `regions` (`id`), ON DELETE CASCADE

### `users` — 회원

사용자: 가입한 사람 한 명당 한 줄.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 — 자동 증가 / 자동 번호 |
| `login_id` | VARCHAR(16) | 허용 | — | 로그인 아이디 — 일반 가입은 6~16자 영문 소문자·숫자 필수, 소셜 가입은 NULL 허용 |
| `password_hash` | VARCHAR(100) | 허용 | — | 비밀번호(해시) — 원문은 저장 안 함. 소셜 가입자는 비어 있음 |
| `nickname` | VARCHAR(12) | 필수 | — | 닉네임 — 2~12자, 앱 인사말에 쓰임 |
| `email` | VARCHAR(100) | 허용 | — | 이메일 — 가입 화면에서는 인증을 거쳐 필수로 받음. 소셜 로그인은 제공 안 할 수 있어 비어 있을 수 있음. 아이디·비밀번호 찾기의 본인 확인에 씀 |
| `email_verified_at` | DATETIME | 허용 | — | 이메일 인증 일시 — 인증번호로 이메일을 확인한 시각 (인증 전은 비어 있음) |
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
- UNIQUE `uk_users_login_id`: `login_id`
- UNIQUE `uk_users_email`: `email`
- 외래키 `fk_users_region_id`: `region_id` → `regions` (`id`), ON DELETE SET NULL
- CHECK: CONSTRAINT `ck_users_home_point` CHECK ((`home_lat` IS NULL AND `home_lon` IS NULL) OR (`home_lat` IS NOT NULL AND `home_lon` IS NOT NULL AND `home_lat` BETWEEN -90 AND 90 AND `home_lon` BETWEEN -180 AND 180))

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
- UNIQUE `uk_social_accounts_provider_provider_user_id`: `provider`, `provider_user_id`
- UNIQUE `uk_social_accounts_user_id_provider`: `user_id`, `provider`
- 외래키 `fk_social_accounts_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- UNIQUE `uk_auth_sessions_refresh_token_hash`: `refresh_token_hash`
- 외래키 `fk_auth_sessions_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

### `email_verifications` — 이메일 인증

이메일 인증: 메일로 보낸 인증번호 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 인증 아이디 — 자동 증가 / 자동 번호 |
| `purpose` | ENUM('SIGNUP','FIND_ID','RESET_PASSWORD') | 필수 | — | 인증 목적 — 가입 / 아이디 찾기 / 비밀번호 찾기 |
| `email` | VARCHAR(100) | 필수 | — | 인증받는 이메일 |
| `user_id` | BIGINT UNSIGNED | 허용 | — | 대상 사용자 아이디 — 찾기일 때만 채움(가입 때는 비움). 탈퇴하면 함께 삭제 |
| `code_hash` | CHAR(64) | 필수 | — | 인증번호(해시) — 6자리 번호를 해시로 저장 |
| `attempt_count` | TINYINT UNSIGNED | 필수 | 0 | 틀린 횟수 — 횟수가 넘으면 잠금 |
| `requested_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 인증번호 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 인증번호 만료 일시 — 보통 3~5분 |
| `verified_at` | DATETIME | 허용 | — | 인증 성공 일시 |
| `verified_token_hash` | CHAR(64) | 허용 | — | 인증 완료 값(해시) — 인증 성공 때 발급. 가입·찾기 요청에 함께 보내는 값 |
| `consumed_at` | DATETIME | 허용 | — | 사용 일시 — 인증 완료 값을 가입·재설정에 쓴 시각(한 번만 사용) |

- 기본키: `id`
- UNIQUE `uk_email_verifications_verified_token_hash`: `verified_token_hash`
- 외래키 `fk_email_verifications_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

### `password_resets` — 비밀번호 재설정

비밀번호 재설정 토큰: 비밀번호를 다시 정하도록 허락하는 1회용 토큰.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 재설정 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 재설정하는 사용자 아이디 |
| `method` | ENUM('EMAIL') | 필수 | 'EMAIL' | 본인 확인 방법 — 이메일 인증 |
| `token_hash` | CHAR(64) | 필수 | — | 재설정 토큰(해시) — 원문은 저장 안 함 |
| `requested_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 요청 일시 |
| `expires_at` | DATETIME | 필수 | — | 만료 일시 — 보통 10~30분 |
| `used_at` | DATETIME | 허용 | — | 사용 일시 — 비어 있으면 아직 안 씀 |

- 기본키: `id`
- UNIQUE `uk_password_resets_token_hash`: `token_hash`
- 외래키 `fk_password_resets_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- UNIQUE `uk_terms_documents_doc_type_version`: `doc_type`, `version`

### `user_term_agreements` — 약관 동의 이력

약관 동의 이력: 누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 동의 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 동의한 사용자 아이디 |
| `terms_id` | BIGINT UNSIGNED | 필수 | — | 동의한 약관 아이디 |
| `agreed_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 동의 일시 |

- 기본키: `id`
- UNIQUE `uk_user_term_agreements_user_id_terms_id`: `user_id`, `terms_id`
- 외래키 `fk_user_term_agreements_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_user_term_agreements_terms_id`: `terms_id` → `terms_documents` (`id`), ON DELETE RESTRICT

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
| `rent_amount` | DECIMAL(14,4) UNSIGNED | 필수 | 0 | 월세 금액 — 만원 단위 (55 = 55만원) |
| `rent_day` | TINYINT UNSIGNED | 필수 | 15 | 월세 납부일 — 매월 며칠 (1~31) |
| `move_in_ym` | CHAR(7) | 허용 | — | 입주한 달 — 오른쪽 패널의 "거주 N개월" 계산 (예: 2026-02) |
| `contract_end_ym` | CHAR(7) | 허용 | — | 계약 끝나는 달 — "계약 N개월 남음" 계산 |
| `noti_on` | TINYINT(1) | 필수 | 1 | 알림 수신 여부 — 끄면 빨간 점·알림을 숨김 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 설정 수정 일시 / 수정 시 자동 갱신 |
| `home_memo_ids` | JSON | 허용 | — | 홈 메모 ID 문자열 배열 — NULL은 자동, 최대 3개, 배열 순서로 표시 |
| `map_categories` | JSON | 허용 | — | 지도에 표시할 장소 분류 이름 배열 — NULL은 기본 4개 |
| `map_keywords` | JSON | 허용 | — | 지도에서 직접 추가한 검색어 배열 — NULL은 없음 |
| `home_address` | VARCHAR(200) | 허용 | — | 현재 실제 거주 상세주소 — 동네 표시명 및 가입 주소와 구분 |
| `ledger_category_settings` | JSON | 허용 | — | 회원별 scope의 custom 카테고리와 order 배열 — NULL은 기본 목록 |
| `region_name` | VARCHAR(200) | 허용 | — | 현재 동네 표시명 — regionLocation.region |
| `region_source` | ENUM('SURVEY','VERIFIED','MANUAL') | 허용 | — | 현재 동네 선택 출처 — regionLocation.source |
| `region_lat` | DECIMAL(9,6) | 허용 | — | 현재 동네 좌표 위도 — 집 위치와 구분 |
| `region_lon` | DECIMAL(9,6) | 허용 | — | 현재 동네 좌표 경도 — 출처에 따라 행정구역 중심 또는 인증 위치 |

- 기본키: `user_id`
- 외래키 `fk_user_settings_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_settings_ledger_object` CHECK (`ledger_category_settings` IS NULL OR JSON_TYPE(`ledger_category_settings`) = 'OBJECT')
- CHECK: CONSTRAINT `ck_settings_region_location` CHECK ((`region_source` IS NULL AND `region_name` IS NULL AND `region_lat` IS NULL AND `region_lon` IS NULL) OR (`region_source` IS NOT NULL AND `region_name` IS NOT NULL AND CHAR_LENGTH(TRIM(`region_name`)) > 0 AND ((`region_lat` IS NULL AND `region_lon` IS NULL) OR (`region_lat` IS NOT NULL AND `region_lon` IS NOT NULL AND `region_lat` BETWEEN -90 AND 90 AND `region_lon` BETWEEN -180 AND 180))))
- CHECK: CONSTRAINT `ck_settings_json_arrays` CHECK ((`home_memo_ids` IS NULL OR (JSON_TYPE(`home_memo_ids`) = 'ARRAY' AND JSON_LENGTH(`home_memo_ids`) <= 3)) AND (`map_categories` IS NULL OR JSON_TYPE(`map_categories`) = 'ARRAY') AND (`map_keywords` IS NULL OR JSON_TYPE(`map_keywords`) = 'ARRAY'))

### `housing_surveys` — 최신 주거 설문

회원별 최신 주거 설문 — 실제 개인정보를 seed로 넣지 않음

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | — |
| `birth_date` | DATE | 필수 | — | 생년월일 — 나이는 조회 시 계산 |
| `address` | VARCHAR(200) | 필수 | — | 응답 당시 간략한 주소 |
| `contract_kind` | ENUM('MONTHLY','JEONSE') | 필수 | — | — |
| `deposit` | BIGINT UNSIGNED | 필수 | 0 | 월세 보증금 — 원 |
| `rent` | BIGINT UNSIGNED | 필수 | 0 | 월세 — 원 |
| `management_included` | TINYINT(1) | 필수 | 0 | — |
| `management_fee` | BIGINT UNSIGNED | 필수 | 0 | 별도 관리비 — 원 |
| `contract_fee` | BIGINT UNSIGNED | 필수 | 0 | 전세 계약금 — 원, 보증금으로 임의 재해석하지 않음 |
| `has_loan` | TINYINT(1) | 필수 | 0 | — |
| `loan_amount` | BIGINT UNSIGNED | 필수 | 0 | 응답 당시 대출 금액 — 원 |
| `loan_annual_rate` | DECIMAL(5,2) | 허용 | — | — |
| `loan_payment_day` | TINYINT UNSIGNED | 허용 | — | — |
| `loan_start_date` | DATE | 허용 | — | — |
| `income` | BIGINT UNSIGNED | 필수 | 0 | 선택한 기간의 수입 — 원, 가계부 실적과 별개 |
| `income_period` | ENUM('MONTHLY','ANNUAL') | 필수 | — | — |
| `answered_at` | DATETIME | 필수 | — | — |
| `address_lat` | DECIMAL(9,6) | 허용 | — | 설문 주소 검색 당시 행정구역 중심 위도 — addressPoint.lat |
| `address_lon` | DECIMAL(9,6) | 허용 | — | 설문 주소 검색 당시 행정구역 중심 경도 — addressPoint.lon |

- 기본키: `user_id`
- 외래키 `fk_housing_surveys_user`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_survey_flags` CHECK (`management_included` IN (0,1) AND `has_loan` IN (0,1))
- CHECK: CONSTRAINT `ck_survey_loan_rate` CHECK (`loan_annual_rate` BETWEEN 0 AND 100)
- CHECK: CONSTRAINT `ck_survey_loan_day` CHECK (`loan_payment_day` BETWEEN 1 AND 31)
- CHECK: CONSTRAINT `ck_survey_address_point` CHECK ((`address_lat` IS NULL AND `address_lon` IS NULL) OR (`address_lat` IS NOT NULL AND `address_lon` IS NOT NULL AND `address_lat` BETWEEN -90 AND 90 AND `address_lon` BETWEEN -180 AND 180))

### `housing_loans` — 회원별 전세 대출 설정

회원당 전세 대출 설정 하나 — 중지 후에도 같은 ID 재사용

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | CHAR(36) | 필수 | — | UUID — 프론트 loanId |
| `user_id` | BIGINT UNSIGNED | 필수 | — | — |
| `principal` | BIGINT UNSIGNED | 필수 | — | 원금 — 원 |
| `annual_rate` | DECIMAL(5,2) | 필수 | — | 연 이율 — 퍼센트 |
| `payment_day` | TINYINT UNSIGNED | 필수 | — | — |
| `start_date` | DATE | 필수 | — | — |
| `is_active` | TINYINT(1) | 필수 | 1 | — |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | — |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | — / 수정 시 자동 갱신 |

- 기본키: `id`
- UNIQUE `uk_housing_loans_user`: `user_id`
- 외래키 `fk_housing_loans_user`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_housing_loan_terms` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `payment_day` BETWEEN 1 AND 31 AND `is_active` IN (0,1) AND `start_date` BETWEEN '2000-01-01' AND '2100-12-31')

### `loan_interest_charges` — 월별 이자 스냅샷

월별 이자 자동 기록 — 설정 변경 후에도 과거 스냅샷 보존

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `loan_id` | CHAR(36) | 필수 | — | — |
| `charge_date` | DATE | 필수 | — | 한국 날짜 기준 납부일 — 실제 출금 증빙 아님 |
| `period_ym` | INT | 허용 | — | YYYYMM — 날짜에서 생성하여 월 불일치 방지 / 생성 컬럼 — 직접 입력 불가 |
| `principal` | BIGINT UNSIGNED | 필수 | — | 기록 당시 원금 스냅샷 |
| `annual_rate` | DECIMAL(5,2) | 필수 | — | 기록 당시 금리 스냅샷 |
| `amount` | BIGINT UNSIGNED | 필수 | — | 기록 당시 월 예상 이자 — 원 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | — |

- 기본키: `loan_id`, `charge_date`
- UNIQUE `uk_loan_interest_month`: `loan_id`, `period_ym`
- 외래키 `fk_loan_interest_loan`: `loan_id` → `housing_loans` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_loan_interest_snapshot` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `amount` = ROUND(`principal` * `annual_rate` / 1200, 0))

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
- UNIQUE `uk_event_categories_user_name`: `user_id`, `name`
- UNIQUE `uk_event_categories_user_system`: `user_id`, `system_key`
- 외래키 `fk_event_categories_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- UNIQUE `uk_event_presets_category_title`: `category_id`, `title`
- 외래키 `fk_event_presets_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_event_presets_category_id`: `category_id` → `event_categories` (`id`), ON DELETE CASCADE

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
| `is_anniversary` | TINYINT(1) | 필수 | 0 | 기념일 여부 — API anniv, 할 일 완료 및 남은 일 집계에서 제외 |
| `repeat_yearly` | TINYINT(1) | 필수 | 0 | 매년 반복 여부 — API yearly, 기념일 원본 한 행만 저장 |

- 기본키: `id`
- 외래키 `fk_events_category_id`: `category_id` → `event_categories` (`id`), ON DELETE SET NULL
- 외래키 `fk_events_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_events_anniversary_flags` CHECK (`is_anniversary` IN (0,1) AND `repeat_yearly` IN (0,1) AND (`repeat_yearly` = 0 OR `is_anniversary` = 1))

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
- 외래키 `fk_memos_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_memos_items_array` CHECK (JSON_TYPE(`items`) = 'ARRAY')

### `bill_items` — 고정 지출 항목

공과금 항목: 내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 공과금 주인 아이디 |
| `name` | VARCHAR(30) | 필수 | — | 공과금 이름 — 가스, 전기, 수도 등 |
| `default_amount` | BIGINT UNSIGNED | 필수 | 0 | 평소 금액 — 원 단위 |
| `is_active` | TINYINT(1) | 필수 | 1 | 사용 여부 — 해지한 항목은 0 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |
| `tag` | VARCHAR(24) | 필수 | '공과금' | 회원별 고정 지출 카테고리 이름 |

- 기본키: `id`
- 외래키 `fk_bill_items_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

### `bill_payments` — 월별 고정 지출

공과금 납부: 공과금 항목별 월별 청구·납부 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 공과금납부 아이디 — 자동 증가 / 자동 번호 |
| `bill_item_id` | BIGINT UNSIGNED | 필수 | — | 공과금 항목 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | BIGINT UNSIGNED | 필수 | — | 그 달 금액 — 원 단위 |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- UNIQUE `uk_bill_payments_bill_item_id_period_ym`: `bill_item_id`, `period_ym`
- 외래키 `fk_bill_payments_bill_item_id`: `bill_item_id` → `bill_items` (`id`), ON DELETE CASCADE

### `rent_payments` — 월별 월세

월세 납부: 월별 월세 납부 기록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 월세납부 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 월세 내는 사용자 아이디 |
| `period_ym` | CHAR(7) | 필수 | — | 대상 연월 — 예: 2026-10 |
| `amount` | BIGINT UNSIGNED | 필수 | — | 그 달 월세 — 원 단위 (설정의 월세 × 10000) |
| `paid_at` | DATETIME | 허용 | — | 납부 일시 — 비어 있으면 미납 |

- 기본키: `id`
- UNIQUE `uk_rent_payments_user_id_period_ym`: `user_id`, `period_ym`
- 외래키 `fk_rent_payments_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- 외래키 `fk_notifications_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

### `ledger_categories` — 가계부 분류

가계부 분류: 수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 분류 아이디 — 자동 증가 / 자동 번호 |
| `kind` | ENUM('INCOME','EXPENSE') | 필수 | — | 분류 구분 — 수입 / 기타 지출 |
| `name` | VARCHAR(24) | 필수 | — | 분류 이름 — 회원별 표시 목록은 설정 JSON에서 관리 |
| `color` | VARCHAR(32) | 필수 | — | 기본 표시 색 — 회원별 색은 설정 JSON 우선 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 정렬 순서 |

- 기본키: `id`
- UNIQUE `uk_ledger_categories_kind_name`: `kind`, `name`

### `incomes` — 수입

수입: 가계부 "수입" 탭에서 기록하는 수입 한 건.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 수입 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 수입 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 수입 종류 아이디 — 월급, 아르바이트 등 |
| `amount` | BIGINT UNSIGNED | 필수 | — | 수입 금액 — 원 단위 |
| `income_date` | DATE | 필수 | — | 번 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 주말 카페 알바 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 기록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |
| `income_type` | ENUM('FIXED','OTHER') | 필수 | 'OTHER' | 고정 수입 또는 기타 수입 — API incomeType의 fixed/other와 변환 |

- 기본키: `id`
- 외래키 `fk_incomes_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_incomes_category_id`: `category_id` → `ledger_categories` (`id`), ON DELETE RESTRICT

### `expenses` — 기타 지출

기타 지출: 가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등).

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 지출 아이디 — 자동 증가 / 자동 번호 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 지출 주인 아이디 |
| `category_id` | BIGINT UNSIGNED | 필수 | — | 지출 분류 아이디 — 식비, 교통 등 |
| `amount` | BIGINT UNSIGNED | 필수 | — | 지출 금액 — 원 단위 |
| `expense_date` | DATE | 필수 | — | 쓴 날짜 |
| `memo` | VARCHAR(100) | 허용 | — | 메모 — 예: 점심 제육덮밥 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 기록 일시 |
| `updated_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 수정 일시 / 수정 시 자동 갱신 |

- 기본키: `id`
- 외래키 `fk_expenses_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_expenses_category_id`: `category_id` → `ledger_categories` (`id`), ON DELETE RESTRICT

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
- 외래키 `fk_posts_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_posts_region_id`: `region_id` → `regions` (`id`), ON DELETE RESTRICT

### `post_likes` — 좋아요

글 좋아요: 누가 어느 글에 좋아요를 눌렀는지.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 받은 글 아이디 |
| `user_id` | BIGINT UNSIGNED | 필수 | — | 좋아요 누른 사용자 아이디 — 한 사람당 한 번 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 좋아요 일시 |

- 기본키: `post_id`, `user_id`
- 외래키 `fk_post_likes_post_id`: `post_id` → `posts` (`id`), ON DELETE CASCADE
- 외래키 `fk_post_likes_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- 외래키 `fk_comments_post_id`: `post_id` → `posts` (`id`), ON DELETE CASCADE
- 외래키 `fk_comments_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_comments_parent_id`: `parent_id` → `comments` (`id`), ON DELETE CASCADE

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
| `target_author_snapshot` | VARCHAR(12) | 허용 | — | 신고 당시 작성자 표시명 — 삭제 후 표시용, 권한 근거로 사용 금지 |
| `target_text_snapshot` | VARCHAR(200) | 허용 | — | 신고 당시 글 제목 또는 댓글 내용 — 서버가 실제 대상에서 복사 |

- 기본키: `id`
- UNIQUE `uk_reports_reporter_target`: `reporter_id`, `target_type`, `target_id`
- 외래키 `fk_reports_reporter_id`: `reporter_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_reports_handled_by`: `handled_by` → `users` (`id`), ON DELETE SET NULL

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

- 기본키: `id`
- 외래키 `fk_user_sanctions_revoked_by`: `revoked_by` → `users` (`id`), ON DELETE SET NULL
- 외래키 `fk_user_sanctions_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_user_sanctions_report_id`: `report_id` → `reports` (`id`), ON DELETE SET NULL
- 외래키 `fk_user_sanctions_created_by`: `created_by` → `users` (`id`), ON DELETE SET NULL

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
- 외래키 `fk_support_inquiries_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_support_answered_by`: `answered_by` → `users` (`id`), ON DELETE SET NULL

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
- UNIQUE `uk_ai_topics_code`: `code`

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
- 외래키 `fk_uploaded_files_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

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
- 외래키 `fk_user_profiles_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_user_profiles_avatar_file_id`: `avatar_file_id` → `uploaded_files` (`id`), ON DELETE SET NULL

### `post_attachments` — 게시글 첨부 연결

게시글과 첨부파일 연결

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `post_id` | BIGINT UNSIGNED | 필수 | — | 첨부한 게시글 아이디 |
| `file_id` | BIGINT UNSIGNED | 필수 | — | 업로드 파일 아이디 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 게시글 안의 표시 순서 — 0부터 |

- 기본키: `post_id`, `file_id`
- UNIQUE `uk_post_attachments_file_id`: `file_id`
- UNIQUE `uk_post_attachments_post_sort`: `post_id`, `sort_order`
- 외래키 `fk_post_attachments_post_id`: `post_id` → `posts` (`id`), ON DELETE CASCADE
- 외래키 `fk_post_attachments_file_id`: `file_id` → `uploaded_files` (`id`), ON DELETE CASCADE

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
- 외래키 `fk_ai_conversations_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_ai_conversations_topic_id`: `topic_id` → `ai_topics` (`id`), ON DELETE SET NULL

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
- 외래키 `fk_ai_messages_conversation_id`: `conversation_id` → `ai_conversations` (`id`), ON DELETE CASCADE
- 외래키 `fk_ai_messages_attachment_id`: `attachment_id` → `uploaded_files` (`id`), ON DELETE SET NULL

### `ai_usage_daily` — AI 하루 사용량

AI 하루 사용량: 사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 사용자 아이디 |
| `usage_date` | DATE | 필수 | — | 사용 날짜 |
| `question_count` | INT UNSIGNED | 필수 | 0 | 하루 질문 횟수 |

- 기본키: `user_id`, `usage_date`
- 외래키 `fk_ai_usage_daily_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE

### `trash_schedules` — 쓰레기 배출 요일표

쓰레기 배출 일정: 동네(시군구) · 배출장소별 생활쓰레기 · 음식물 · 재활용 배출 요일과 시작 시각. 출처: 전국생활쓰레기배출정보표준데이터

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 배출일정 아이디 — 자동 증가 / 자동 번호 |
| `region_id` | BIGINT UNSIGNED | 필수 | — | 동네 아이디 — 시군구 |
| `place` | VARCHAR(100) | 필수 | — | 배출장소 — 예: 내 집 혹은 내 점포 앞 |
| `general_days` | SET('일','월','화','수','목','금','토') | 필수 | '' | 생활쓰레기 배출 요일 — 예: 월,수,금 (없으면 빈 값) |
| `general_time` | TIME | 선택 | NULL | 생활쓰레기 배출 시작 시각 — 배출 요일이 없으면 비움 |
| `food_days` | SET('일','월','화','수','목','금','토') | 필수 | '' | 음식물쓰레기 배출 요일 |
| `food_time` | TIME | 선택 | NULL | 음식물쓰레기 배출 시작 시각 |
| `recycle_days` | SET('일','월','화','수','목','금','토') | 필수 | '' | 재활용품 배출 요일 |
| `recycle_time` | TIME | 선택 | NULL | 재활용품 배출 시작 시각 |

- 기본키: `id`
- 인덱스 `idx_trash_schedules_region_id`: `region_id`
- 외래키 `fk_trash_schedules_region_id`: `region_id` → `regions` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_trash_any_day` CHECK (세 종류 중 하나는 배출 요일이 있음)
- CHECK: CONSTRAINT `ck_trash_day_time` CHECK (종류마다 배출 요일이 있으면 시각도 있고, 없으면 시각도 없음)
- 데이터: `db/data/생활쓰레기배출정보.csv` → `python db/tools/trash_import.py` → `db/migrations/20261122_01_regions_nationwide.sql` · `20261122_02_trash_schedules_nationwide.sql`

### `place_categories` — 장소 분류

장소 분류: 지도 화면의 칩(세탁방·편의점·약국·마트) 목록.

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | 필수 | — | 장소 분류 아이디 — 자동 증가 / 자동 번호 |
| `name` | VARCHAR(20) | 필수 | — | 장소 분류 이름 — 세탁방, 편의점 등 |
| `sort_order` | TINYINT UNSIGNED | 필수 | 0 | 정렬 순서 |
| `icon` | VARCHAR(20) | 필수 | '📍' | 장소 분류 그림 |

- 기본키: `id`
- UNIQUE `uk_place_categories_name`: `name`

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
- 외래키 `fk_places_region_id`: `region_id` → `regions` (`id`), ON DELETE RESTRICT
- 외래키 `fk_places_category_id`: `category_id` → `place_categories` (`id`), ON DELETE RESTRICT
- CHECK: CONSTRAINT `ck_places_point` CHECK (`lat` BETWEEN -90 AND 90 AND `lon` BETWEEN -180 AND 180)

### `place_favorites` — 장소 즐겨찾기

사용자별 지도 즐겨찾기

| 컬럼 | SQL 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `user_id` | BIGINT UNSIGNED | 필수 | — | 소유 사용자 번호 |
| `place_id` | BIGINT UNSIGNED | 필수 | — | 저장한 장소 번호 |
| `created_at` | DATETIME | 필수 | CURRENT_TIMESTAMP | 등록 일시 |

- 기본키: `user_id`, `place_id`
- 외래키 `fk_place_favorites_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- 외래키 `fk_place_favorites_place_id`: `place_id` → `places` (`id`), ON DELETE CASCADE

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
- UNIQUE `uk_place_reviews_place_id_user_id`: `place_id`, `user_id`
- 외래키 `fk_place_reviews_place_id`: `place_id` → `places` (`id`), ON DELETE CASCADE
- 외래키 `fk_place_reviews_user_id`: `user_id` → `users` (`id`), ON DELETE CASCADE
- CHECK: CONSTRAINT `ck_place_review_rating` CHECK (`rating` BETWEEN 1 AND 5)

## 6. VIEW와 기본 데이터

| VIEW | 반환값 | 의미 |
|---|---|---|
| v_monthly_income | user_id, period_ym, total_amount | 회원·월별 전체 수입 합계 |
| v_monthly_spend_breakdown | user_id, period_ym, label, amount | 월세 + 고정 지출 전체 + 기타 지출 + 기록된 전세 대출 이자; 미납 청구 포함 |

두 VIEW는 기존 API 모양을 유지합니다. SUM의 실제 타입은 MySQL 식에서 결정됩니다. 월별 월세·고정 지출 행은 서버가 생성해야 하며 같은 월의 중복은 UNIQUE 키로 막습니다. expenses에 월세·고정 지출을 중복 저장하지 않습니다.

기본 데이터는 동네 12개, 일부 이웃 관계, 수입 분류 10개·지출 분류 6개, AI 주제 10개, 장소 분류 15개, 예시 배출 일정 6개, 약관 3종입니다. 약관 버전은 2026-10-18을 유지합니다. 지역·배출표는 예시이며 실제 운영 지역 데이터와 구분합니다.

INSERT IGNORE는 기존 고유 키의 행을 갱신하지 않습니다. 장소 아이콘은 명시적 UPDATE로 보완합니다. 개인별 일정 기본 카테고리와 항목은 별도 초기 데이터 파일을 사용합니다.

## 7. 서버 연결 시 검증 사항

- 개인 데이터 소유권, 관리자 권한, 파일 MIME·소유권·최대 5개/합계 2MB는 서버에서 검사합니다. FK는 같은 사용자 소유인지까지 보장하지 않습니다.
- 비밀번호·토큰 해시 생성, 이메일 인증 만료·사용 횟수·일회 사용, 로그인 세션 회수는 서버 로직입니다.
- 좌표 범위·좌표 쌍, JSON 원소 형식·개수·소유권, 금액·날짜·태그·수입 분류 일치 여부를 검사합니다.
- 회원 상태와 제재 기간 만료·해제는 트랜잭션과 조회 시 검사를 통해 일관되게 처리합니다.
- 외부 저장소 파일은 FK 삭제로 제거되지 않으므로 실제 파일 정리가 필요합니다. 프로필·게시글에 연결된 파일을 임의로 재사용하지 않도록 검사합니다.
- 데이터베이스 ID는 API에서 문자열로, DATETIME은 합의된 시간대(권장 UTC 저장 후 ISO 변환)로 반환합니다. 일정 날짜·시간과 납부 연월은 한국의 달력 날짜를 유지합니다.
- 알림·좋아요·댓글 건수 등 파생값, 보고서 대상의 존재 여부는 서버가 관리합니다.

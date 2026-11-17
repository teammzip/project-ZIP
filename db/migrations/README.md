> 2026-11-07 최신 변경: [생활 카테고리·월별 납부·집 주소 가이드](../LIFE_CATEGORIES.md). 기존 DB는 `20261102` 다음 `20261107_life_categories.sql`을 적용합니다. 최신 감사 기준: 44테이블 / 358컬럼 / 71키 / 62FK / 15CHECK / 2VIEW. 아래 이전 날짜의 수치는 당시 이력입니다.

# DB 마이그레이션 적용 안내 (2026-11-07)

## 적용 순서

### 2026-11-15 커뮤니티 운영 (글 · 댓글 삭제 기록 · 목록 키)

`20261115_04_community_admin.sql`을 한 번 실행합니다. `posts` · `comments`에 `deleted_by`(지운 사람, users FK · SET NULL)와 `delete_reason`(운영자가 지운 사유, 200자)을 추가하고, 목록 속도용 키 `idx_posts_status_created_at`(전체 동네 글 목록) · `idx_reports_created_at`(관리자 신고 목록)을 만듭니다. 파일 앞의 사전 확인 세 값이 모두 0이어야 하고, ALTER라 다시 실행하면 실패합니다. 기존 데이터는 그대로이고 새 칸은 비어 있어요. 격리 MySQL 8.0에서 새 DB(schema.sql)와 마이그레이션 적용 DB의 두 표 구조가 같음을 확인했습니다. 새 DB는 최신 schema.sql만 실행합니다.

### 2026-11-15 지도 저장 리스트

`20261115_kakao_place_favorites.sql`까지 적용된 DB에 `20261115_03_place_lists.sql`을 한 번 실행합니다. `place_lists`(회원이 만든 장소 묶음: 내 장소 · 맛집 …)와 `place_list_items`(리스트에 넣은 장소, `place_key` = DB 장소 번호 또는 `kakao:카카오장소id`) 두 표를 추가합니다. 이메일 인증 파일과는 서로 영향이 없어 순서는 상관없습니다. 다시 실행해도 안전합니다. 새 DB는 최신 schema.sql만 실행합니다. 감사 기준(schema_expected.json)에는 아직 반영하지 않았습니다(+2표).

### 2026-11-15 휴대전화 인증 → 이메일 인증

20261115_kakao_place_favorites까지 적용된 DB에 `20261115_02_email_verification.sql`을 한 번 실행합니다. users에서 phone·phone_verified_at을 지우고 email은 비어도 되는 채로 두고 email_verified_at을 추가합니다. phone_verifications를 지우고 email_verifications를 만들고, password_resets.method에서 PHONE을 빼고, banned_identities(재가입 차단)를 삭제합니다. 파일 앞의 사전 확인 SQL 두 개가 모두 0이어야 합니다. ALTER·DROP이라 다시 실행하면 실패합니다. 새 DB는 최신 schema.sql만 실행합니다.

### 2026-11-15 카카오 장소 즐겨찾기

20261108까지 적용된 DB에 `20261115_kakao_place_favorites.sql`을 한 번 실행합니다. `kakao_place_favorites` 표 하나를 추가합니다(카카오 장소 id · 이름만, 주소 · 좌표 없음). 다시 실행해도 안전합니다. 새 DB는 최신 schema.sql만 실행합니다. 위 표 수 · 컬럼 수 감사 기준에는 아직 반영하지 않았습니다(+1표 · 5컬럼).

### 2026-11-08 지도 카카오 출처

20261107까지 적용된 DB에 `20261108_places_kakao.sql`을 한 번 실행합니다. `places.source`에 `KAKAO`를 추가하고 `(source, source_id)` UNIQUE를 만듭니다. 파일 안의 사전 확인 SQL이 0줄인지 먼저 봅니다. 새 DB는 최신 schema.sql만 실행합니다.

전체 경로: `20261031_current_project.sql` → `20261031_02_event_anniversaries.sql` → `20261101_housing_and_loan.sql` → `20261102_requirements_hardening.sql` → `20261107_life_categories.sql`. 이미 적용한 파일은 다시 실행하지 않습니다.

### 2026-11-07 개인 카테고리·집 주소

20261102까지 적용된 DB에 20261107 파일을 한 번 실행합니다. home_address/ledger_category_settings와 tag/name/color 타입을 먼저 확인하고 일부만 반영됐으면 전체를 재실행하지 않습니다. 상세 절차는 [생활 기능 적용 가이드](../LIFE_CATEGORIES.md)를 따릅니다. 적용 후 정상 24번 → 예외 25번 → 구조 감사 15번 순서로 검증합니다. 새 DB는 최신 schema.sql만 실행합니다.

### 2026-11-02 최신 요구사항·예외 보완

기존 44개 테이블에 `20261102_requirements_hardening.sql`을 한 번 추가 적용합니다. 새 DB에는 최신 schema.sql만 실행합니다. 기존 35개부터라면 20261031_current_project → 20261031_02_event_anniversaries → 20261101_housing_and_loan → 20261102_requirements_hardening 순서입니다.

사전 검사 SQL과 zip_test 적용 사본은 [최신 테스트 가이드](../tests/LATEST_REQUIREMENTS_GUIDE.md) 및 21_latest_requirements_upgrade.sql에 있습니다. 운영 적용은 백업과 쓰기 중단 후 원본 파일의 대상 DB를 확인합니다. 중복 신고·잘못된 좌표/JSON/별점/요일을 자동 삭제하거나 보정하지 않습니다. 제약조건 추가가 실패할 수 있으므로 모든 사전 위반을 먼저 확인하고, 부분 실패 후 전체 파일을 무조건 재실행하지 않습니다. DDL은 암묵 커밋되며 롤백 파일은 제공하지 않습니다.

새 위치 컬럼은 NULL, 신고 스냅샷도 NULL로 시작합니다. 기존 주소 좌표·작성자 정보를 추정하여 채우지 않습니다. 기존 reports 중복은 UNIQUE 생성 전에 이력 보존 방안을 정해야 합니다.

### 2026-11-01 주거 설문·대출 추가

최신 schema.sql은 44개 테이블입니다. 새 DB에는 schema.sql만 실행합니다. 기존 41개 테이블 DB에는 기념일 정식 컬럼을 확인한 뒤 `20261101_housing_and_loan.sql`을 한 번 실행합니다. 기존 35개 테이블이라면 아래 두 10월 마이그레이션 다음에 이 파일을 실행합니다. 모든 작업 전 백업하고 쓰기를 중지합니다. 금액 타입 확장으로 테이블 잠금/재구성이 발생할 수 있으므로 복제한 테스트 DB에서 먼저 확인합니다.

**`20261101_event_anniversary.sql`은 이름이 다른 중복 경로이므로 실행하지 마세요.** 정식 컬럼은 `is_anniversary`, `repeat_yearly`입니다. 이미 `is_anniv`, `is_yearly`로 적용한 DB는 SHOW CREATE TABLE events로 확인하고 별도 정리해야 합니다. 정식 컬럼이 없다면 이전 컬럼을 정식 이름으로 RENAME COLUMN하고 기념일 CHECK를 추가하는 방식으로 데이터를 보존합니다. 두 쌍이 모두 있으면 값을 비교해 충돌을 해결한 뒤 정식 컬럼으로 이관하며, 확인 없이 이전 컬럼을 삭제하지 않습니다. 새 주거 마이그레이션은 이 충돌을 자동으로 해결하지 않습니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/migrations/20261101_housing_and_loan.sql"
```

아래는 이전 41개 테이블까지의 적용 순서입니다.

- 새 DB: 최신 `../schema.sql`만 실행합니다.
- 기존 35개 테이블 DB: `20261031_current_project.sql` → `20261031_02_event_anniversaries.sql` 순서로 실행합니다. 파일명 사전순으로 자동 실행하지 않습니다.
- 첫 번째 마이그레이션까지 적용한 DB: `20261031_02_event_anniversaries.sql`만 실행합니다.
- 기념일 컬럼까지 적용된 DB: 두 파일 모두 다시 실행하지 않습니다.

기념일 추가 파일은 기존 일정의 두 플래그를 0으로 초기화하며, 일정·금액·완료 기록을 삭제하지 않습니다. 적용 후 `SHOW CREATE TABLE events`로 `is_anniversary`, `repeat_yearly`, `ck_events_anniversary_flags`를 확인합니다. `(0,0)`, `(1,0)`, `(1,1)`은 허용하고 `(0,1)`은 거부해야 합니다. 실제 MySQL 실행 검증은 별도 수행해야 합니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/migrations/20261031_02_event_anniversaries.sql"
```

## 첫 번째 마이그레이션

대상은 기존 schema.sql의 35개 테이블 설계입니다. 새 DB는 ../schema.sql만 실행합니다. 수정된 React 코드나 브라우저 localStorage를 이 SQL이 가져오지는 않습니다.

1. 기존 DB를 백업하고 애플리케이션의 쓰기를 중단합니다.
2. MySQL 8.0.16 이상인지, 기존 테이블·컬럼이 35개 표 버전인지 확인합니다. 이미 일부 변경을 적용했다면 파일을 그대로 재실행하지 않습니다.
3. 프로젝트 루트에서 다음 명령을 한 번 실행합니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/migrations/20261031_current_project.sql"
```

4. todos_legacy_20261031의 행 수와 이전된 events를 비교합니다. 이전 ID는 적용 직전 events의 최대 ID + 원본 todos.id입니다. 생성 날짜를 일정 날짜로 사용하며 기존 일정·완료 시각을 덮어쓰지 않습니다. 보관 표는 자동 삭제하지 않습니다.
5. 기존 수입은 월급·이자·연금·임대 수입·기타 고정 수입을 FIXED, 나머지를 OTHER로 분류했습니다. 실제 기록을 표본 확인하세요.
6. 기존 고정 지출은 공과금 태그로 유지합니다. 개인 설정의 JSON과 프로필은 기존 값이 없으므로 NULL/기본값을 API에서 처리합니다.
7. 기존 제재의 재가입 차단 해시는 서버의 HMAC 키로 별도 채워야 합니다. 해당 작업 전 회원 삭제를 허용하지 않습니다.
8. 새 기능 API의 소유권 검사·정지 해제·카테고리 삭제 시 항목 이동 등을 구현한 뒤 서비스를 재개합니다.

MySQL DDL은 암묵 커밋됩니다. 중간 실패 시 백업과 실제 스키마를 확인하고 실패 지점부터 복구해야 합니다. 이 파일은 재실행용·자동 롤백용이 아닙니다. 이전 할 일 ID를 참조하는 외부 시스템이 있다면 위 ID 변환을 함께 적용해야 합니다.

# 2026-11-01 기념일 칸 (실행하지 않음)

기념일 칸의 정식 이름은 `is_anniversary` · `repeat_yearly`이고, `20261031_02_event_anniversaries.sql`이 추가합니다. `20261101_event_anniversary.sql`(`is_anniv` · `is_yearly`)은 이름이 다른 중복 경로라 **DEPRECATED**입니다. 위쪽 안내대로 실행하지 마세요.
# 2026-11-18 월별 고정 지출 납부 기한·사진 등록

고지서 내용 식별 중복 차단에는 `20261118_03_bill_document_keys.sql`도 적용합니다. 기존 데이터를 변경하지 않고 회원별 문서 식별 해시·항목 연결 테이블을 추가합니다. 발행처·식별번호·청구 월 원문은 저장하지 않습니다.

이어 `20261118_02_bill_monthly_memo.sql`을 적용하면 고정 지출 양식의 선택 메모를 저장합니다. 현재 로컬 DB에는 적용했습니다. 신규 DB는 schema.sql에 포함되어 있습니다.

기존 `bill_items`·`bill_payments`가 있는 DB에서 `20261118_01_bill_monthly_registration.sql`을 한 번 실행합니다.
`bill_payments.due_date DATE NULL`과 사진 중복 방지용 `bill_photo_imports`를 추가합니다. 기존 금액·납부 상태는 변경하지 않습니다.
신규 DB는 최신 schema.sql을 사용합니다. 현재 작업에서 연결된 로컬 DB에는 적용했습니다. 같은 DB에 ALTER를 재실행하지 마세요.
검증/다른 개발자 적용은 루트 MONTHLY_BILLS_WRITE_VERIFICATION.md를 따릅니다. 사진 원본은 저장하지 않고 회원별 SHA-256을 저장합니다.

- 20261118_04_bill_monthly_delete.sql: 선택 월 삭제 시각 및 삭제 기록 제외 지출 집계 뷰. 자동 검증은 FIXED_EXPENSE_DELETE_VERIFICATION.md 참고.

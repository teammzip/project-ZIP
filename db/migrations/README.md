# DB 마이그레이션 — 쓰던 DB를 새 코드에 맞추기

- **새 DB**: [`../schema.sql`](../schema.sql)을 실행한 뒤, 데이터 마이그레이션 `20261122_01` · `20261122_02`(전국 지역 · 쓰레기 배출표)만 실행해요. 나머지 파일은 필요 없어요.
- **이미 쓰던 DB**: 아래 표에서 **아직 적용하지 않은 파일부터 위에서 아래로** 한 번씩 실행해요. 실행 전에 꼭 백업(mysqldump)하고, 대상 DB를 고른 연결에서 실행해요.
- 어디까지 적용됐는지 모르겠으면 `SHOW CREATE TABLE 표이름` 으로 그 파일이 만드는 칸 · 표 · 키가 있는지 보고 판단해요.
- MySQL 의 ALTER · CREATE 는 바로 확정(암묵 커밋)돼서 되돌릴 수 없어요. 중간에 실패하면 **파일 전체를 무조건 다시 돌리지 말고**, 어디까지 들어갔는지 확인한 뒤 남은 부분만 실행해요. "다시 실행"이 ⭕ 인 파일은 이미 있는 것을 건너뛰어서 통째로 다시 돌려도 돼요.

```powershell
mysql -u root -p --default-character-set=utf8mb4 zip --execute="source db/migrations/파일이름.sql"
```

## 파일 순서

| 파일 | 하는 일 | 다시 실행 |
|---|---|:---:|
| `20261031_current_project.sql` | 처음 35개 표 설계 → 10-31 설계로 전환 (아래 주의 1) | ❌ |
| `20261031_02_event_anniversaries.sql` | 일정에 기념일 · 매년 반복 칸 (`is_anniversary` · `repeat_yearly`) | ❌ |
| `20261101_housing_and_loan.sql` | 주거 설문 · 전세 대출 · 월별 이자 표, 금액 칸 확장 (아래 주의 2) | ❌ |
| `20261102_requirements_hardening.sql` | 신고 중복 방지 · 신고 당시 내용 · 위치 출처 칸 (아래 주의 3) | ❌ |
| `20261107_life_categories.sql` | 개인 분류 설정 · 집 주소 · 분류 칸 길이 | ❌ |
| `20261108_places_kakao.sql` | 장소 출처에 `KAKAO` 추가 · (출처, 원본 id) 중복 방지 (적용 전 파일 안 사전 확인 SQL 이 0줄이어야 함) | ❌ |
| `20261115_kakao_place_favorites.sql` | 카카오 검색 장소 즐겨찾기 표 | ⭕ |
| `20261115_02_email_verification.sql` | 휴대전화 인증 → 이메일 인증, 재가입 차단 표 삭제 (아래 주의 4) | ❌ |
| `20261115_03_place_lists.sql` | 지도 저장 리스트 표 2개 | ⭕ |
| `20261115_04_community_admin.sql` | 글 · 댓글의 지운 사람 · 사유, 전체 글 · 신고 목록 키 (파일 앞 사전 확인 세 값이 0이어야 함) | ❌ |
| `20261115_user_personal_info.sql` | 회원 개인 정보 표 (생년월일) | ⭕ |
| `20261115_home_contracts.sql` | 내 집 계약 표 | ⭕ |
| `20261118_01_bill_monthly_registration.sql` | 고정 지출 납부 기한 칸 · 고지서 사진 중복 방지 표 | ❌ |
| `20261118_02_bill_monthly_memo.sql` | 고정 지출 월별 메모 칸 | ❌ |
| `20261118_03_bill_document_keys.sql` | 고지서 내용 중복 방지 표 (원문은 저장 안 함) | ⭕ |
| `20261118_04_bill_monthly_delete.sql` | 고정 지출 월별 삭제 칸 · 지출 집계 VIEW 갱신 | ❌ |
| `20261118_05_contract_auto_register.sql` | 계약 자동 등록 시간대 칸 (적용 후 서버 재시작) | ❌ |
| `20261118_06_bill_photo_drafts.sql` | 고지서 사진 인식 임시 결과 표 (30분 후 만료) | ⭕ |
| `20261118_07_contract_payment_changes.sql` | 월세 납부 기한 · 이자 납부 시각 칸 (아래 주의 5) | ⭕ |
| `20261118_08_contract_payment_effective_from.sql` | 내 집 정보 납부 조건의 반영 시작일 칸 (적용 후 서버 재시작) | ⭕ |
| `20261118_09_management_contract_kind.sql` | 관리비가 어느 계약(월세 · 전세) 것인지 칸 (과거에 섞여 저장된 행의 유형은 복원 못 함) | ⭕ |
| `20261119_01_bill_termination.sql` | 고정 지출 해지 적용일 칸 (적용 후 서버 재시작) | ⭕ |
| `20261119_02_ledger_memos.sql` | 메모의 가계부 연결 칸 3개 | ⭕ |
| `20261119_03_salary_income.sql` | 월급 자동 등록 표 2개 | ⭕ |
| `20261120_01_community_post_views.sql` | 글 조회 수 · 인기 글 키 | ⭕ |
| `20261121_01_housing_onboarding.sql` | 주거 설문 진행 상태 · 설문 중 임시 저장 칸 (아래 주의 6) | ❌ |
| `20261121_02_salary_record_deletion.sql` | 월급 기록이 지운 수입을 비워 둘 수 있게 (지운 달 재생성 방지) | ⭕ |
| `20261121_03_ledger_category_label_case.sql` | 가계부 분류 이름의 영문 대소문자 구분 | ⭕ |
| `20261121_04_login_lockout.sql` | 로그인 실패 횟수 · 잠금 시작 시각 칸 (적용 후 서버 재시작) | ❌ |
| `20261121_04_post_list_indexes.sql` | 홈 꿀팁 · 동네 글 목록 · 관리자 회원 목록 인덱스 4개 (부하 테스트에서 느린 곳) | ⭕ |
| `20261121_05_trash_schedule_places.sql` | 쓰레기 배출표를 시작 시각 · 배출장소 형식으로 (안내 문구 칸 삭제, 처음 실행 때 기존 예시 행 삭제) | ⭕ |
| `20261121_06_trash_schedule_columns.sql` | 쓰레기 배출표를 원본 CSV 모양으로: 동네 · 장소 한 줄에 생활쓰레기 · 음식물 · 재활용 배출 요일 · 시작 시각 (이전 모양이면 표를 지우고 새로 만듦). 적용 후 `20261122_01` · `02` 로 데이터를 넣음 | ⭕ |
| `20261121_07_notices.sql` | 관리자 공지사항 표 (고정 · 팝업) | ⭕ |
| `20261122_01_terms_sync.sql` | 약관 3종 본문을 화면 문구와 똑같이 (쓰레기 배출 공공데이터 출처, 주소는 가입 후 입력, 예전 문구 정리). 버전 · 동의 기록은 그대로 | ⭕ |
| `20261122_03_place_reviews.sql` | 장소 리뷰 표 두 개: 카카오 검색 장소 리뷰 `kakao_place_reviews`(카카오 장소 id · 이름 + 회원 별점 · 한 줄 리뷰, 주소 · 좌표 없음) · 리뷰 신고 `place_review_reports` | ⭕ |
| `20261122_01_regions_nationwide.sql` | **데이터** — 전국 시도 16 · 시군구 233 (`regions`, 없는 것만 추가 · 지역 번호 그대로) | ⭕ |
| `20261122_02_trash_schedules_nationwide.sql` | **데이터** — 쓰레기 배출표 6,218줄 (`trash_schedules` 를 모두 지우고 다시 넣음, 01 다음에 실행). 마지막에 `파일 줄 수 6218 · 넣은 줄 수 6218 · 지역 없음 0` 이면 정상 | ⭕ |

`20261101_event_anniversary.sql` 은 **실행하지 마세요**(폐기). 같은 기능을 다른 칸 이름(`is_anniv` · `is_yearly`)으로 만드는 옛 파일이에요. 이미 실행한 DB 는 그 두 칸을 정식 이름으로 `RENAME COLUMN` 하고 기념일 CHECK 를 추가해요 — 확인 없이 지우지 마세요.

## 꼭 알아야 할 주의

1. **20261031_current_project** — 옛 `todos` 를 `events` 로 옮겨요(새 번호 = 적용 직전 events 최대 번호 + 옛 todos 번호, 만든 날짜를 일정 날짜로). 옛 표는 `todos_legacy_20261031` 로 남겨 두니 행 수를 비교해 보세요. 옛 수입은 월급 · 이자 · 연금 · 임대 수입 · 기타 고정 수입을 FIXED, 나머지를 OTHER 로 나눠요.
2. **20261101_housing_and_loan** — 금액 칸 타입을 넓혀서 표가 잠기거나 다시 만들어질 수 있어요. 복사한 DB 에서 먼저 해 보세요.
3. **20261102_requirements_hardening** — 중복 신고 · 잘못된 좌표/JSON/별점/요일을 자동으로 지우거나 고치지 않아요. 제약 추가가 실패하면 위반 행을 먼저 확인해요(사전 검사 SQL 은 [`../tests/21_latest_requirements_upgrade.sql`](../tests/21_latest_requirements_upgrade.sql)). 새 위치 · 신고 스냅샷 칸은 비어서 시작해요.
4. **20261115_02_email_verification** — 회원의 휴대전화 번호 칸과 휴대전화 인증 · 재가입 차단 표를 지워요(데이터도 사라짐). 파일 앞 사전 확인 SQL 두 개가 모두 0이어야 해요.
5. **20261118_07_contract_payment_changes** — 1175(Safe Update) · 1060(중복 칸)으로 멈췄으면 파일 전체를 같은 연결에서 다시 실행하면 돼요(있는 칸은 건너뜀). 옛 월세의 납부 기한은 지금 설정의 납부일로 채워요(실제 과거 날짜 복원 아님). 적용 후 `SHOW COLUMNS` 로 `due_date`=DATE, `paid_at`=DATETIME 인지 확인해요.
6. **20261121_01_housing_onboarding** — 파일 전체를 한 연결에서 실행해요(중간에 Safe Update 를 잠깐 끄고 원래대로 돌림). 계약이 있는 회원은 COMPLETED, 로그인한 적 있는 나머지는 SKIPPED, 새 회원은 PENDING 이 돼요.

## 마이그레이션을 새로 만들 때

1. `db/schema.sql` 을 같은 모양으로 고치고, 이 폴더에 `날짜_번호_내용.sql` 을 추가해요. 가능하면 `information_schema` 로 이미 있는지 보고 건너뛰게 써요(다시 실행 ⭕).
2. [`../tests/migration-path.cjs`](../tests/migration-path.cjs) 목록과 [`../tests/19_migration_upgrade.sql`](../tests/19_migration_upgrade.sql) 끝에 같은 파일을 순서대로 넣어요.
3. 저장소 최상위에서 비교 자료를 갱신하고 검사해요.

```powershell
node db/tests/generate-schema-audit.cjs                                   # schema_expected.json · 15/20번 감사 SQL 갱신
node --test --test-reporter=spec db/tests/schema-assets.test.cjs          # 빠진 파일 · 새 DB 와 업그레이드 DB 구조 비교
node db/tests/run-isolated-mysql.cjs                                      # 격리 MySQL 9.6 에서 전체 실행 검증
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

- 20261118_05_contract_auto_register.sql: 계약 자동 등록용 확정 시간대. 기존 home_contracts에 한 번 적용 후 서버 재시작.

- 20261118_06_bill_photo_drafts.sql: 고지서 사진·QR 인식 후 사용자 동의를 기다리는 임시 결과 테이블. AI 고지서 기능 사용 전 실제 연결 DB에 적용합니다. 30분 후 만료되며 사진 원본·QR 원문은 저장하지 않습니다.

- 20261118_07_contract_payment_changes.sql: 월세 due_date, 이자 paid_at 추가. 금액·납부일 변경 시 오늘 이후 미납·예정 기록 갱신에 필요합니다. 과거 월세에 없던 납부일은 현재 user_settings.rent_day로 보완하므로 과거 실제 납부일을 복원하는 것은 아닙니다. 기존 이자는 납부 완료 증빙이 없어 paid_at=NULL로 유지합니다.

  1175(Safe Update) 또는 1060(중복 컬럼)으로 중단했다면 수정된 07 파일 전체를 대상 DB가 선택된 동일 연결에서 다시 실행합니다. 이미 존재하는 컬럼은 건너뛰고, 납부일이 NULL인 월세만 보완합니다. 보완 UPDATE 동안 해당 세션의 SQL_SAFE_UPDATES만 해제한 후 원래 값으로 복원합니다. UPDATE 중 다른 오류로 중단되면 마지막 복원문을 별도 실행하거나 연결을 종료합니다. Workbench 전역 설정 변경이나 기존 컬럼 삭제는 필요하지 않습니다. 컬럼 존재 확인은 타입까지 검증하지 않으므로 적용 후 SHOW COLUMNS로 due_date=DATE, paid_at=DATETIME인지 확인합니다.
- 20261118_08_contract_payment_effective_from.sql: 내 집 정보 저장일을 신규 계약 납부 내역의 반영 시작일로 기록합니다. 이미 지난 월세·관리비·이자를 조회/스케줄러가 새로 만드는 것을 막습니다. 기존 기록은 변경하지 않으며 컬럼이 있으면 건너뜁니다. 적용 후 백엔드를 재시작합니다. 검증은 RECURRING_PAYMENT_DAY_VERIFICATION.md 참고.
- 20261118_09_management_contract_kind.sql: bill_items.home_contract_kind를 추가하고 현재 내 집 정보와 연결된 관리비의 유형을 기록합니다. 월세·전세 전환 후 각 유형의 관리비만 조회합니다. 기존 컬럼은 건너뛰며 UPDATE 동안 해당 세션의 Safe Update만 해제·복원합니다. 기존에 하나의 관리비 항목으로 여러 계약 유형 기록을 섞어 저장한 경우 과거 각 행의 유형은 복원할 수 없습니다. 상세 검증은 MANAGEMENT_CONTRACT_FIX_VERIFICATION.md 참고.
- 20261119_01_bill_termination.sql: 일반 고정 지출의 사용자 지정 해지 적용일(termination_date)을 추가합니다. 컬럼이 있으면 건너뜁니다. 기존 납부 데이터는 변경하지 않습니다. 적용 후 서버 재시작.

- 20261121_02_salary_record_deletion.sql: 월급 내역 삭제 후 해당 달의 재생성을 방지합니다.
- 20261121_03_ledger_category_label_case.sql: 회원별 거래 분류명 수정 시 영문 대소문자를 정확하게 저장합니다.

## 2026-11-21 주거 설문·월급 삭제·분류 이름

기존 DB는 20261120_01까지 적용한 뒤 아래 순서로 각각 한 번 적용합니다. 신규 DB는 최신 schema.sql을 사용합니다.

1. 20261121_01_housing_onboarding.sql: 설문 상태와 대출·월급 초안 컬럼 추가. 기존 계약 회원은 COMPLETED, 로그인 이력이 있는 나머지 회원은 SKIPPED, 신규 회원은 PENDING으로 보완합니다. 상태 보완 블록은 동일 세션에서 실행하며 SQL_SAFE_UPDATES를 복원합니다.
2. 20261121_02_salary_record_deletion.sql: salary_records.income_id를 NULL 허용으로 변경해 월급 삭제 후 해당 월의 중복 자동 등록 방지 기록을 유지합니다.
3. 20261121_03_ledger_category_label_case.sql: ledger_categories.name에 utf8mb4_bin을 사용해 대소문자가 다른 이름을 구분합니다.

DDL은 암묵 커밋되므로 백업 후 적용하며 전체 파일을 무조건 재실행하지 않습니다. 정적·격리 MySQL 검사 절차는 ../tests/README.md의 마이그레이션 자동 검사 항목을 참고합니다.
- 20261121_04_login_lockout.sql: 비밀번호 로그인 실패와 잠금 시작 시각을 저장합니다. 기존 DB에 적용 후 백엔드를 재시작합니다.
이 표에 파일 한 줄도 추가해 주세요.

**데이터 마이그레이션**(`20261122_01` · `02` 처럼 표 구조는 안 바꾸고 행만 넣는 파일)은 2 · 3번 대신 [`../tests/migration-path.cjs`](../tests/migration-path.cjs) 의 `dataMigrations` 에만 넣어요. 구조 비교 · 19번 묶음에서는 빠지고, 정적 검사가 구조 변경(CREATE · ALTER · DROP 등, 임시 표 제외)이 없는지만 확인해요. `20261122_01` · `02` 는 `db/tools/trash_import.py` 가 만드는 파일이라 직접 고치지 말고 CSV 가 바뀌면 스크립트로 다시 만들어요.

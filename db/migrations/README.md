# DB 마이그레이션 — 쓰던 DB를 새 코드에 맞추기

- **새 DB**: [`../schema.sql`](../schema.sql)을 실행한 뒤, 데이터 마이그레이션 `20261122_01_regions` · `20261122_02` · `20261122_04`(전국 지역 · 쓰레기 배출표 · 주변 동네)만 실행해요. 나머지 파일은 필요 없어요.
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
| `20261031_02_event_anniversaries.sql` | 기념일 · 매년 반복 칸 추가 및 구형 칸 정리 ([아래 안내](#구형-기념일-컬럼-정리)) | ⭕ |
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
| `20261118_06_bill_photo_drafts.sql` | 고지서 사진 인식 임시 결과 표 (30분 후 만료, 사진 원본 · QR 원문은 저장 안 함) | ⭕ |
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
| `20261122_05_place_review_photos.sql` | 장소 리뷰 사진 표 `place_review_photos` (리뷰당 5장, 03 다음에 실행) | ⭕ |
| `20261122_06_terms_privacy_ai.sql` | 개인정보 처리방침 5번(국외 이전): AI 답변 Google Gemini(미국) 이전 내용 채움, 클라우드는 출시 전 확정 안내. 버전 · 동의 기록은 그대로 | ⭕ |
| `20261122_07_memo_folders.sql` | 계정별 메모 폴더와 메모 분류를 추가. 기존 메모는 유지되고 폴더 삭제 시 미분류로 이동 | ⭕ |
| `20261122_01_regions_nationwide.sql` | **데이터** — 전국 시도 16 · 시군구 233 (`regions`, 없는 것만 추가 · 지역 번호 그대로) | ⭕ |
| `20261122_02_trash_schedules_nationwide.sql` | **데이터** — 쓰레기 배출표 6,218줄 (`trash_schedules` 를 모두 지우고 다시 넣음, 01 다음에 실행). 마지막에 `파일 줄 수 6218 · 넣은 줄 수 6218 · 지역 없음 0` 이면 정상 | ⭕ |
| `20261122_04_region_neighbors_nationwide.sql` | **데이터** — 주변 동네 1,286줄 (`region_neighbors` 를 모두 지우고 다시 넣음, 01 다음에 실행). 육지 경계가 맞닿은 시 · 군 · 구끼리, OpenStreetMap 경계로 `db/tools/region_neighbors_import.py` 가 만듦. 마지막에 `파일 줄 수 1286 · 넣은 줄 수 1286 · 지역 없음 0` 이면 정상 | ⭕ |

## 꼭 알아야 할 주의

1. **20261031_current_project** — MySQL 8.0.16 이상에서, 앱 쓰기를 멈추고 실행해요. 옛 `todos` 를 `events` 로 옮겨요(새 번호 = 적용 직전 events 최대 번호 + 옛 todos 번호, 만든 날짜를 일정 날짜로). 옛 표는 `todos_legacy_20261031` 로 남겨 두니 행 수를 비교해 보세요. 옛 수입은 월급 · 이자 · 연금 · 임대 수입 · 기타 고정 수입을 FIXED, 나머지를 OTHER 로 나눠요. 옛 고정 지출은 공과금 태그로 남아요.
2. **20261101_housing_and_loan** — 금액 칸 타입을 넓혀서 표가 잠기거나 다시 만들어질 수 있어요. 복사한 DB 에서 먼저 해 보세요.
3. **20261102_requirements_hardening** — 중복 신고 · 잘못된 좌표/JSON/별점/요일을 자동으로 지우거나 고치지 않아요. 제약 추가가 실패하면 위반 행을 먼저 확인해요(사전 검사 SQL 은 [`../tests/21_latest_requirements_upgrade.sql`](../tests/21_latest_requirements_upgrade.sql)). 새 위치 · 신고 스냅샷 칸은 비어서 시작해요.
4. **20261115_02_email_verification** — 회원의 휴대전화 번호 칸과 휴대전화 인증 · 재가입 차단 표를 지워요(데이터도 사라짐). 파일 앞 사전 확인 SQL 두 개가 모두 0이어야 해요.
5. **20261118_07_contract_payment_changes** — 1175(Safe Update) · 1060(중복 칸)으로 멈췄으면 파일 전체를 같은 연결에서 다시 실행하면 돼요(있는 칸은 건너뜀). 옛 월세의 납부 기한은 지금 설정의 납부일로 채워요(실제 과거 날짜 복원 아님). 옛 이자는 납부 증빙이 없어 `paid_at` 을 비워(NULL) 둬요. 적용 후 `SHOW COLUMNS` 로 `due_date`=DATE, `paid_at`=DATETIME 인지 확인해요.
6. **20261121_01_housing_onboarding** — 파일 전체를 한 연결에서 실행해요(중간에 Safe Update 를 잠깐 끄고 원래대로 돌림). 계약이 있는 회원은 COMPLETED, 로그인한 적 있는 나머지는 SKIPPED, 새 회원은 PENDING 이 돼요.

## 구형 기념일 컬럼 정리

**기념일 마이그레이션은 `20261031_02_event_anniversaries.sql`을 사용하고, 폐기된 `20261101_event_anniversary.sql`은 실행하지 마세요.**

- `SHOW CREATE TABLE events`로 대상 DB의 컬럼을 확인하세요. 구형 컬럼(`is_anniv` · `is_yearly`)이 남아 있으면 정식 파일을 이미 실행한 DB에서도 다시 실행할 수 있어요. 백업하고 일정 쓰기를 중단한 뒤 대상 DB를 선택해 실행하세요.
- 구형 컬럼만 있으면 값을 유지하면서 `is_anniversary` · `repeat_yearly`로 이름을 바꿔요. 양쪽 컬럼이 있으면 모든 행의 값이 일치할 때 구형 컬럼을 제거해요. 값이 다르면 `conflicting_rows`가 표시되고 중단돼요. 백업과 일정 원본을 확인해 양쪽의 값이 일치하도록 조정한 뒤 다시 실행하세요.
- 완료 후 `SHOW CREATE TABLE events`에서 정식 컬럼 두 개와 `ck_events_anniversary_flags`를 확인하세요. 최신 `schema.sql`로 생성한 새 DB에는 이미 반영돼 있어요.

## 마이그레이션을 새로 만들 때

1. `db/schema.sql` 을 같은 모양으로 고치고, 이 폴더에 `날짜_번호_내용.sql` 을 추가해요. 가능하면 `information_schema` 로 이미 있는지 보고 건너뛰게 써요(다시 실행 ⭕).
2. [`../tests/migration-path.cjs`](../tests/migration-path.cjs) 목록과 [`../tests/19_migration_upgrade.sql`](../tests/19_migration_upgrade.sql) 끝에 같은 파일을 순서대로 넣고, 위 [파일 순서](#파일-순서) 표에도 한 줄 추가해요.
3. 저장소 최상위에서 비교 자료를 갱신하고 검사해요.

```powershell
node db/tests/generate-schema-audit.cjs                                   # schema_expected.json · 15/20번 감사 SQL 갱신
node --test --test-reporter=spec db/tests/schema-assets.test.cjs          # 빠진 파일 · 새 DB 와 업그레이드 DB 구조 비교
node db/tests/run-isolated-mysql.cjs                                      # 격리 MySQL 9.6 에서 전체 실행 검증
```

**데이터 마이그레이션**(`20261122_01` · `02` 처럼 표 구조는 안 바꾸고 행만 넣는 파일)은 2 · 3번 대신 [`../tests/migration-path.cjs`](../tests/migration-path.cjs) 의 `dataMigrations` 에만 넣어요. 구조 비교 · 19번 묶음에서는 빠지고, 정적 검사가 구조 변경(CREATE · ALTER · DROP 등, 임시 표 제외)이 없는지만 확인해요. `20261122_01` · `02` 는 `db/tools/trash_import.py`, `20261122_04` 는 `db/tools/region_neighbors_import.py` 가 만드는 파일이라 직접 고치지 말고 원본이 바뀌면 스크립트로 다시 만들어요.

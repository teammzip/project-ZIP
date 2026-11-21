# DB 마이그레이션 — 쓰던 DB를 새 코드에 맞추기

- **새 DB**: [`../schema.sql`](../schema.sql)만 실행하면 끝이에요. 아래 파일은 필요 없어요.
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
| `20261121_04_post_list_indexes.sql` | 홈 꿀팁 · 동네 글 목록 · 관리자 회원 목록 인덱스 4개 (부하 테스트에서 느린 곳) | ⭕ |

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

이 표에 파일 한 줄도 추가해 주세요.

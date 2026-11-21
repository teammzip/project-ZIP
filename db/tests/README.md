# DB 검사

DB 를 바꿨으면 **자동 검사**를 돌리면 돼요. 아래 수동 SQL 테스트는 Workbench 에서 하나씩 눈으로 확인하고 싶을 때 써요. 결과 기록은 [RESULTS.md](RESULTS.md)에 남겨요.

## 자동 검사 (저장소 최상위에서)

```powershell
node --test --test-reporter=spec db/tests/schema-assets.test.cjs   # 빠른 정적 검사: 마이그레이션 빠짐 · 새 DB 와 업그레이드 DB 구조 차이 · 비교 자료 동기화
node db/tests/generate-schema-audit.cjs                            # schema.sql 을 바꾼 뒤 비교 자료(schema_expected.json · 15/20번 감사 SQL) 갱신
node db/tests/run-isolated-mysql.cjs                               # 격리 MySQL 9.6 에서 아래 SQL 테스트 전부 + 새 설치 · 전체/증분 업그레이드 · 데이터 보존
```

격리 검사는 지금 켜진 MySQL 에 접속하지 않아요. `db/private` 에 임시 DB 를 만들어 TCP 없이(named pipe) 돌리고 끝나면 꺼요. 마이그레이션을 새로 만들 때 할 일은 [마이그레이션 안내](../migrations/README.md#마이그레이션을-새로-만들-때)에 있어요.

## 수동 SQL 테스트 순서

`zip_test` 같은 **테스트용 DB** 에서만 실행해요(실제 데이터가 있는 DB 금지). 정상 테스트(`*_positive`)는 전체 실행 후 마지막에 자동 ROLLBACK, 오류 테스트(`*_negative`)는 준비 블록 다음 한 문장씩 선택 실행해요.

| 파일 | 범위 | 결과 번호 | 안내 |
|---|---|---|---|
| 01 · 02 | 주거 설문 · 전세 대출 · 월별 이자 | P · N | 이 문서 아래 |
| 03 · 04 | 회원 · 인증 · 약관 | A · B | [AUTH_TERMS_GUIDE](AUTH_TERMS_GUIDE.md) |
| 05 · 06 | 일정 · 카테고리 · 메모 · 알림 | C · D | [LIFE_GUIDE](LIFE_GUIDE.md) |
| 07 · 08 | 가계부 · 지출 VIEW | E · F | [LEDGER_GUIDE](LEDGER_GUIDE.md) |
| 09 · 10 | 커뮤니티 · 첨부 | G · H | [COMMUNITY_GUIDE](COMMUNITY_GUIDE.md) |
| 11 · 12 | 신고 · 제재 · 고객센터 | I · J | [MODERATION_GUIDE](MODERATION_GUIDE.md) |
| 13 · 14 | 동네 · 지도 · AI | K · L | [MAP_AI_GUIDE](MAP_AI_GUIDE.md) |
| 15 · 16 | 전체 구조 대조 · 금액 타입 복구 | M · R | [SCHEMA_AUDIT_GUIDE](SCHEMA_AUDIT_GUIDE.md) |
| 17 | 보완 제약 | S | [SUPPLEMENTAL_GUIDE](SUPPLEMENTAL_GUIDE.md) |
| 18 · 19 · 20 | 옛 35개 표 DB → 최신으로 이전 (별도 `zip_migration_test`) | U · M | [MIGRATION_GUIDE](MIGRATION_GUIDE.md) |
| 21 · 22 · 23 | 20261102 요구사항 단계 (지난 단계) | Q · V · W | [LATEST_REQUIREMENTS_GUIDE](LATEST_REQUIREMENTS_GUIDE.md) |
| 24 · 25 | 개인 분류 · 집 주소 (20261107) | X · Y | 각 SQL 파일 맨 위 주석 |

## 01 · 02 주거 · 대출

모든 데이터는 가상이며 로그인 가능한 계정이나 실제 은행 거래를 만들지 않습니다. 검사하는 표는 users, housing_surveys, housing_loans, loan_interest_charges, user_settings, events 및 지출 VIEW입니다.

### 1. DB 준비

MySQL Workbench의 로컬 테스트 서버에 새 연결을 엽니다. 실제 데이터가 있는 서버에서는 실행하지 않습니다.

- 새 DB: ../schema.sql을 Workbench에서 열고 **실행용 사본**의 CREATE DATABASE와 USE에 있는 zip을 zip_test로 바꿔 전체 실행합니다. 프로젝트 원본은 변경하지 않습니다.
- 이전 테스트 DB: ../migrations/README.md에서 현재 버전에 필요한 변경만 적용합니다. 마이그레이션 사본의 USE도 zip_test로 바꿉니다. 최신 스키마를 다시 실행하는 것만으로 기존 컬럼은 변경되지 않습니다.
- 테스트 중 DDL(CREATE/ALTER/TRUNCATE), COMMIT, 새 START TRANSACTION을 실행하지 않습니다. 기존 작업 트랜잭션이 없는 연결에서 시작합니다.

다음 조회에서 신규 표 3개와 최신 기념일 컬럼을 확인합니다.

```sql
USE zip_test;
SHOW CREATE TABLE housing_surveys;
SHOW CREATE TABLE housing_loans;
SHOW CREATE TABLE loan_interest_charges;
SHOW COLUMNS FROM events;
SHOW COLUMNS FROM user_settings LIKE 'rent_amount';
```

rent_amount는 DECIMAL(14,4) UNSIGNED, 이벤트 컬럼은 is_anniversary/repeat_yearly여야 합니다. 다른 구조이면 실행을 멈추고 마이그레이션부터 확인합니다.

### 2. 정상 테스트

01_housing_loan_positive.sql을 연결된 SQL 편집기에서 열고 전체 실행합니다. P01~P10 결과가 모두 PASS인지 확인합니다. 파일 마지막에서 자동 ROLLBACK합니다. 중간 오류로 중단됐다면 같은 탭에서 ROLLBACK을 직접 실행하고 첫 오류를 기록합니다. 일부 PASS만 나온 경우 전체 통과가 아닙니다.

| ID | 검증 내용 |
|---|---|
| P01 | 가상 회원·설문·대출 연결 |
| P02 | 발생 날짜에서 월 키 202602 생성, 400,000원 저장 |
| P03 | 금리를 5%로 바꿔도 과거 4%·400,000원 유지 |
| P04 | 중지 후에도 2월 400,000원+3월 500,000원 집계 |
| P05 | 55.5555만원이 555,555원으로 정확히 변환 |
| P06 | 최대 원금 9,999,990,000원 및 금리 100% 저장 |
| P07 | 최대 월 이자 833,332,500원 및 0% 이자 저장 |
| P08 | 회원 삭제 시 설문·설정·대출·이자 CASCADE |
| P09 | SAVEPOINT로 삭제 전 데이터 복구 |
| P10 | 최종 ROLLBACK으로 테스트 데이터 제거 |

P04의 VIEW 결과는 2026-02 / 전세 대출 이자 / 400000, 2026-03 / 전세 대출 이자 / 500000 두 행입니다. 이후 경계값 테스트로 추가한 4·5월 자료는 P04 판정 이후 생성됩니다.

### 3. 오류 테스트

02_housing_loan_negative.sql은 **전체 실행하지 않습니다.** 같은 SQL 탭에서 다음 순서를 지킵니다.

1. N00 준비 블록을 한 번만 선택 실행합니다.
2. N01부터 N08까지 각 문장 하나씩 선택해 실행합니다.
3. 각 오류의 제약조건 이름을 주석과 비교합니다. 중복 오류는 보통 1062, CHECK는 3819, 외래키는 1452입니다. 다른 오류(테이블 없음, 문법 오류, NULL 변수 등)는 통과가 아닙니다.
4. 어느 문장이 성공했다면 해당 테스트는 FAIL입니다. 계속하기 전에 `ROLLBACK TO SAVEPOINT negative_fixture;`로 fixture 상태를 복원하세요. 연결을 잃었거나 SAVEPOINT 복원에 실패하면 ROLLBACK 후 새 연결에서 N00부터 다시 시작합니다.
5. 끝나면 N99를 실행하고 PASS를 확인합니다. 오류가 난 INSERT/UPDATE는 보통 해당 문장만 취소되므로 반드시 최종 ROLLBACK까지 수행합니다.

자동 증가 번호는 ROLLBACK 후에도 비어 있을 수 있으며 정상입니다. 공개 화면에는 개인 서버 주소·계정·비밀번호 대신 테스트 ID와 결과만 공유하세요.

### 4. 결과 기록

#### Error 1175: ID 비교의 문자셋 변환

housing_loans.id와 loan_interest_charges.loan_id는 ascii/ascii_bin입니다. 연결의 기본 문자셋으로 만들어진 UUID 변수와 비교하면 컬럼의 암묵 변환 때문에 기본키를 쓰지 못하고 안전 업데이트 모드가 차단할 수 있습니다. 수정한 테스트는 변수 생성 시 ascii_bin을 지정하고, WHERE의 변수 쪽에만 CONVERT(... USING ascii) COLLATE ascii_bin을 적용합니다. 안전 모드를 해제할 필요가 없습니다.

이전 파일 실행 중 1175가 발생했다면 같은 연결에서 먼저 ROLLBACK을 실행하고, 수정한 01 파일을 디스크에서 다시 열어 처음부터 실행합니다. 기존 편집기 탭은 자동으로 갱신되지 않을 수 있습니다. 실패한 UPDATE 이후 테스트는 아직 검증되지 않은 것으로 기록합니다. 연결 재접속으로 진행하던 트랜잭션/변수를 잃은 상태에서 중간 문장부터 실행하지 않습니다.

```text
실행 날짜 / MySQL 버전:
테스트 DB / 테이블·VIEW 수:
P01~P10: 각 PASS / FAIL / 미실행
N01~N08: 각 오류 번호 및 제약조건 이름
N99: PASS / FAIL
최초 예상 밖 오류:
```

독립 MySQL 실행과 사용자 실행 이력은 RESULTS.md에 있습니다. 새 환경의 결과는 별도로 확인합니다. 서버의 월말·한국 날짜 계산, 자동 동기화·중지 정책, 권한, 동시성, 마이그레이션은 이 수동 저장 테스트로 검증되지 않습니다. 특히 P07은 중지 후 직접 INSERT하는 경계값 검사로 서버가 자동 기록을 막는지 검사하는 것이 아닙니다.

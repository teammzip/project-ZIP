# 최신 주거·대출 DB 수동 검증

최신 독립 실행 결과는 [검증 JSON](VALIDATION_20261102.json)과 [검증 기록](RESULTS.md)을 참고하세요. 격리 MySQL 9.6.0에서 정상 검증 106개·예상 오류 94개 및 전체/증분 이전이 통과했습니다. 기존 사용자 DB 적용은 별도입니다.

**최신 변경 시작점:** [요구사항·예외 가이드](LATEST_REQUIREMENTS_GUIDE.md). 기존 zip_test에는 21번의 사전 조회/변경을 블록별 적용한 뒤 22번 정상 테스트, 23번 오류 테스트, 갱신된 15번 구조 감사를 실행합니다. 이전 PASS 기록은 변경 전 버전의 이력입니다.

보완 제약 다음은 [마이그레이션 가이드](MIGRATION_GUIDE.md)의 `18_legacy_schema.sql` → `19_migration_upgrade.sql` → `20_migration_schema_audit.sql` 순서입니다. 현재 zip_test가 아닌 별도 zip_migration_test에서 실행합니다.

전체 구조 확인 이후에는 [보완 제약 가이드](SUPPLEMENTAL_GUIDE.md)의 `17_supplemental_negative.sql`을 S00부터 블록별 실행합니다.

기능별 테스트 이후 [전체 구조 대조 가이드](SCHEMA_AUDIT_GUIDE.md)의 `15_schema_audit.sql`을 실행합니다. M01~M07 및 추가 객체/컬럼 목록을 확인합니다.

신고·제재 다음은 [동네·지도·AI 가이드](MAP_AI_GUIDE.md)의 `13_map_ai_positive.sql`과 `14_map_ai_negative.sql`이며 K/L 번호로 기록합니다.

커뮤니티 다음은 [신고·제재·고객센터 가이드](MODERATION_GUIDE.md)의 `11_moderation_positive.sql`과 `12_moderation_negative.sql`이며 I/J 번호로 기록합니다.

가계부 다음은 [커뮤니티·첨부 가이드](COMMUNITY_GUIDE.md)의 `09_community_positive.sql` 및 `10_community_negative.sql`이며 G/H 번호로 기록합니다.

진행 결과는 [수동 검증 기록](RESULTS.md)에 보관합니다. 생활 데이터 다음 단계는 [가계부 가이드](LEDGER_GUIDE.md)의 `07_ledger_positive.sql`과 `08_ledger_negative.sql`이며 E/F 번호로 기록합니다.

일정·카테고리·메모·알림은 [생활 데이터 가이드](LIFE_GUIDE.md)의 `05_life_positive.sql`과 `06_life_negative.sql`로 이어갑니다. C/D 번호로 결과를 기록합니다.

다음 단계인 회원·인증·약관 테스트는 [별도 가이드](AUTH_TERMS_GUIDE.md)를 따릅니다. `03_auth_terms_positive.sql` 전체 실행 후 `04_auth_terms_negative.sql`을 블록별 실행합니다. 이 페이지의 P/N 번호와 다음 단계의 A/B 번호를 구분해 결과를 기록하세요.

대상: 2026-11-01 스키마(44개 테이블·2개 VIEW). 모든 데이터는 가상이며 로그인 가능한 계정/실제 은행 거래를 만들지 않습니다. 여기서 검사하는 표는 users, housing_surveys, housing_loans, loan_interest_charges, user_settings, events 및 지출 VIEW입니다. 전체 44개 테이블 검증 완료를 의미하지 않습니다.

## 1. DB 준비

MySQL Workbench의 로컬 테스트 서버에 새 연결을 엽니다. 실제 데이터가 있는 서버에서는 실행하지 않습니다.

- 새 DB: ../schema.sql을 Workbench에서 열고 **실행용 사본**의 CREATE DATABASE와 USE에 있는 zip을 zip_test로 바꿔 전체 실행합니다. 프로젝트 원본은 변경하지 않습니다.
- 이전 테스트 DB: ../migrations/README.md에서 현재 버전에 필요한 변경만 적용합니다. 마이그레이션 사본의 USE도 zip_test로 바꿉니다. 최신 스키마를 다시 실행하는 것만으로 기존 컬럼은 변경되지 않습니다.
- 이전 할 일 보관 테이블이 있으면 테이블 수는 45개일 수 있습니다. 새 DB의 예상값은 44개입니다.
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

## 2. 정상 테스트

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

## 3. 오류 테스트

02_housing_loan_negative.sql은 **전체 실행하지 않습니다.** 같은 SQL 탭에서 다음 순서를 지킵니다.

1. N00 준비 블록을 한 번만 선택 실행합니다.
2. N01부터 N08까지 각 문장 하나씩 선택해 실행합니다.
3. 각 오류의 제약조건 이름을 주석과 비교합니다. 중복 오류는 보통 1062, CHECK는 3819, 외래키는 1452입니다. 다른 오류(테이블 없음, 문법 오류, NULL 변수 등)는 통과가 아닙니다.
4. 어느 문장이 성공했다면 해당 테스트는 FAIL입니다. 계속하기 전에 `ROLLBACK TO SAVEPOINT negative_fixture;`로 fixture 상태를 복원하세요. 연결을 잃었거나 SAVEPOINT 복원에 실패하면 ROLLBACK 후 새 연결에서 N00부터 다시 시작합니다.
5. 끝나면 N99를 실행하고 PASS를 확인합니다. 오류가 난 INSERT/UPDATE는 보통 해당 문장만 취소되므로 반드시 최종 ROLLBACK까지 수행합니다.

자동 증가 번호는 ROLLBACK 후에도 비어 있을 수 있으며 정상입니다. 공개 화면에는 개인 서버 주소·계정·비밀번호 대신 테스트 ID와 결과만 공유하세요.

## 4. 결과 기록

### Error 1175: ID 비교의 문자셋 변환

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

SQL은 현재 스키마와 정적으로 대조했으며 실제 MySQL 실행 결과는 사용자가 확인한 후 기록합니다. 서버의 월말·한국 날짜 계산, 자동 동기화·중지 정책, 권한, 동시성, 마이그레이션은 이 수동 저장 테스트로 검증되지 않습니다. 특히 P07은 중지 후 직접 INSERT하는 경계값 검사로 서버가 자동 기록을 막는지 검사하는 것이 아닙니다.

# 가계부·월별 집계 검증

## 준비

대상: ledger_categories, incomes, expenses, bill_items, bill_payments, rent_payments와 월별 VIEW 2개. users 및 대출·이자 표도 통합 집계용 가상 데이터로 사용합니다. zip_test의 새 연결에서 시작하고 이전 트랜잭션이 없어야 합니다. 파일은 자체 fixture를 생성하므로 앞선 테스트 변수는 필요하지 않습니다. 실제 개인정보·계좌 거래를 사용하지 않습니다.

```sql
USE zip_test;
SHOW COLUMNS FROM incomes;
SHOW COLUMNS FROM expenses;
SHOW COLUMNS FROM bill_items;
SHOW CREATE VIEW v_monthly_spend_breakdown;
```

금액은 BIGINT UNSIGNED이고 VIEW에는 loan_interest_charges의 이자 집계가 포함돼야 합니다. 다르면 최신 마이그레이션부터 확인합니다. 테스트 중 COMMIT·DDL·다른 START TRANSACTION은 실행하지 않습니다.

## 정상 테스트

### E11에서 1264: amount 범위 초과

50억 원은 INT UNSIGNED의 최댓값 4,294,967,295를 넘습니다. 최신 설계는 BIGINT UNSIGNED이므로 실제 컬럼이 INT라면 이전 타입이 남은 상태입니다. 같은 연결에서 먼저 `ROLLBACK;`을 실행한 뒤 `SELECT DATABASE();`와 `SHOW COLUMNS FROM incomes LIKE 'amount';`로 확인합니다. 테스트 트랜잭션이 열린 상태에서 ALTER를 실행하면 암묵 커밋되므로 순서를 지킵니다.

zip_test의 incomes.amount가 기존 INT UNSIGNED인 경우에만 다음 수정으로 최신 정의에 맞춥니다.

```sql
USE zip_test;
ALTER TABLE incomes MODIFY COLUMN amount BIGINT UNSIGNED NOT NULL COMMENT '수입 금액 — 원 단위';
```

그다음 bill_items.default_amount, bill_payments.amount, rent_payments.amount, expenses.amount가 BIGINT UNSIGNED인지, user_settings.rent_amount가 DECIMAL(14,4) UNSIGNED인지도 확인합니다. 나머지도 구버전이면 migrations/20261101_housing_and_loan.sql의 해당 MODIFY 문장만 실제 구조와 비교해 적용합니다. 테이블이 이미 만들어진 DB에 전체 마이그레이션을 무조건 다시 실행하지 않습니다. 최신 schema.sql의 CREATE TABLE IF NOT EXISTS 역시 기존 타입을 갱신하지 않습니다.

수정 후 07 파일을 처음부터 다시 실행합니다. 실패 이후 항목은 결과 확인 전까지 미검증으로 기록합니다. 실제 타입이 이미 BIGINT라면 다른 서버/DB 접속 여부, SHOW CREATE TABLE incomes, 트리거 유무를 추가 확인하고 임의로 변경하지 않습니다.

07_ledger_positive.sql 전체 실행 후 E01~E14 모두 PASS인지 확인합니다. 마지막에 자동 ROLLBACK합니다. 오류로 멈추면 같은 연결에서 ROLLBACK하고 첫 오류를 기록합니다.

| ID | 검증 내용·예상값 |
|---|---|
| E01 | 11월 수입 3,300,000원, 12월 2,000,000원, 다른 회원 9,999원 |
| E02 | 11월 고정 수입 3,000,000원·기타 300,000원 |
| E03 | 공과금·월세 최초 미납 |
| E04 | 고정 지출 전체 60,000원·공과금 태그만 40,000원 |
| E05 | 11월 월세 550,000 + 고정 지출 60,000 + 일반 지출 20,000 + 이자 400,000 = 1,030,000원 |
| E06 | 12월 지출 7,000원·다른 회원 지출 3,333원으로 분리 |
| E07 | 납부 체크 전후 합계 유지, 납부 시각 저장 |
| E08 | 항목 기본 금액 변경·비활성화 후 월별 과거 기록 유지 |
| E09 | 일반 지출 12,000→15,000원 수정 후 합계 1,033,000원 |
| E10 | 수정한 15,000원 행 삭제 후 합계 1,018,000원 |
| E11 | 50억 원 수입 저장 후 11월 합계 5,000,300,000원 |
| E12 | 전기 항목 실제 삭제 시 납부 기록 삭제, 합계 990,000원 |
| E13 | 회원 삭제 시 데이터·VIEW 제거, 공통 분류·다른 회원 보존 |
| E14 | 전체 테스트 데이터 ROLLBACK |

E09~E12는 SAVEPOINT를 사용해 각 검사 후 기준 데이터로 돌아갑니다. E11은 DB 타입 경계 검사이며 실제 화면별 입력 상한 통과를 의미하지 않습니다. E12는 실제 삭제의 손실을 보여주는 검사이므로 과거 내역 보존은 is_active=0 방식이 필요합니다.

현재 VIEW는 납부 여부와 무관하게 월별 금액을 포함하며 고정 지출의 모든 태그를 '공과금'으로 묶습니다. 이 동작을 E04/E07에서 명시적으로 확인합니다. 실제 현금 유출 통계와 구분해야 합니다. VIEW는 사용자별 자동 권한 제한을 제공하지 않으므로 API의 user_id 필터가 필수입니다.

## 오류 테스트

08_ledger_negative.sql은 전체 실행하지 않습니다.

1. F00 준비 블록을 한 번 실행하고 출력된 member_id, income_category_id, expense_category_id, bill_id가 모두 숫자인지 확인합니다.
2. F01~F09를 문장 하나씩 실행하고 다음 표의 오류 번호와 키·컬럼 이름을 확인합니다.
3. 예상 밖 성공이면 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT ledger_negative_fixture;`로 준비 상태를 복구합니다. 다른 종류의 오류는 미확인입니다.
4. F99 정리 블록 실행 후 PASS인지 확인합니다. 연결을 바꾸지 않습니다.

| ID | 예상 오류 | 키·컬럼 |
|---|---|---|
| F01 | 1062 | uk_ledger_categories_kind_name |
| F02 | 1452 | fk_incomes_category_id |
| F03 | 1452 | fk_expenses_category_id |
| F04 | 1062 | uk_bill_payments_bill_item_id_period_ym |
| F05 | 1062 | uk_rent_payments_user_id_period_ym |
| F06 | 1451 | fk_incomes_category_id |
| F07 | 1451 | fk_expenses_category_id |
| F08 | 1452 | fk_bill_payments_bill_item_id |
| F09 | 1048 | amount cannot be null |

F09의 amount NULL은 의도한 실패이고, user_id NULL은 준비 실패입니다. 1175는 제약조건 검증 통과가 아니며 해당 쿼리를 확인해야 합니다.

## 결과와 후속 범위

```text
MySQL 버전:
E01~E14: 각 PASS / FAIL / 미실행
F01~F09: 각 오류 번호 + 키·컬럼
F99: PASS / FAIL
최초 예상 밖 오류:
```

이 파일은 스키마·산술 기대값에 대한 정적 검사를 거쳤으며 MySQL에서 실행한 결과는 아직 확인하지 않았습니다. 날짜/연월 형식, 금액 상한·정수 여부, 수입에 수입 분류만 연결하는 kind 검사, 고정 지출과 expenses의 이중 입력 방지, 납부 API 권한·동시성은 별도 서버 검증입니다. 현재 DB FK는 분류 존재 여부만 검사합니다. 결과 확인 후 커뮤니티·첨부파일 검증으로 진행합니다.

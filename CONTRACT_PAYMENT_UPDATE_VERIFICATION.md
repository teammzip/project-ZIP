# 계약 기간 차단 및 수정일 이후 미납·예정 갱신

선택한 기준: 수정한 날부터, 미납·예정 기록만 변경한다. 기준 날짜는 저장된 청구 시간대의 오늘이다.

## 변경 동작
- 등록된 계약이 있으면 대상 월과 납부 기한 월이 계약 시작~종료 월 밖인 고정 지출 등록·수정을 서버에서 거부한다. AI 고지서 동의 후 등록에도 동일하게 적용한다.
- 계약 기간 밖의 화면에서는 직접 등록·수정을 제공하지 않는다. 내 집 정보의 계약 설정 자체(미래 계약 포함)는 저장할 수 있다. 계약 미등록 계정의 독립 고지서 등록은 유지한다.
- 내 집 정보에서 월세 금액·납부일, 관리비, 대출 원금·금리·납부일을 수정하면 계약 기간 안에 이미 저장된 기록 중 기존 납부 기한이 오늘 이후이고 미납인 기록을 갱신한다.
- 월세·관리비·이자의 납부 완료 기록과 납부 기한이 지난 기록은 자동 변경하지 않는다. 기존에 잘못 저장된 기간 밖 기록을 자동 삭제하지 않는다.
- 일반 고정 지출은 수정한 항목과 같은 ID의 오늘 이후 미납·예정 기록에 금액과 월별 납부일을 반영한다. 같은 분류의 다른 항목은 변경하지 않는다. 메모는 선택한 기록에만 반영한다.
- 변경 납부일이 오늘 이전으로 넘어가는 대상이 있으면 400으로 저장 전체를 취소한다. 월에 해당 일이 없으면 말일로 조정한다.
- 관리비 납부일은 월세 계약에서 월세 납부일, 전세 계약에서 대출 납부일(대출이 없으면 15일)을 사용한다.
- 내 집 정보 저장 후 가계부·홈에서 사용하는 월별 조회 캐시를 갱신한다.

예시: 2026-11-18에 월세 55만원/25일을 60만원/28일로 수정하면 11월 25일·12월 25일의 미납 기록은 60만원/28일로 바뀐다. 이미 납부한 12월 기록과 11월 10일처럼 기한이 지난 기록은 그대로 둔다.

## 1. 테스트 (직접 실행)
backend에서:
```powershell
.\gradlew.bat test --tests com.zip.backend.ContractPaymentChangesTests --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.BillMonthlyWriteTests
```
frontend에서:
```powershell
node --test tests/monthly-bills-view.test.mjs tests/life-info.test.mjs tests/housing-contract.test.mjs
npm run build
npm run lint
```
이번 작업에서 실행하지 않았다. 회귀 테스트 코드는 기간 밖 저장 거부, 같은 항목만 변경, 월말 보정, 납부 완료·과거 기한 보존, 월세·관리비·이자 변경을 포함한다.

## 2. DB 적용과 실제 검증
실제 연결 DB에서 아래 컬럼을 확인하고, 없는 컬럼에 대해 `db/migrations/20261118_07_contract_payment_changes.sql`을 적용한다. 이미 추가한 컬럼의 ALTER는 반복 실행하지 않는다. 기존 마이그레이션도 적용되어 있어야 한다.
```sql
SELECT DATABASE();
SHOW COLUMNS FROM rent_payments LIKE 'due_date';
SHOW COLUMNS FROM loan_interest_charges LIKE 'paid_at';
```
과거 월세에는 납부일이 저장되지 않았으므로 07의 보완 SQL은 현재 설정된 납부일을 사용한다. 과거의 정확한 납부 기한을 복원하는 것은 아니다. 기존 이자 기록은 실제 납부 증빙이 없으므로 paid_at=NULL이다. 실제 납부 완료로 확인된 이자는 paid_at이 기록되어야 변경에서 제외된다.

자동 MySQL 회귀 검증을 사용하려면 backend에서 실행한다. 임시 검증 데이터는 롤백하지만 마이그레이션은 적용된 상태로 남는다. 이 스크립트는 고지서 확인용 06 테이블을 적용하지 않는다.
```powershell
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql -PapplyMonthlyMigration
```

아래 123을 테스트 사용자 ID로 바꾸고 내 집 정보 수정 전후를 비교한다.
```sql
SELECT period_ym,amount,due_date,paid_at
FROM rent_payments WHERE user_id=123 ORDER BY period_ym;

SELECT p.bill_item_id,p.period_ym,p.amount,p.due_date,p.paid_at,p.deleted_at
FROM bill_payments p JOIN bill_items b ON b.id=p.bill_item_id
WHERE b.user_id=123 ORDER BY p.bill_item_id,p.period_ym;

SELECT c.loan_id,c.charge_date,c.principal,c.annual_rate,c.amount,c.paid_at
FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id
WHERE l.user_id=123 ORDER BY c.loan_id,c.charge_date;
```
미납·납부 완료·기한 경과·미래 월의 테스트 데이터는 위 자동 테스트가 생성해 검증한다. 실제 DB의 기존 기록을 임의로 납부 완료 처리하거나 삭제할 필요는 없다. 내 계정에 미래 기록이 없으면 자동 테스트로 이 조건을 확인하고 실제 DB에서는 현재 대상만 비교한다.

## 3. 프론트
1. 07 적용 후 백엔드를 다시 실행한다.
2. 계약 기간 밖인 월을 선택하면 안내가 있고 직접 등록·수정이 없는지 확인한다. API 직접 요청도 400인지 확인한다.
3. 계약 기간 안에서 내 집 정보의 월세·납부일을 바꾼다. 오늘 이후 미납 기록의 금액·납부 기한만 바뀌고, 납부 완료 기록은 유지되는지 확인한다.
4. 관리비·전세 대출 조건도 같은 기준으로 확인한다. 원금×금리÷1200을 원 단위 반올림한 이자와 비교한다.
5. 일반 고정 지출의 금액·납부 기한 변경 시 같은 ID의 미래 미납 기록만 바뀌는지 확인한다.
6. 가계부와 홈의 지출 합계를 비교한다. 홈의 기타 지출은 아직 로컬 기록이다.

## 검증 후 Git
기존 backend 브랜치에서 `git status --short`, `git diff`로 변경 범위를 검토하고 관련 파일만 stage한다. 확인 후 커밋하고 `git push origin backend`를 실행한다. 자동 테스트·DB·프론트 검증 전에는 검증 완료로 기록하지 않는다.

커밋 메시지: `feat: 계약 기간 저장 제한 및 수정일 이후 미납 고정 지출 갱신`

backend → dev 병합 설명:
- 계약 기간 밖 고정 지출 등록·수정 및 AI 등록을 서버에서 차단
- 내 집 정보 변경 시 오늘 이후 미납·예정 월세·관리비·이자 갱신
- 일반 고정 지출 변경을 같은 항목의 미래 미납 기록에 반영
- 납부 완료·기한 경과·삭제 기록 보존 및 잘못된 납부일 변경 시 트랜잭션 롤백
- 월세 due_date 및 이자 paid_at 컬럼 추가: 배포 전 07 마이그레이션 필요
- 내 집 정보 저장 후 가계부·홈 조회 갱신
- 검증 결과: 사용자가 실행한 테스트·DB·화면 확인 결과 기재

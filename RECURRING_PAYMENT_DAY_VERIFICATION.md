# 매월 납부일 저장·가계부 반영 검증

후속 보완: 최신 월세 예정 금액 동기화와 계약별 관리비 분리는 MANAGEMENT_CONTRACT_FIX_VERIFICATION.md를 따릅니다. 09 마이그레이션이 추가되었습니다. 새 납부일이 과거여도 기존 오늘 이후 미납 건의 금액은 갱신하고 기존 기한을 유지하는 기준이 아래의 기존 변경 전후 기한 검사 설명을 대체합니다.

과거 기록에 금액·일자를 소급 반영해 달라는 추가 요청은 취소되어 반영하지 않았습니다. 이 문서는 기존 가이드의 과거 납부일 변경 시 400으로 저장을 막는 설명을 대체합니다.

## 동작

- 내 집 정보의 매월 납부일은 1~31일이면 저장합니다. 오늘이 11월 18일이어도 매월 15일로 저장할 수 있습니다. 입주 월·종료 월에 따른 계약 기간 검증은 유지합니다.
- 서버가 지역 기준 저장일을 home_contracts.payment_effective_from에 기록합니다. 이후 조회·스케줄러·이자 정산은 적용일 이전의 새 계약 비용을 소급 생성하지 않습니다. 날짜는 당일을 포함합니다.
- 새 계약 비용은 납부일이 적용일 이상인 건부터 생성합니다. 11월 18일에 매월 15일로 처음 저장하면 11월 15일 건은 만들지 않고, 12월 조회/자동 등록 시 12월 15일 건을 생성합니다. 관리비·전세 대출 이자도 같은 기준입니다.
- 기존 미납·예정 기록은 기존 납부 기한과 변경 후 기한이 모두 오늘 이후일 때 변경합니다. 이번 달 25일 기록을 15일로 옮겨야 한다면 이번 달 기록은 유지하고, 다음 달 이후 기록에 새 조건을 반영합니다.
- 과거 및 납부 완료 기록은 유지합니다. 전세/월세에 따른 조회 필터도 유지합니다.
- 이 변경은 내 집 정보의 반복 납부 조건에 적용합니다. 고지서 직접 등록의 일회성 납부 기한 검사와는 별도입니다.
- 기존 DB에 적용일이 NULL이면 기존 동작을 유지하며, 내 집 정보를 다시 저장한 시점부터 적용일 기준이 사용됩니다.

## 1. 테스트 (사용자 실행)

```powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.ContractPaymentChangesTests --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillHousingMonthlyTests
cd ..\frontend
node --test tests/life-info.test.mjs tests/housing-contract.test.mjs tests/monthly-bills-view.test.mjs
npm run build
```

고정 Clock 기반 테스트는 2026-11-18 기준으로 과거 날짜 저장 허용, 기존 기록 보존, 다음 달 갱신, 자동 등록·조회에서 지난 납부 건 제외, 당일 납부 포함을 확인합니다. 아직 실행하지 않았습니다.

## 2. DB

07까지 적용한 실제 연결 DB에 `db/migrations/20261118_08_contract_payment_effective_from.sql` 전체를 실행합니다. 컬럼 존재 시 건너뛰므로 재실행할 수 있습니다. 실행 후 백엔드를 재시작합니다. 이 마이그레이션은 구현 과정에서 실행하지 않았습니다.

```sql
SELECT DATABASE();
SHOW COLUMNS FROM home_contracts LIKE 'payment_effective_from';
SET @verify_user_id = 1; -- 실제 로그인 회원 ID
SELECT c.contract_kind,c.payment_effective_from,c.billing_time_zone,s.rent_day
FROM home_contracts c JOIN user_settings s ON s.user_id=c.user_id
WHERE c.user_id=@verify_user_id;
SELECT period_ym,amount,due_date,paid_at FROM rent_payments
WHERE user_id=@verify_user_id ORDER BY period_ym;
SELECT p.period_ym,p.amount,p.due_date,p.paid_at
FROM bill_payments p JOIN home_contracts c ON c.management_bill_id=p.bill_item_id
WHERE c.user_id=@verify_user_id ORDER BY p.period_ym;
SELECT c.charge_date,c.amount,c.paid_at FROM loan_interest_charges c
JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=@verify_user_id ORDER BY c.charge_date;
```

기존 내역을 수정 전후 비교합니다. 이미 저장된 기록이 화면에 남는 것과 새로 소급 생성되는 것을 구분하세요. 전자는 보존 동작입니다.

## 3. 프론트

VITE_USE_MOCK=false인 서버 연결 화면에서, 계약 기간에 현재 월을 포함하고 매월 납부일을 오늘 이전으로 입력합니다. 저장 성공 및 계약 유형 변경 성공을 확인합니다. 새로운 과거 납부 건이 생성되지 않고, 기존 과거·납부 완료 기록은 변경되지 않아야 합니다. 오늘 이후의 날로 저장하면 해당 월의 새 납부 건은 생성되어야 합니다. 새달 전환은 고정 Clock 테스트로 검증하고 PC/DB 시간을 변경하지 않습니다.

## 4. Git (검증 통과 후)

기존 backend 브랜치에서 관련 변경을 확인하고 stage·commit·push합니다. 자동 커밋이나 push는 하지 않았습니다.

커밋 메시지:
`fix: 반복 납부일 저장 허용 및 저장일 이후 가계부 반영`

backend → dev 병합 설명:

```text
내 집 정보의 반복 납부일이 오늘 이전이어도 계약 조건을 저장할 수 있도록 수정했습니다.
저장일을 가계부 적용 시작일로 기록하여 지난 납부 건의 소급 자동 생성을 차단했습니다.
기존 기록은 변경 전후 기한이 모두 오늘 이후인 미납·예정 건만 갱신하고 과거·납부 완료 기록은 보존했습니다.
월세·관리비·전세 대출 이자의 자동 등록, 조회 예정 금액, 이자 정산에 적용 시작일을 반영했습니다.
DB 마이그레이션 08과 회귀 테스트를 추가했습니다.
검증 결과: 직접 실행한 테스트·DB·화면 결과를 기재합니다.
```

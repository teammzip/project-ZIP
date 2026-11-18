# 계약별 고정 지출 서버 연결

구현 반영 상태이며 테스트·빌드·실제 DB 검증은 실행하지 않았습니다.

## 구현 범위

GET /api/bills/monthly 응답에 contractKind, managementIncluded, housingItems를 추가했습니다. 기존 items는 공통 고지서이며 호환성을 유지합니다. 화면은 두 목록을 합쳐 합계·납부 완료·미납 예정·차트를 계산합니다.

- 월세: DB home_contracts의 monthly일 때 user_settings 월세(만원→원)를 현재 월 예정액으로 표시합니다. 관리비 포함이면 계약에 연결된 관리비의 미등록 예정액은 중복 표시하지 않습니다. 이미 저장된 월 기록은 임의로 숨기지 않습니다.
- 전세: 월세 예정액을 만들지 않습니다. 활성 housing_loans가 있으면 원금×연이율÷1200을 원 단위 반올림하여 현재 월 예상 이자를 표시합니다. 저장된 loan_interest_charges가 있으면 당시 금액을 우선합니다.
- 월세·이자의 저장된 과거 기록은 현재 계약을 바꿔도 유지합니다. 과거 월에 현재 계약 조건으로 예정액을 만들어 넣지 않습니다.
- 계약 기간 밖에는 새 예정액을 표시하지 않습니다. 현재 월 납부일 31일은 해당 월 말일로 보정합니다.
- 대출 이자 자동 계산 기록은 실제 납부 증빙이 아니므로 납부 완료로 표시하지 않습니다. 이자의 실제 납부 확인 API/UI는 후속 작업입니다.
- 월세·이자는 일반 bill_items ID와 구별된 ID를 사용하며 일반 고지서 수정/삭제로 보내지 않습니다. 내 집 정보(/my/settings)로 안내합니다.
- 조회는 새 월세나 이자 기록을 DB에 쓰지 않습니다.

기존 로컬 화면은 개발용 브라우저 저장 모델이고, 서버 화면은 DB bill_items/bill_payments 연동을 먼저 구축한 별도 컴포넌트였습니다. 그 과정에서 로컬의 계약별 분기가 누락되어 차이가 발생했습니다. 이번에 서버 계약 기준 조회를 연결했습니다. VITE_USE_MOCK=true의 로컬 모드는 계속 남아 있으며 서버 검증은 false로 진행합니다.

## 1. 테스트

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillMonthlyDeleteTests --tests com.zip.backend.HomeInfoTests
~~~

정상 기준: BUILD SUCCESSFUL. 새 BillHousingMonthlyTests는 월세 원 단위·말일·읽기 중 저장 없음·타인 데이터 격리·전세 대출 유무·스냅샷 보존·관리비 포함·과거 기록 보존을 검사합니다. 실패 시 다음 단계로 진행하지 마세요.

## 2. 실제 DB 연결

이번 작업에는 새 마이그레이션이 없습니다. 이전 home_contracts, housing_loans, loan_interest_charges, rent_payments와 고지서 01~04 마이그레이션이 적용되어 있어야 합니다. application-local.properties 또는 DB 환경변수가 가리키는 대상 DB를 먼저 확인하세요.

~~~powershell
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql
~~~

정상 기준: MySQL PASS에 monthly/jeonse housing 문구 출력 및 fixture data rolled back. 임시 사용자로 월세 55만원→550000원, 전세 대출 없음→월세 없음, 대출 예상 이자 300000원, 저장된 스냅샷 200000원 우선 적용을 확인하고 모두 롤백합니다. 기존 DB 구조가 누락되었다면 먼저 기존 검증 문서에 따라 마이그레이션을 적용하세요.

수동 확인 SQL의 123은 본인 사용자 ID로 바꾸세요.

~~~sql
SELECT c.contract_kind,c.management_included,c.management_fee,c.management_bill_id,
       s.rent_amount,s.rent_day,s.move_in_ym,s.contract_end_ym
FROM home_contracts c LEFT JOIN user_settings s ON s.user_id=c.user_id
WHERE c.user_id=123;
SELECT * FROM rent_payments WHERE user_id=123 ORDER BY period_ym;
SELECT * FROM housing_loans WHERE user_id=123;
SELECT c.* FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id
WHERE l.user_id=123 ORDER BY c.charge_date;
~~~

## 3. 프론트

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\frontend
node --test tests/*.test.mjs
npm run build
npm run lint
~~~

백엔드와 프론트를 재시작하고 VITE_USE_MOCK=false로 확인하세요.

1. 내 집 정보에서 월세 550000원·관리비 별도 50000원을 저장합니다. 고정 지출에서 월세 계약 안내와 월세·관리비 합산을 확인합니다.
2. 관리비 포함으로 변경하고 다시 조회합니다. 관리비 미등록 예정액이 중복되지 않는지 확인합니다. 이미 저장된 청구는 보존되므로 실제로 불필요한 기록은 선택 월 삭제로 정리합니다.
3. 전세·대출 없음으로 저장합니다. 월세 예정액과 이자 예정액이 없어야 합니다. 해당 월에 이미 저장한 월세 기록은 보존됩니다.
4. 전세 대출 1억원·연 3.6%를 저장합니다. 스냅샷이 없는 현재 월 이자는 300000원이며 실제 납부 확인 전으로 표시됩니다.
5. 과거 월 선택 시 현재 계약 금액을 소급 생성하지 않고 저장된 기록만 보여야 합니다.
6. Network의 GET /api/bills/monthly 응답에서 contractKind, housingItems, items와 화면 목록·합계를 대조합니다.
7. 월세·이자에는 일반 고지서 수정/삭제가 없고 내 집 정보 링크가 표시되는지 확인합니다.

주의: 홈 전체 생활 요약의 서버 통합과 월세·이자 납부 완료/취소는 별도 후속 범위입니다. 현재 계약 테이블에는 계약 변경 이력이 없어 과거 계약 유형·납부일·관리비 포함 여부를 정확히 재구성하지 않습니다. 과거 조회에서는 저장된 금액을 보존하고 납부일을 추정하지 않습니다.

## 검증 후 Git

~~~powershell
cd C:\project-ZIP-dev\project-ZIP
git add backend/src/main/java/com/zip/backend/bills/BillRepository.java backend/src/main/java/com/zip/backend/bills/BillService.java backend/src/test/java/com/zip/backend/BillHousingMonthlyTests.java backend/src/test/java/com/zip/backend/BillMonthlyTests.java backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java backend/src/test/java/com/zip/backend/BillMonthlyDeleteTests.java backend/src/test/resources/home-info-fixture.sql backend/scripts/MonthlyBillsMysqlVerify.java frontend/src/features/life/billsApi.ts frontend/src/features/life/components/MonthlyFixedExpense.tsx frontend/tests/monthly-bills-view.test.mjs CONTRACT_FIXED_EXPENSE_VERIFICATION.md frontend/API.md backend/README.md
git diff --cached
git commit -m "feat: 계약 형태별 고정 지출 서버 조회 및 합계 연결"
git push origin backend
~~~

backend → dev PR 설명:

DB에 저장된 월세·전세 계약에 따라 고정 지출의 월세 또는 전세 대출 이자를 조회하도록 연결했습니다. 서버의 계약 항목과 공통 고지서를 목록·차트·합계에 함께 반영하고, 관리비 포함에 따른 예정액 중복을 방지했습니다. 과거 저장 금액을 보존하고 이자 계산 기록과 실제 납부 완료를 구분합니다. 계약별 자동 테스트와 실제 MySQL 검증 시나리오를 추가했습니다. 검증 결과: [직접 수행한 결과 기재].

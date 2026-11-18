# 월세 전환 갱신·계약별 관리비 검증

## 변경사항

- 내 집 정보를 월세로 저장하면 계약 기간 안의 오늘 이후 미납 월세 기록을 현재 금액·납부일에 맞춥니다. 기본 설정 값이 이전 저장과 같아도 오래된 스냅샷을 다시 맞춥니다.
- 새 납부일이 이번 달에 이미 지났다면 해당 건의 기존 기한은 유지하고 금액만 갱신합니다. 다음 달 이후에는 새 납부일을 반영합니다. 기존 과거·납부 완료 기록은 변경하지 않습니다.
- 관리비는 bill_items.home_contract_kind에 monthly/jeonse를 저장합니다. 계약 유형 전환 시 이전 관리비는 비활성화하고 새 관리비 항목을 만들어 서로의 금액·기록을 덮어쓰지 않습니다.
- 전환 시 이전 유형의 오늘 이후 미납 관리비는 취소 표시(deleted_at)하여 원래 유형으로 다시 전환해도 중복 합산하지 않습니다. 행 자체와 과거·납부 완료 기록은 보존합니다.
- 전세 관리비는 전세일 때만, 월세 관리비는 월세일 때만 가계부·홈 합계에 표시됩니다. 유형이 NULL인 일반 공과금은 공통으로 유지합니다. 이전 계약 관리비도 가계부 직접 편집을 차단합니다.
- 관리비가 월세에 포함되면 새 별도 관리비는 등록하지 않습니다. 과거에 이미 저장한 같은 유형의 관리비는 보존·표시합니다.

## 1. 테스트 (사용자 실행)

```powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.ContractPaymentChangesTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillIntegrationTests
cd ..\frontend
node --test tests/life-info.test.mjs tests/housing-contract.test.mjs tests/monthly-bills-view.test.mjs
npm run build
```

추가 테스트는 월세 전환 시 기존 금액 갱신·기존 기한 보존, 같은 설정 재저장 시 오래된 월세 기록 복구, 계약별 관리비 분리·조회 제외·DB 보존을 확인합니다. 구현 과정에서 실행하지 않았습니다.

## 2. DB

08까지 적용한 실제 연결 DB에 `db/migrations/20261118_09_management_contract_kind.sql` 전체를 실행하고 백엔드를 재시작합니다. 적용 및 데이터 검증은 자동 수행하지 않았습니다.

```sql
SELECT DATABASE();
SHOW COLUMNS FROM bill_items LIKE 'home_contract_kind';
SET @verify_user_id=1; -- 실제 로그인 회원 ID
SELECT contract_kind,management_bill_id,payment_effective_from FROM home_contracts WHERE user_id=@verify_user_id;
SELECT id,name,home_contract_kind,default_amount,is_active FROM bill_items WHERE user_id=@verify_user_id ORDER BY id;
SELECT b.id,b.home_contract_kind,p.period_ym,p.amount,p.due_date,p.paid_at
FROM bill_items b JOIN bill_payments p ON p.bill_item_id=b.id
WHERE b.user_id=@verify_user_id ORDER BY b.id,p.period_ym;
SELECT period_ym,amount,due_date,paid_at FROM rent_payments WHERE user_id=@verify_user_id ORDER BY period_ym;
```

09는 현재 연결된 관리비 항목에 현재 계약 유형만 기록합니다. 예전 코드가 동일 항목에 전세·월세 기록을 섞어 저장했다면 각 과거 행의 계약 유형을 확정할 자료가 없어 자동 복원하지 못합니다. 연결되지 않은 과거 일반 관리비 항목도 이름만 보고 유형을 추정하지 않습니다. 전환 이후 새로 저장하는 내역부터 유형이 분리됩니다.

## 3. 화면

서버 연결 모드(VITE_USE_MOCK=false)에서 전세·관리비 5만원을 저장하고 조회합니다. 월세로 변경하고 월세 60만원·관리비 7만원·오늘 이후 납부일로 저장합니다. 가계부에는 새 월세와 월세 관리비만 표시되고 전세 관리비 5만원은 합계에서 빠져야 합니다. 전세로 다시 변경하면 월세 관리비는 보이지 않아야 합니다. 일반 공과금은 계속 표시되어야 합니다.

오늘 이전 납부일을 입력해도 저장은 성공해야 합니다. 이미 남아 있는 오늘 이후 미납 월세의 금액은 새 금액으로 변경되고, 이번 달의 지난 날짜로 기한이 이동하지 않아야 합니다. 기존 설정만 저장되고 월세 스냅샷이 오래된 상태라면 내 집 정보를 다시 저장하고 확인합니다. 기한이 이미 지난 기록은 보존됩니다.

## 4. Git

검증 통과 후 현재 backend 브랜치에서 관련 변경을 stage·commit·push합니다. 자동 커밋·push는 수행하지 않았습니다.

커밋 메시지: `fix: 월세 전환 시 예정 금액 갱신 및 계약별 관리비 분리`

backend → dev 병합 설명:

```text
월세 계약 저장 시 오늘 이후 미납 월세 스냅샷을 최신 금액·납부 조건에 맞추도록 수정했습니다.
납부일이 이미 지났더라도 기존 예정 건의 금액은 갱신하고 해당 건의 기존 기한은 유지합니다.
관리비에 계약 유형을 저장하고 전환 시 별도 항목을 생성하여 월세·전세 관리비가 섞이지 않도록 했습니다.
가계부 및 홈 합계에서 현재 계약 유형에 맞는 관리비만 조회하며 과거·납부 완료 기록은 보존합니다.
09 마이그레이션과 회귀 테스트를 추가했습니다.
검증 결과: 직접 실행한 테스트·DB·화면 결과를 기재합니다.
```

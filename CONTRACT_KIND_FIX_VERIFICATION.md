# 계약 기간 저장 차단·계약 유형 전환 검증

추가 변경: 반복 납부일 저장 및 적용 시작일은 RECURRING_PAYMENT_DAY_VERIFICATION.md가 최신 안내입니다. 해당 작업에는 08 마이그레이션이 필요합니다.

이번 안내는 기존 CONTRACT_PERIOD_FIX_VERIFICATION.md 및 CONTRACT_PAYMENT_UPDATE_VERIFICATION.md의 계약 기간 밖 내 집 정보 저장 허용 설명을 대체합니다.

## 변경 동작

- 내 집 정보 저장은 입력한 계약 시작 월~종료 월에 현재 월이 포함되어야 합니다. 기존 DB의 계약 기간이 잘못되어 있다면 현재 월이 포함되는 기간으로 수정해서 저장할 수 있습니다.
- 고정 지출 등록·수정은 현재 월, 선택 월, 납부 기한 월이 모두 계약 기간 안이어야 합니다. 기간은 현재 내 집 정보처럼 월 단위이며 시작·종료 월을 포함합니다. 기간을 비워 둔 경우 해당 경계는 제한하지 않습니다.
- 서버의 현재 날짜는 저장된 청구 시간대를 사용하고, 아직 저장된 시간대가 없으면 Asia/Seoul을 사용합니다.
- 전세 저장 시 납부 기한이 수정일 이후(당일 포함)이고 미납인 월세 예정 기록을 정리합니다. 월세 저장 시 같은 조건의 전세 이자 예정 기록을 정리합니다. 이전 오류로 반대 유형 예정분이 남아 있으면 같은 유형으로 다시 저장해도 정리됩니다.
- 납부 완료 및 수정일 이전 기한의 과거 기록은 DB에 보존합니다. 가계부 조회는 현재 계약 유형으로 통일하여 전세에서는 월세 기록을, 월세에서는 전세 대출 이자 기록을 표시·합산하지 않습니다. 과거 월 조회에도 같은 필터가 적용됩니다. 기존 월세 금액을 전세 보증금이나 이자 금액으로 이름만 바꾸지 않습니다.
- 전세는 보증금 전체를 매달 지출로 넣지 않습니다. 설정한 대출 조건에 따른 월 이자와 관리비가 등록됩니다. 대출이 없으면 월 이자도 없습니다.
- 저장과 예정 기록 정리는 동일 트랜잭션으로 처리합니다. 실패 시 계약 설정과 예정 기록 정리가 함께 롤백됩니다.

## 1. 테스트 (사용자 실행)

```powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.ContractPaymentChangesTests --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.BillMonthlyWriteTests
cd ..\frontend
node --test tests/monthly-bills-view.test.mjs tests/life-info.test.mjs tests/housing-contract.test.mjs
npm run build
```

테스트는 별도 H2 테스트 DB를 사용합니다. 실제 MySQL 데이터 검증을 대신하지 않습니다. 구현 과정에서 위 명령은 실행하지 않았습니다.

## 2. DB

이번 수정에 추가 마이그레이션은 없습니다. 앞서 안내한 07 마이그레이션의 rent_payments.due_date 및 loan_interest_charges.paid_at은 있어야 합니다. DB 연결 대상을 확인하고 백엔드를 재시작합니다.

```sql
SELECT DATABASE();
SHOW COLUMNS FROM rent_payments LIKE 'due_date';
SHOW COLUMNS FROM loan_interest_charges LIKE 'paid_at';
-- 실제 로그인 회원 ID로 바꿉니다.
SET @verify_user_id = 1;
SELECT c.contract_kind, c.billing_time_zone, s.move_in_ym, s.contract_end_ym, s.rent_amount
FROM home_contracts c JOIN user_settings s ON s.user_id=c.user_id
WHERE c.user_id=@verify_user_id;
SELECT period_ym, amount, due_date, paid_at FROM rent_payments
WHERE user_id=@verify_user_id ORDER BY period_ym;
SELECT c.charge_date, c.amount, c.paid_at, l.is_active
FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id
WHERE l.user_id=@verify_user_id ORDER BY c.charge_date;
```

전환 전후 결과를 비교합니다. 전세 저장 후 오늘 이후 미납 월세만 없어지고, 과거·납부 완료 월세가 유지되어야 합니다. 대출을 입력했다면 해당 조건의 이자가 보여야 합니다. 반대로 월세 저장 시 오늘 이후 미납 이자가 없어지고 월세 예정분이 등록되어야 합니다. 처음 시간대가 확정되지 않았다면 고정 지출 화면을 한 번 조회해 자동 등록 요청을 수행합니다.

## 3. 프론트 및 API

VITE_USE_MOCK=false인 서버 연결 화면에서 확인합니다.

1. 내 집 정보에서 입주한 달을 다음 달로 지정하고 저장 → HTTP 400 및 저장 버튼 위 경고 영역(role=alert)에 “입주 월을 확인해 주세요. 현재 월보다 뒤인 입주 월로는 저장할 수 없어요.” 표시. 편집 화면이 유지되고 DB의 입주 월·금액·관리비가 바뀌지 않아야 합니다. 전용 자동 테스트는 `HomeInfoTests.futureMoveInShowsSpecificWarningAndDoesNotChangeHome`입니다.
2. 계약 종료를 지난달로 지정하고 저장 → HTTP 400 및 “계약 종료 월을 확인해 주세요. 현재 월보다 이전인 계약 종료 월로는 저장할 수 없어요.” 경고. DB의 기존 종료 월·월세·관리비는 유지되어야 합니다. 전용 테스트는 `HomeInfoTests.expiredContractShowsSpecificWarningAndDoesNotChangeHome`입니다. 현재 월을 포함하는 정상 기간으로 저장하면 성공해야 합니다.
3. 월세 계약의 납부일을 오늘 이후로 설정하고 고정 지출 조회 → 월세 예정 기록 생성 확인.
4. 내 집 정보에서 전세로 변경하고 대출 금액·이율·납부일을 입력한 뒤 저장 → 전세 계약 응답, 오늘 이후 미납 월세 제거, 대출 이자 및 관리비 반영 확인. 고정 지출과 홈의 이번 달 지출 구성 모두 확인합니다.
5. 전세에서 월세로 변경 → 오늘 이후 미납 이자 제거 및 월세 등록 확인. 과거·납부 완료 기록은 DB에 유지되지만 현재 계약 유형과 다른 월세/이자는 화면과 합계에서 제외되어야 합니다. 관리비·공과금은 두 유형 모두 표시합니다. 대출 없는 전세는 월세와 대출 이자를 모두 표시하지 않습니다.
6. 기존 DB에 현재 날짜가 기간 밖인 계약이 있는 회원으로 과거 계약 월을 조회 → 조회는 허용하되 등록·수정은 차단. GET monthly 응답의 contractPeriod.currentOutside=true 확인.

## 4. Git (모든 검증 통과 후)

현재 backend 브랜치를 유지하고 git diff로 이전 작업과 함께 포함될 내용을 검토합니다. 관련 파일만 git add한 후 커밋·push합니다. 이 안내를 위한 커밋이나 push는 자동으로 수행하지 않았습니다.

커밋 메시지 한 줄:

```text
fix: 현재 날짜의 계약 기간 검증 및 월세·전세 전환 예정 내역 정리
```

backend → dev 병합 설명:

```text
현재 날짜가 계약 기간 밖이면 내 집 정보와 고정 지출 등록·수정을 차단했습니다.
조회 월과 현재 월의 계약 기간 상태를 구분해 화면에 저장 제한 사유를 표시했습니다.
월세·전세 전환 시 수정일 이후 미납인 이전 유형의 예정 내역을 정리하고 새 계약 조건을 반영했습니다.
과거 및 납부 완료 내역을 보존하고, 저장 실패 시 관련 변경을 함께 롤백하도록 처리했습니다.
계약 기간 차단과 유형 전환에 대한 백엔드·프론트 테스트를 추가했습니다.
검증 결과: 실제 실행한 테스트·DB·화면 결과를 이곳에 기재합니다.
```

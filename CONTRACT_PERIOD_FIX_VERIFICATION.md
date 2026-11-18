# 계약 기간 밖 신규 등록 방지 검증

수정한 누락 경로:
- 내 집 정보 저장 전에 변경 전 계약으로 실행하던 자동 등록을 제거했다. 새 계약 기간 저장 후 자동 등록한다.
- 내 집 정보 조회·저장의 이자 정산은 대출 시작일, 계약 시작 월, 계약 종료 월을 함께 적용한다. 월세 계약의 이전 전세 대출은 새 이자를 만들지 않는다.
- 계약 기간 밖의 연결 관리비 예정 항목은 표시하지 않는다. 이미 저장된 관리비는 보존한다.
- 기존 납부 API로 기간 밖 계약 관리비를 새로 생성하는 경로도 차단한다.

## 1. 테스트 (사용자 실행)
backend에서:
```powershell
.\gradlew.bat test --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.ContractAutoRegisterTests
```
frontend에서:
```powershell
node --test tests/monthly-bills-view.test.mjs
npm run build
```
이번 수정에서 테스트·빌드는 실행하지 않았다. 추가 마이그레이션은 없다. 기존 05의 billing_time_zone은 있어야 한다.

## 2. DB
이번 달 기록이 아직 없는 테스트 계정으로 확인한다. 기존 기록은 이번 수정으로 삭제되지 않으므로 이미 있는 행을 신규 등록으로 판단하지 않는다.
아래 123을 테스트 계정 ID로 바꿔 작업 전후 같은 쿼리를 실행한다.
```sql
SELECT DATABASE();
SELECT c.user_id,c.contract_kind,c.billing_time_zone,s.move_in_ym,s.contract_end_ym
FROM home_contracts c LEFT JOIN user_settings s ON s.user_id=c.user_id WHERE c.user_id=123;
SELECT period_ym,amount,paid_at FROM rent_payments WHERE user_id=123 ORDER BY period_ym;
SELECT p.bill_item_id,p.period_ym,p.amount,p.paid_at
FROM bill_payments p JOIN home_contracts c ON c.management_bill_id=p.bill_item_id WHERE c.user_id=123 ORDER BY p.period_ym;
SELECT c.loan_id,c.charge_date,c.amount
FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=123 ORDER BY c.charge_date;
```
예상 결과:
- 미래 계약으로 저장 후 자동 등록·조회 반복: 이번 달 월세·연결 관리비·이자 행 추가 없음
- 종료된 전세 계약: 이자가 생성되더라도 계약 기간 안의 도래분만 생성. 종료 월 다음 달부터 추가 없음
- 기존 저장 기록이 있다면 기간 변경 후에도 삭제·금액 변경 없음
- bill_items의 관리비 항목은 내 집 정보의 설정값으로 저장할 수 있다. 해당 월에 청구가 저장됐는지는 bill_payments로 구분한다.

## 3. 프론트
1. 수정한 백엔드를 다시 실행한다.
2. 내 집 정보에서 계약 시작을 다음 달 이후로 저장한다. 가계부·홈·내 집 정보를 반복 조회한다.
3. 계약 기간 밖 안내가 표시되고 새 월세·계약 관리비·예정 이자가 표시되지 않아야 한다.
4. 전세 계정은 종료 월이 지난 계약과 대출 시작일을 설정하고, DB에서 계약 종료 후 새 이자가 없는지 확인한다.
5. 기존 저장 기록이 보이는 것은 보존 정책이다. 2단계 쿼리의 전후 행을 비교해 새 행이 추가됐는지 판단한다.
6. 전기·가스 등 독립적인 수동 고지서는 계약 비용 자동 등록과 별개이며 계속 등록할 수 있다.

## 검증 후 Git
기존 backend 브랜치에서 git diff와 git status로 관련 변경을 확인·stage하고 커밋한 후 git push origin backend를 실행한다.

커밋 메시지: `fix: 계약 기간 밖 월세·관리비·이자 신규 생성 방지`

backend → dev 병합 설명:
- 내 집 정보 저장 전 이전 계약으로 자동 등록하던 경로 제거
- 조회·저장 시 이자 정산에 계약 시작·종료 월 및 계약 형태 적용
- 기간 밖 연결 관리비 예정 표시와 기존 납부 API의 신규 생성 차단
- 이미 저장된 월별 내역은 보존
- 검증 결과: 테스트 및 실제 DB 전후 비교 결과 기재

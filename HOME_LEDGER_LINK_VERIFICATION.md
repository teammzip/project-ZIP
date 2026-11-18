# 자동 등록 및 홈 지출 구성 확인

## 코드 점검 결과
- 자동 등록은 고정 지출 또는 홈 지출 구성 조회 전에 POST /api/bills/monthly/auto-register를 호출한다. 성공 후 월별 GET을 실행한다.
- 월세는 rent_payments, 별도 관리비는 bill_payments, 전세 대출 이자는 loan_interest_charges에 저장한다. 등록 주소 → 현재 위치 → 기기 시간대로 결정한 현재 월을 사용한다.
- 저장된 시간대가 있는 계약은 서버 스케줄러가 1분 간격으로 확인한다. 첫 시간대 확정 전, 서버 중지 중에는 이 스케줄러로 등록되지 않는다.
- POST가 500이면 저장 성공으로 판단하면 안 된다. 백엔드 로그의 Caused by와 실제 연결 DB의 스키마를 확인해야 한다.
- 홈은 기존 로컬 고정 지출 합산 대신 가계부와 같은 월별 API와 쿼리 키를 사용하도록 변경했다. 미납·예정 금액도 포함한다. 기타 지출은 여전히 로컬 기록이다.

## 1. 테스트 (직접 실행)
backend 디렉터리:
```powershell
.\gradlew.bat test --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.HomeInfoTests
```
frontend 디렉터리:
```powershell
node --test tests/*.test.mjs
npm run build
npm run lint
```

## 2. DB
백엔드가 사용하는 DB에서 확인한다. 아래 123은 실제 로그인 사용자 ID로 바꾼다.
```sql
SELECT DATABASE();
SHOW COLUMNS FROM home_contracts LIKE 'billing_time_zone';
SELECT user_id, contract_kind, billing_time_zone, management_included, management_bill_id FROM home_contracts WHERE user_id=123;
SELECT rent_amount, rent_day, move_in_ym, contract_end_ym FROM user_settings WHERE user_id=123;
SELECT period_ym, amount, paid_at FROM rent_payments WHERE user_id=123 ORDER BY period_ym DESC;
SELECT p.* FROM bill_payments p JOIN bill_items b ON b.id=p.bill_item_id WHERE b.user_id=123 ORDER BY p.period_ym DESC;
SELECT c.* FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=123 ORDER BY c.charge_date DESC;
```
컬럼이 없으면 db/migrations/20261118_05_contract_auto_register.sql을 적용한다. 이전 01~04 마이그레이션도 필요하다. 이미 존재하는 컬럼을 다시 추가하지 않는다.
POST 500이 계속되면 백엔드 터미널의 Caused by를 확인한다. 현재 브라우저 메시지만으로 원인은 확정되지 않았다.

## 3. 프론트
1. 서버 모드(VITE_USE_MOCK=false)에서 로그인한다.
2. 새 사용자 또는 아직 해당 월이 등록되지 않은 사용자로 내 집 정보를 저장한다. 월세 55만원, 별도 관리비 5만원 예시를 사용한다.
3. 홈을 연다. Network에서 자동 등록 POST 204 → 월별 GET 200 순서를 확인한다.
4. DB에서 해당 월 rent_payments 550000원, 관리비 bill_payments 50000원을 확인한다.
5. 기타 지출이 없으면 홈 합계와 가계부 고정 지출 합계가 모두 600000원인지 확인한다. 기타 지출이 있으면 홈에는 해당 월 기타 지출이 추가된다.
6. 새로고침을 반복해 DB 행 수가 증가하지 않는지 확인한다. 지난 달 선택 시 지난 달 저장 내역을 사용하는지 확인한다.
7. 이미 등록된 이번 달은 내 집 정보를 바꿔도 기존 금액을 보존하며 새로 생성되는 월부터 변경 금액을 사용한다.
8. 오류 시 홈이 0원으로 표시하지 않고 오류와 재조회 버튼을 제공하는지 확인한다.

## 검증 후 Git
기존 backend 브랜치에서 변경 파일을 검토하고 관련 파일만 stage한 후 커밋·push한다. 테스트 실패나 POST 500이 남아 있으면 검증 완료로 기록하지 않는다.

커밋 메시지: `feat: 계약 기반 고정 지출 자동 등록 및 홈 지출 구성 연동`

backend → dev 병합 설명:
- 내 집 정보의 계약 형태에 따라 월세·관리비·전세 대출 이자를 월별 자동 등록
- 계약 금액의 수정 경로를 내 집 정보로 제한하고 기존 월 기록 보존
- 홈 지출 구성에서 서버 가계부의 고정 지출을 동일한 월·시간대로 집계
- 홈 조회 실패와 로딩 상태 표시, 기타 지출의 로컬 저장 범위 안내
- DB 01~05 마이그레이션 필요
- 검증 결과: 직접 실행한 테스트, DB 저장·중복 방지, 화면 합계 비교 결과 기재

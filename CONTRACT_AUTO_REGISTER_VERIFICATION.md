# 계약별 매월 자동 등록 및 내 집 정보 전용 수정

구현 코드는 반영했으며 테스트·빌드·실제 DB 변경은 실행하지 않았습니다. 이 문서는 기존 계약별 조회 가이드에 추가된 최신 동작입니다.

## 동작
- 내 집 정보의 월세/전세, 월세, 관리비, 대출 원금·연이율·납부일을 사용합니다.
- 월세: 월세(만원 DB 값을 원으로 변환) + 별도 관리비.
- 전세: 활성 대출 이자(원금 × 연이율 ÷ 1200, 원 단위 반올림) + 별도 관리비. 대출 없으면 이자 0.
- 월세에 관리비 포함이면 별도 관리비를 새로 만들지 않습니다. 보증금·전세 계약금은 월 고정 지출에 넣지 않습니다.
- 가계부 조회 전에 POST /api/bills/monthly/auto-register?timeZone=...로 현재 월 기록을 DB에 등록합니다. GET 자체는 조회만 합니다.
- 시간대는 기존 주소 → 현재 위치 → 기기 우선순위로 프론트가 확정합니다. 최초 등록 요청 때 home_contracts.billing_time_zone에 저장합니다.
- 서버 작업 ContractExpenseScheduler가 1분마다 저장된 시간대의 현재 월을 확인합니다. 화면을 닫아도 서버가 실행 중이면 다음 달 첫 확인 시 등록됩니다. 처음 시간대를 확정하기 전에는 자동 작업 대상이 아닙니다.
- 서버가 중지된 동안의 월은 현재 계약 조건으로 소급 생성하지 않습니다. 재시작 시 현재 월을 처리합니다. 최초 과거 계약 이력을 임의 생성하지 않습니다.
- 사용자 행 잠금과 월별 고유키로 동일 월 재실행·동시 요청의 중복을 방지합니다. 이미 삭제된 관리비 월 기록도 되살리지 않습니다.
- 기존 월 기록은 덮어쓰지 않습니다. 내 집 정보 변경은 이후 새로 생성되는 월부터 반영됩니다. 기존 계약의 현재 월은 변경 전에 확정합니다. 계약 기간 밖에는 새 월 기록을 만들지 않습니다.
- rent_payments, bill_payments, loan_interest_charges에 항목별로 저장하고 화면에서 합산합니다. 합산 금액을 별도 지출로 다시 저장하지 않아 이중 집계를 막습니다.
- 자동 등록은 납부 완료가 아닙니다. 이자 계산 기록도 실제 납부 확인 전으로 유지합니다.
- 월세·이자·계약에 연결된 관리비에는 가계부 수정/삭제 대신 내 집 정보 링크가 표시됩니다. 계약 관리비의 일반 수정/삭제 API와 금액을 포함한 납부 API 요청은 409로 차단합니다. 일반 공과금·통신·구독은 기존대로 수정/삭제할 수 있습니다.

## 1. 자동 테스트

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillMonthlyDeleteTests --tests com.zip.backend.BillIntegrationTests --tests com.zip.backend.HomeInfoTests
~~~

정상: BUILD SUCCESSFUL. 시간대별 월 전환, 월별 중복 방지, 금액 보존/다음 월 변경, 월세·전세 계산, 관리비 포함, 기간 종료, 세션·계약 관리비 변경 제한을 검사합니다. 테스트 설정에서는 백그라운드 자동 작업을 비활성화하고 고정 Clock으로 월 전환을 확인합니다.

## 2. DB 마이그레이션 및 실제 연결 검증

새 20261118_05_contract_auto_register.sql은 home_contracts.billing_time_zone 컬럼을 추가합니다. 기존 01~04와 내 집 정보 테이블이 먼저 준비되어 있어야 합니다. 접속 대상 DB를 확인한 뒤:

~~~powershell
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql -PapplyMonthlyMigration
~~~

정상: MySQL PASS에 persisted automatic rent/interest and idempotency 출력과 fixture data rolled back. 마이그레이션은 남고 임시 데이터는 롤백됩니다. 재실행은 -PapplyMonthlyMigration 없이 가능합니다.

직접 SQL 파일을 적용한다면 05의 ALTER는 한 번만 실행하세요. 적용 후 백엔드를 재시작합니다.

확인 SQL (123은 본인 사용자 ID):

~~~sql
SELECT contract_kind,management_included,management_fee,management_bill_id,billing_time_zone
FROM home_contracts WHERE user_id=123;
SELECT period_ym,amount,paid_at FROM rent_payments WHERE user_id=123 ORDER BY period_ym;
SELECT p.* FROM bill_payments p JOIN bill_items b ON b.id=p.bill_item_id WHERE b.user_id=123;
SELECT c.* FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id WHERE l.user_id=123;
~~~

## 3. 프론트 자동 검사와 실제 화면

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\frontend
node --test tests/*.test.mjs
npm run build
npm run lint
~~~

VITE_USE_MOCK=false, 서버 재시작 후 확인:
1. 내 집 정보에 월세 550000원 + 별도 관리비 50000원 저장.
2. 가계부 고정 지출에 진입. Network에서 자동 등록 POST 204 → GET 200 순서, 합계 600000원(다른 공통 기록 없을 때) 확인.
3. 새로고침 반복 후 SQL의 월별 행 수가 늘지 않는지 확인.
4. 월세·관리비에 가계부 수정/삭제 대신 내 집 정보 링크가 있는지 확인.
5. 테스트 계정에서 전세 대출 1억원·연 3.6%·별도 관리비 50000원으로 시작하면 월 350000원. 같은 달 월세→전세 변경 계정은 기존 저장 월세가 보존되므로 새 계정 또는 별도 검증 DB로 비교.
6. 자동 등록만으로 납부 완료 금액이 증가하지 않는지 확인.
7. 새 달 동작은 ContractAutoRegisterTests의 고정 시각 테스트로 확인. 운영 PC·DB 시간을 바꿀 필요는 없습니다.
8. 화면 종료 후에도 서버가 켜져 있고 저장된 시간대가 있다면 작업이 계속 실행됩니다. zip.bills.auto-register.enabled=false로 비활성화할 수 있습니다.

## 검증 완료 후 Git

기존 backend 브랜치에서 git status와 git diff를 확인하고 이번 계약 연결 작업 파일과 신규 자동 등록 파일을 함께 추가하세요. 개인 DB 설정은 추가하지 마세요.

커밋 메시지:
feat: 내 집 정보 기반 월별 고정 지출 자동 등록 및 수정 경로 제한

backend → dev 병합 설명:
내 집 정보의 계약 형태에 따라 월세·별도 관리비·전세 대출 이자를 월별 DB 기록으로 자동 등록했습니다. 확정된 지역 시간대를 저장하고 서버가 1분마다 월 전환을 확인하며, 기존 월 기록과 삭제 상태를 보존해 중복 등록을 방지합니다. 가계부는 자동 등록 항목의 조회·합산을 제공하고 계약 금액 수정은 내 집 정보로 제한했습니다. 20261118_05_contract_auto_register.sql 적용과 서버 재시작이 필요합니다. 검증 결과: [직접 실행한 결과 기입].


## 계약 기간 밖 안내 추가
- 월별 응답의 contractPeriod(from, through, outside)는 DB에 저장된 계약 기간을 기준으로 계산한다.
- 고정 지출 화면은 outside=true이면 계약 기간과 자동 등록 제외 사유를 표시하고 내 집 정보로 연결한다. 기존 저장 내역은 계속 표시한다.
- 테스트: backend에서 .\gradlew.bat test --tests com.zip.backend.BillHousingMonthlyTests, frontend에서 node --test tests/monthly-bills-view.test.mjs 실행.
- DB: user_settings.move_in_ym, contract_end_ym과 조회 월을 비교한다. 추가 마이그레이션은 없다.
- 프론트: 계약 시작 전·종료 후 월에 안내가 있고, 기간 안의 월에는 없는지 확인한다. 이미 저장된 월세가 있는 경우에도 기록은 보존되는지 확인한다.
- 커밋 메시지: feat: 계약 기간 밖 고정 지출의 자동 등록 제외 사유 표시
- backend → dev 설명: 월별 조회 응답에 DB 계약 기간·기간 밖 여부를 추가하고, 고정 지출 화면에 제외 사유와 내 집 정보 링크를 표시. 기존 저장 내역은 보존. 검증 결과는 직접 실행 후 기재.

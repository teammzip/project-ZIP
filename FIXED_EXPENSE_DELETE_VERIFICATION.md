# 고정 지출 월별 삭제 검증

구현은 반영했지만 테스트, 빌드, 실제 DB 마이그레이션은 실행하지 않았습니다. 아래 순서로 직접 실행하세요. 실패하면 다음 단계나 Git 업로드를 진행하지 마세요.

## 동작
- 등록된 기록 옆 삭제 → 확인창 → 선택한 월만 삭제. 미등록 예정액에는 삭제 버튼이 없습니다.
- bill_payments.deleted_at에 삭제 시각을 저장합니다. 실제 행, 다른 월, 납부 이력, 고지서 식별 해시는 보존합니다.
- 삭제 월 목록과 합계 및 v_monthly_spend_breakdown에서 제외하며, 삭제 월을 수정하거나 납부 처리하면 404입니다.
- 같은 기록의 삭제 재요청은 204입니다. 타인 기록은 404, 미인증은 401입니다.
- 다음 달 자동 예정액은 유지됩니다. 정기 항목 전체 해지 기능과 구분됩니다.
- 복원 UI는 이번 범위에 없습니다. 동일 고지서 사진은 삭제 후에도 중복 차단됩니다. 직접 새로 등록하면 별도 기록입니다.

## 1. 자동 테스트 (별도 테스트 DB/H2)

PowerShell:

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.BillMonthlyDeleteTests --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillIntegrationTests
~~~

결과: BUILD SUCCESSFUL. 삭제 API의 상태 코드, DB 삭제 시각, 재조회 제외, 다른 달 보존, 삭제 후 변경 금지와 기존 등록/수정 회귀를 확인합니다.

## 2. 실제 MySQL 연결 검증

현재 연결할 DB를 application-local.properties 또는 DB_URL/DB_USERNAME/DB_PASSWORD 환경변수로 먼저 확인하세요. 이 단계의 마이그레이션은 실제 DB에 남습니다. 검증용 사용자와 기록은 트랜잭션으로 롤백됩니다.

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql -PapplyMonthlyMigration
~~~

01~04의 누락된 컬럼·테이블을 적용하고 삭제 제외 집계 뷰를 갱신합니다. 04 SQL을 이미 직접 적용한 경우에도 위 스크립트는 컬럼 존재 여부를 확인합니다. SQL 파일을 직접 실행할 때 ALTER TABLE은 한 번만 실행하세요.

다시 검증할 때:

~~~powershell
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql
~~~

결과: MySQL PASS, fixture data rolled back. 선택 월 삭제, 삭제 재요청, 집계 뷰와 조회 금액 일치, 다른 달 보존, 고지서 식별 해시 보존을 확인합니다.

수동 조회 예시 (본인 사용자 ID·월로 변경):

~~~sql
SELECT b.user_id, p.bill_item_id, p.period_ym, p.amount, p.deleted_at
FROM bill_payments p JOIN bill_items b ON b.id = p.bill_item_id
WHERE b.user_id = 123 AND p.period_ym = '2026-11';
SELECT * FROM v_monthly_spend_breakdown
WHERE user_id = 123 AND period_ym = '2026-11';
~~~

백엔드를 재시작한 뒤 화면 확인을 진행하세요.

## 3. 프론트 자동 검사 → 화면 확인

~~~powershell
cd C:\project-ZIP-dev\project-ZIP\frontend
node --test tests/*.test.mjs
npm run build
npm run lint
~~~

추가한 컴포넌트 자동 테스트: 삭제 성공과 목록 갱신, 취소, 미등록 기록, 실패 시 보존, 연속 클릭 요청 방지. 이 테스트는 브라우저 E2E가 아니므로 실제 서버 연결 화면도 아래대로 확인하세요.

1. VITE_USE_MOCK=false로 서버 API 연결, 로그인 후 가계부 → 지출 → 고정 지출.
2. 해당 월 기록 등록 → 수정 옆 삭제 버튼 확인.
3. 삭제 취소 → 기록·금액 유지.
4. 삭제 확인 → Network DELETE /api/bills/monthly/{id}?month=...&timeZone=... 204.
5. 목록·합계·납부 완료·미납 예정 금액과 차트에서 해당 금액 제외.
6. 새로고침해도 재등장하지 않고 다른 달 기록은 유지.
7. 같은 고지서 사진 재등록은 409, 다른 고지서는 등록 가능.

## 4. 검증 완료 후 Git

기존 브랜치에서 진행합니다. 이전 작업 변경도 남아 있으므로 git diff로 함께 업로드할 범위를 확인하세요. 새 파일은 git add -p만으로 포함되지 않습니다.

~~~powershell
cd C:\project-ZIP-dev\project-ZIP
git status --short
git diff
git add -p
git add backend/src/test/java/com/zip/backend/BillMonthlyDeleteTests.java db/migrations/20261118_04_bill_monthly_delete.sql FIXED_EXPENSE_DELETE_VERIFICATION.md
~~~

이번 삭제 구현은 이전 미커밋 등록·수정 코드, MonthlyBillEditor.tsx, 기존 테스트 파일, MySQL 검증 스크립트에 의존합니다. 이 파일들이 아직 untracked라면 필요한 이전 작업 파일도 명시적으로 git add 하세요. 민감한 application-local.properties와 .env.local은 추가하지 마세요.

~~~powershell
git diff --cached --stat
git diff --cached
git commit -m "feat: 고정 지출 월별 삭제 및 자동 검증 추가"
git push origin HEAD
~~~

PR description 예시 (실제로 통과한 항목만 기재):

선택한 월에 등록한 고정 지출을 확인창을 통해 삭제할 수 있도록 구현했습니다. DB에 삭제 시각을 남기고 목록과 지출 집계에서 제외하여 예정 지출로 다시 나타나는 문제를 방지했습니다. 다른 달의 기록과 고지서 중복 식별 정보는 보존합니다. 삭제 권한, 재요청, 삭제 후 변경 방지 및 프론트 취소·실패·연속 클릭 자동 테스트와 MySQL 검증 절차를 추가했습니다. 검증 결과: [직접 실행한 결과 기입]. DB 배포 시 20261118_04_bill_monthly_delete.sql 적용이 필요합니다.

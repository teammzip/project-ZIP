# backend → dev 병합 전 통합 검증

2026-11-18 원격 동기화: 최신 origin/dev(496e917)의 회원가입·이메일 인증·아이디/비밀번호 찾기를 현재 backend에 fast-forward 반영하고 미커밋 생활정보 작업을 복원했습니다. 빌드 설정·auth-fixture·API 문서는 자동 병합되었으며 충돌 표시는 없습니다. 이 통합 후에는 아래 선택 테스트뿐 아니라 backend에서 `.\gradlew.bat test`로 EmailAuthTests를 포함한 전체 백엔드 테스트도 실행하세요. 테스트/빌드/DB 적용 및 로컬 작업 커밋·push는 자동 수행하지 않았습니다. 복구용 stash는 유지했습니다.

대상: 87d36a4 이후 계약 자동 등록·기간 검증·반복 납부일·관리비 유형 분리·홈 연동·AI 고지서 동의 등록 변경. 테스트와 실제 DB 적용은 사용자가 실행합니다. 이 문서 작성 중에는 테스트·빌드·DB 변경을 실행하지 않았습니다.

## 1. 자동 테스트

프로젝트 루트에서 PowerShell로 아래 블록을 실행합니다. 명령이 실패하면 중단하므로 다음 단계에 진행하지 말고 실패 결과를 확인합니다.

```powershell
Set-Location C:\project-ZIP-dev\project-ZIP\backend
.\gradlew.bat test --tests com.zip.backend.ContractAutoRegisterTests --tests com.zip.backend.ContractPaymentChangesTests --tests com.zip.backend.HomeInfoTests --tests com.zip.backend.BillHousingMonthlyTests --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillMonthlyDeleteTests --tests com.zip.backend.BillIntegrationTests --tests com.zip.backend.BillQrReaderTests
if ($LASTEXITCODE -ne 0) { throw '백엔드 테스트 실패: 결과 확인 후 수정이 필요합니다.' }

Set-Location ..\frontend
node --test tests/contract-auto-register.test.mjs tests/monthly-bills-view.test.mjs tests/ai-bill-photo.test.mjs tests/life-info.test.mjs tests/housing-contract.test.mjs
if ($LASTEXITCODE -ne 0) { throw '프론트 테스트 실패' }
npm run build
if ($LASTEXITCODE -ne 0) { throw '프론트 빌드 실패' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw '프론트 린트 실패' }
```

통과 기준: 백엔드 BUILD SUCCESSFUL, Node 테스트 fail 0, build와 lint 종료 코드 0. 백엔드 보고서: backend/build/reports/tests/test/index.html. 백엔드 테스트는 H2 DB 및 모의 AI를 사용하므로 실제 MySQL·Gemini 검증은 별도입니다.

## 2. 실제 DB 준비 및 비교

Workbench에서 백엔드와 같은 DB를 선택하고 아래 SQL로 상태를 확인합니다. 01~04가 적용된 기존 DB 기준으로 미적용 05~09를 번호순 적용합니다. 이미 적용한 05는 ALTER를 재실행하지 않습니다. 06~09도 아래 상태를 확인한 후 필요한 파일을 사용합니다. 07~09는 현재 수정본 전체를 실행합니다.

```sql
SELECT DATABASE();
SHOW COLUMNS FROM home_contracts LIKE 'billing_time_zone';       -- 05
SHOW TABLES LIKE 'bill_photo_drafts';                          -- 06
SHOW COLUMNS FROM rent_payments LIKE 'due_date';                -- 07
SHOW COLUMNS FROM loan_interest_charges LIKE 'paid_at';         -- 07
SHOW COLUMNS FROM home_contracts LIKE 'payment_effective_from'; -- 08
SHOW COLUMNS FROM bill_items LIKE 'home_contract_kind';        -- 09
```

파일은 db/migrations/20261118_05_contract_auto_register.sql부터 09_management_contract_kind.sql까지입니다. 최신 schema.sql은 새 DB용이며 기존 DB에 파일만 수정해도 반영되지 않습니다. 마이그레이션 후 백엔드를 재시작합니다.

아래 사용자 ID를 실제 로그인한 회원 ID로 바꾸고 화면 저장 전후 각각 실행하여 비교합니다. 계정의 토큰·쿠키·비밀번호는 공유하지 않습니다.

```sql
SET @verify_user_id=1;
SELECT c.contract_kind,c.billing_time_zone,c.payment_effective_from,c.management_bill_id,
       s.move_in_ym,s.contract_end_ym,s.rent_amount,s.rent_day
FROM home_contracts c JOIN user_settings s ON s.user_id=c.user_id
WHERE c.user_id=@verify_user_id;

SELECT period_ym,amount,due_date,paid_at FROM rent_payments
WHERE user_id=@verify_user_id ORDER BY period_ym;

SELECT b.id,b.name,b.home_contract_kind,b.is_active,b.default_amount,
       p.period_ym,p.amount,p.due_date,p.paid_at,p.deleted_at
FROM bill_items b LEFT JOIN bill_payments p ON p.bill_item_id=b.id
WHERE b.user_id=@verify_user_id ORDER BY b.id,p.period_ym;

SELECT c.charge_date,c.amount,c.paid_at,l.is_active FROM loan_interest_charges c
JOIN housing_loans l ON l.id=c.loan_id
WHERE l.user_id=@verify_user_id ORDER BY c.charge_date;

SELECT id,state,period_ym,expires_at FROM bill_photo_drafts
WHERE user_id=@verify_user_id ORDER BY expires_at DESC;
```

## 3. 화면 + Network + DB 검증

VITE_USE_MOCK=false로 서버 연결 모드를 사용하고 프론트를 재시작합니다. 아래 2026-11-18 예시는 실제 검증일이 달라지면 해당 지역의 오늘 기준으로 조정합니다. 테스트 계정에서 실행하고, 표의 항목마다 위 DB 결과도 비교합니다.

| 항목 | 조작 | 통과 기준 |
|---|---|---|
| 입주 전 차단 | 입주 2026-12, 종료 2027-12 저장 | PUT home-info 400, 입주 월 경고, 기존 DB 값 유지 |
| 계약 종료 차단 | 입주 2026-01, 종료 2026-10 저장 | 400, 종료 월 경고, 기존 DB 값 유지 |
| 정상 월세 저장 | 현재 월을 포함하는 계약, 월세 55만원, 납부 25일, 별도 관리비 5만원 | 저장 성공, 가계부 조회 후 월세·월세 관리비 표시 |
| 같은 조건 재저장 | 새로고침·재로그인·다시 저장 | 같은 월의 청구가 중복 생성되지 않음 |
| 금액 갱신 | 미납 월세 55만원을 내 집 정보에서 60만원으로 수정 | 오늘 이후 미납 월세 DB 금액과 화면 모두 60만원 |
| 이미 지난 반복일 | 매월 납부일을 15일로 저장 | 저장 성공. 신규 11월 15일 건은 생성하지 않음. 기존 11월 25일 미납 건은 기한 유지·새 금액 반영. 다음 달부터 15일 적용 |
| 과거·납부 완료 보존 | 과거 기한 또는 납부 완료 기록을 수정 전후 비교 | 금액·기한·납부 시각 유지 |
| 전세 전환 | 전세 및 대출 조건·관리비 저장 | 월세와 월세 관리비는 표시·합산 제외, 전세 이자와 전세 관리비 표시 |
| 대출 없는 전세 | 대출 없음으로 저장 | 월세 표시 안 함, 신규 이자 생성 안 함. 기존 같은 유형의 이자 기록은 보존 |
| 월세 재전환 | 월세·금액·납부일·관리비 입력 후 저장 | 새 월세 조건 반영, 전세 이자·전세 관리비 제외, 이전 관리비 예정분 중복 합산 안 함 |
| 월별 조회 | 과거 월과 이번 달 선택 | 선택 월 데이터와 합계 일치. 현재 계약 유형 필터 유지. 미래 월 조회 불가 |
| 홈 연동 | 같은 조회 월의 가계부와 홈 지출 구성 비교 | 고정 지출 금액 일치. 홈 기타 지출은 기존 로컬 금액이 추가될 수 있음 |
| AI 카드 제한 | 일반 질문 및 다른 카드 확인 | 고지서 전용 입력은 공과금·생활비 카드에만 표시 |
| AI 인식만 수행 | 2MB 이하 JPG/PNG 고지서 읽기 | 등록 질문 표시, draft PENDING, bill_payments 추가 없음 |
| AI 취소 | 등록 안 함 선택 | draft CANCELLED, 가계부 추가 없음 |
| AI 동의 | 다시 읽고 가계부에 등록 선택 | draft REGISTERED, 가계부 한 건 추가, 홈에도 반영 |
| 고지서 중복 | 같은 사진 또는 같은 식별 정보가 인식되는 다른 사진 등록 | 409, 가계부 중복 없음. 같은 분류의 다른 고지서는 허용 |
| 모바일 촬영 | 공과금·생활비 카드에서 카메라로 촬영 | 지원 브라우저에서 촬영 가능, 인식 이후 동의 단계 유지 |

AI 실물 인식에는 서버의 Gemini 설정이 필요합니다. URL만 담긴 QR은 링크를 방문해 청구 금액을 가져오지 않습니다. 촬영 사진은 JPG/PNG·2MB 제한이 있으며 카메라 호출 방식은 브라우저에 따라 다릅니다. 이미 같은 관리비 항목에 섞인 과거 유형은 09로 정확히 자동 복원할 수 없습니다.

다음 달 반영과 시간대 월 경계는 고정 Clock 자동 테스트로 확인합니다. PC나 DB 시간을 바꾸지 않습니다. 기간 밖 자동 등록 요청은 204를 반환해도 실제 청구 생성이 없는 정상 동작일 수 있으므로 DB 결과로 판단합니다.

## 4. 결과 기록 후 Git

```text
백엔드 테스트: 통과 / 실패
프론트 테스트: 통과 / 실패
프론트 build·lint: 통과 / 실패
DB 05~09 적용 및 컬럼 확인: 완료 / 미완료
계약 기간·반복일·유형 전환·관리비·홈 검증: 통과 / 실패
실제 AI 사진·동의·취소·중복 검증: 통과 / 실패 / 미실행(사유)
```

실제로 통과한 결과만 PR에 기재합니다. 실패가 있으면 병합 전 수정합니다. Git 올리기 전 `git status --short`, `git diff`, stage 후 `git diff --cached --stat`로 이번 범위를 확인합니다. 테스트 결과만을 이유로 기존 브랜치를 새로 만들 필요는 없습니다.

커밋 메시지: `feat: 계약별 고정 지출 자동 등록·갱신 및 AI 고지서 등록 동의 기능 구현`

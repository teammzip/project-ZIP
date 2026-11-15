# 내 집 정보 서버 저장·조회

## 구현 범위

- GET/PUT `/api/me/home-info`: 토큰의 본인 계약만 조회·저장한다.
- `home_contracts`: 월세/전세 유형, 보증금, 관리비 포함 여부·금액, 전세 계약금, 관리비 항목 연결.
- `user_settings`: 실제 집 주소, 월세(만원), 납부일, 입주월·종료월. 동네 인증과 알림 설정은 변경하지 않는다.
- `housing_loans`, `loan_interest_charges`: 대출 조건과 월별 이자 스냅샷. 조건 변경 전에 기존 조건의 도래분을 기록하고 기존 월은 수정하지 않는다.
- `bill_items`, `bill_payments`: 기존 관리비 항목을 연결하거나 생성한다. 반복 저장으로 활성 관리비 항목을 중복 생성하지 않고 기존 납부 스냅샷은 보존한다.
- 계약·설정·관리비·대출 저장은 하나의 트랜잭션이다. 실패하면 전체 롤백한다.
- 개인 정보·생년월일·가입 이메일·아이디·원래 설문은 수정하지 않는다.

프론트 실제 모드(`VITE_USE_MOCK=false`)는 로그인/새로고침 및 내 집 정보 창을 열 때 서버 값을 복원한다.
조회 실패 시 재시도 버튼, 저장 실패 시 입력 유지, 저장 중 중복 제출 차단, 계정 전환 후 늦은 응답 적용 차단을 구현했다.
서버에 계약이 없는 회원의 기존 로컬 정보는 초안으로 보존한다. 서버에 자동 업로드하지 않으며 저장 버튼으로 명시적으로 저장한다.

## 1. 테스트

검증 결과: 프론트 전체 테스트 69개, 백엔드 전체 테스트 116개 통과. 프론트 빌드·린트 통과.

루트 PowerShell:

```powershell
Push-Location frontend
node --test tests/*.test.mjs
npm run build
npm run lint
Pop-Location
Push-Location backend
.\gradlew.bat test
Pop-Location
```

HomeInfoTests는 정상 저장·재조회·재로그인, 날짜 초기화, 관리비 중복 방지, 금액·날짜 오류,
저장 중 DB 제약 실패의 전체 롤백, 대출 이자 스냅샷 보존, 회원 격리·미인증 차단을 검증한다.
home-api.test.mjs는 서버 복원·초안 보존·실패 시 상태 유지·계정 전환·오래된 조회 응답 차단을 검증한다.

## 2. DB

현재 로컬 MySQL에는 `db/migrations/20261115_home_contracts.sql` 적용 완료.
실제 서비스 코드로 임시 회원의 월세·전세 저장·재조회, 날짜 초기화, 금액 변환, 중복 방지를 검증한 뒤 데이터는 롤백했다.
다른 팀원은 연결된 DB를 확인한 다음 이 마이그레이션을 먼저 적용해야 한다. 새 DB는 최신 schema.sql을 사용한다.

검증용 계정으로 화면에서 저장한 뒤 실행:

```sql
SELECT DATABASE();
SET @home_user_id = NULL; -- 로그인한 검증용 회원 ID로 변경
SELECT * FROM home_contracts WHERE user_id = @home_user_id;
SELECT user_id,home_address,rent_amount,rent_day,move_in_ym,contract_end_ym
FROM user_settings WHERE user_id = @home_user_id;
SELECT id,principal,annual_rate,payment_day,start_date,is_active
FROM housing_loans WHERE user_id = @home_user_id;
SELECT c.charge_date,c.amount,c.principal,c.annual_rate
FROM loan_interest_charges c JOIN housing_loans l ON l.id=c.loan_id
WHERE l.user_id = @home_user_id ORDER BY c.charge_date;
SELECT b.id,b.name,b.default_amount,b.is_active,p.period_ym,p.amount,p.paid_at
FROM bill_items b LEFT JOIN bill_payments p ON p.bill_item_id=b.id
WHERE b.user_id = @home_user_id AND b.tag='관리비';
```

월세 550,003원 → rent_amount=55.0003. 날짜 삭제 → DB NULL, API 빈 문자열.
관리비 금액 수정은 기본 금액을 변경하며 이미 확정된 월별 청구·납부 금액은 보존한다.

## 3. 프론트 직접 검증

1. 마이그레이션 적용 후 백엔드를 재시작하고 frontend에서 `npm run dev` 실행.
2. http://127.0.0.1:3000/my/settings → 실제 계정 로그인 → 내 집 정보.
3. 월세: 보증금 10,000,000원, 월세 550,003원, 별도 관리비 50,000원, 입주 2026-01, 종료 2028-01 저장.
4. Network에서 PUT `/api/me/home-info` 200 확인 → 위 SQL 조회 → 새로고침·재로그인·별도 브라우저에서 복원 확인.
5. 날짜 지우고 저장 → 다시 열어 빈 값 확인. 관리비 동일 값 반복 저장 후 DB 중복 여부 확인.
6. 전세로 변경, 대출 원금 100,000,000원·금리 4%·납부일 1일·시작일 2026-01-01 입력. 월세는 0이며 대출과 월별 이자 조회 확인.
7. 종료월을 입주월보다 빠르게 입력 → 저장 차단. 서버 연결을 끊고 저장 → 오류 표시·입력 유지.
8. 다른 계정으로 로그인 → 앞 회원의 계약이 표시되지 않는지 확인.

브라우저에서의 실제 화면 조작 검증은 사용자가 위 절차로 확인한다. 자동 검증의 DB·컴포넌트 테스트와 구분한다.

## 남은 별도 작업

- 일반 고정 지출 등록·수정·월별 납부 체크와 월세 납부 체크는 아직 로컬 동작이다.
- 가계부의 과거 월 합계를 서버 월별 스냅샷으로 바꾸는 작업은 별도다.
- 첫 로그인 설문과 별도 대출 카드의 편집은 이번 내 집 정보 폼 저장 API와 구분한다. 기존 로컬 이력의 자동 서버 이관은 수행하지 않는다.
- 관리비 화면 반영은 관리비 전용 로컬 식별값으로 연결한다. 전체 고정 지출 API 연결 시 서버 문자열 ID와 월별 기록을 함께 사용하도록 전환한다.

## 4. Git 공유 (현재 backend 브랜치 유지)

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/settings/HomeInfoController.java backend/src/main/java/com/zip/backend/settings/HomeInfoInput.java backend/src/main/java/com/zip/backend/settings/HomeInfoService.java backend/src/test/java/com/zip/backend/HomeInfoTests.java backend/src/test/resources/home-info-fixture.sql db/migrations/20261115_home_contracts.sql db/schema.sql frontend/src/features/life/homeApi.ts frontend/src/features/life/components/MyInfo.tsx frontend/src/app/setupApi.ts frontend/tests/home-api.test.mjs frontend/tests/life-info.test.mjs frontend/tests/housing-contract.test.mjs HOME_INFO_VERIFICATION.md LIFE_IMPLEMENTATION_STATUS.md backend/README.md frontend/API.md
git diff --cached
git commit -m "feat: 내 집 정보 서버 저장 및 조회 연결"
git push origin backend
```

팀 공유: DB 마이그레이션 먼저 적용 → 백엔드 재시작. 내 집 정보는 서버 저장·복원하며 일반 가계부/납부 체크 전체 서버화는 후속 범위.

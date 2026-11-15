# 생활정보 구현 현황과 후속 작업

> 최신 업데이트: 내 집 정보 GET/PUT `/api/me/home-info`와 프론트 연결 구현 완료. 월세·전세 계약, 설정, 대출 조건·이자, 관리비를 DB에 저장·조회한다. 아래 초기 점검표와 작업 1은 과거 기록이며 현재 검증·제한·Git 공유 절차는 HOME_INFO_VERIFICATION.md를 따른다.

점검일: 2026-11-15. 코드 및 테스트 기준이며, 테이블 정의의 존재를 실제 MySQL 배포 완료로 간주하지 않는다.

## 현재 범위

| 기능 | 프론트 | 서버 | DB 연결 상태 |
| --- | --- | --- | --- |
| 입력 검증 | 날짜 형식·순서, 금액, 납부일, 주소 길이 검증. 날짜 초기화와 원 단위 복원 수정 | 기존 설정 API에도 날짜·금액·납부일 검증 있음 | 화면에서는 서버 검증을 호출하지 않음 |
| 기본 생활 설정 | 주소·월세·납부일·입주월·종료월·알림 설정 | GET/PUT /api/me/settings 구현 | user_settings 저장 코드 있음, 프론트 미연결 |
| 월세·전세 계약 | 계약 유형, 보증금, 관리비 포함 여부, 전세 계약금 입력 | 주거 설문 API 미구현 | housing_surveys 정의 있음, 화면은 로컬 저장 |
| 대출 | 조건 입력·검증, 월별 이자 기록 | 관련 API 미구현 | housing_loans·loan_interest_charges 정의 있음, 화면은 로컬 저장 |
| 고정 지출 | 추가·수정·삭제, 월별 납부 체크 | /api/bills CRUD 및 월별 납부 API 구현 | bill_items·bill_payments 저장 코드 있음, 프론트 미연결 |
| 월세 납부 | 월별 체크 | 관련 API 미구현 | rent_payments 정의 있음, 로컬 저장 |
| 수입·기타 지출 | 추가·삭제, 분류·순서 관리 | 관련 API 미구현 | incomes·expenses 등 정의 있음, 로컬 저장 |
| 일정 | 추가·수정·삭제·완료, 카테고리, 반복 기념일 | 관련 API 미구현 | events·event_categories·event_presets 정의 있음, 로컬 저장 |
| 알림 | 일정·월세로 생성, 읽음·삭제 | 관련 API 미구현 | notifications 정의 있음, 로컬 저장 |
| 동네 인증 | 현재 위치 확인, 인증 30일 판정 | 설정 API는 새로운 VERIFIED 상태 부여를 거부. 별도 인증 API 필요 | 인증 상태는 로컬 판정 |
| 쓰레기 배출 | 표시를 위한 계산 로직 | 실제 지역별 연결 없음 | TRASH 배열이 비어 있어 실제 일정 미제공 |

근거 파일:

- frontend/src/features/life/components/MyInfo.tsx: 폼 검증 후 대출·설문·설정·관리비를 로컬에서 순차 변경
- frontend/src/features/life/validateLifeInfo.ts: 생활정보 입력 검증
- frontend/src/features/life/store.ts: 회원별 localStorage 저장
- frontend/src/features/onboarding/store.ts, frontend/src/features/loan/store.ts: 설문·대출 로컬 저장
- backend/src/main/java/com/zip/backend/settings/, bills/: 구현된 API
- db/schema.sql: 테이블 정의
- frontend/API.md: API 제안 포함 문서. 표에 있다고 구현된 API로 간주하면 안 됨

## 남은 작업 순서와 완료 기준

각 작업은 테스트 → DB → 프론트 → Git 공유 순서로 검증한다. 아래 항목은 아직 구현 완료가 아니다.

### 1. 생활정보 저장·조회 서버화 (다음 구현 작업)

- 기존 /api/me/settings를 활용하고, 계약·대출 정보를 다루는 저장/조회 경로를 추가한다. 전체 폼은 서버의 단일 트랜잭션으로 저장되도록 API 계약을 정한다.
- user_settings·housing_surveys·housing_loans·관리비 항목을 일관되게 갱신한다. 금액은 설문·가계부에서 원, settings.rent만 만원이다.
- housing_surveys.birth_date는 NOT NULL인데 생활정보 폼은 설문이 없으면 birth를 빈 문자열로 만든다. 가짜 생년월일을 넣지 말고, 설문 미완료 정책과 계약 정보 분리를 먼저 결정한다.
- 월세↔전세 전환, 관리비 포함↔별도, 대출 중지 시 관련 값을 동기화하고 과거 이자·납부 이력을 보존한다.
- GET 결과로 로컬 상태를 복원한다. 저장 성공 후 화면을 닫고, 실패하면 입력을 유지한다. 저장 중 중복 제출을 막는다.
- 계정 전환 중 늦은 응답이 다른 계정을 덮어쓰지 않도록 보호한다. 최초 이관 시 서버 값과 기존 로컬 값의 우선순위를 정하고 자동 덮어쓰기를 피한다.
- 완료: 월세·전세 각각 저장→SQL 조회→재로그인/별도 브라우저 복원. 잘못된 입력과 저장 중 오류에서 관련 테이블 모두 기존 값 유지. 다른 회원 조회·수정 차단.

### 2. 고정 지출·월세 월별 이력 연결

- 기존 bills API 연결, 월세 납부 API 추가, 카테고리·순서 서버 저장.
- 과거 지출 합계는 현재 월세·항목 금액 대신 해당 월의 스냅샷으로 계산한다.
- 관리비를 생활정보 폼과 고정 지출 화면에서 중복 생성하지 않도록 식별 정책을 정한다.
- 완료: 금액 변경·항목 해지 후에도 과거 금액 유지, 월별 체크 보존, 반복 요청에도 같은 월 중복 기록 없음.

### 3. 수입·지출 서버화

- 목록·등록·수정·삭제 API, 회원별 분류와 순서 저장.
- 완료: 월별 합계 일치, 수정·삭제 DB 반영, 별도 브라우저 복원, 회원 간 접근 차단.

### 4. 일정 서버화

- 일정·카테고리·사용자 항목 API 연결. 카테고리 삭제 시 미분류 이동.
- 반복 기념일의 달력과 이번 달 일정 수 집계 기준을 통일한다.
- 완료: 저장·수정·삭제·완료 및 반복 표시 검증, 재로그인 후 복원.

### 5. 동네 인증 서버화

- 별도 인증 API와 서버의 유효기간 판정을 구현한다. 수동 지역 변경과 실제 집 상세주소 변경을 구분한다.
- 완료: 인증 DB 반영, 만료·지역 변경 처리, 클라이언트의 인증 상태 임의 부여 거부.

### 6. 알림·지역 정보 연결

- 월세 알림 ID를 월별로 구분하고 고정된 '1시간 전' 표시를 수정한다.
- 알림 읽음·삭제를 서버 저장하고, 실제 지역별 쓰레기 배출 데이터를 연결한다.
- 완료: 다음 달 알림이 이전 삭제 상태에 가려지지 않음. 읽음·삭제 재로그인 유지. 지역별 실제 배출 정보 일치.
- 외부 푸시 발송은 별도 확장 작업으로 진행한다.

## 직접 검증하는 방법

### 테스트

프로젝트 루트의 PowerShell에서 실행:

```powershell
Push-Location frontend
node --test tests/life-info.test.mjs tests/housing-contract.test.mjs tests/amount-input.test.mjs tests/loan-interest.test.mjs
npm run build
npm run lint
Pop-Location
Push-Location backend
.\gradlew.bat test --tests com.zip.backend.SettingsIntegrationTests --tests com.zip.backend.BillIntegrationTests
Pop-Location
```

백엔드 test 프로필은 H2 메모리 DB를 사용한다. 통합 테스트 통과는 실제 MySQL 연결 검증을 대신하지 않는다. 결과는 backend/build/reports/tests/test/index.html에서도 볼 수 있다.

### DB

실제 연결 DB의 이름을 먼저 확인한다. 테스트 계정만 사용하고 원본 schema.sql을 기존 DB에 무조건 실행하지 않는다. 아래 조회는 현재 데이터 확인용이며, 프론트 미연결 상태에서는 화면 저장으로 값이 바뀌지 않는 것이 현재 동작이다.

검증용 회원 ID를 확인한 뒤 MySQL 클라이언트에서 실행:

```sql
SELECT DATABASE();
SET @life_user_id = NULL; -- 검증용 회원의 실제 ID로 바꾼다. NULL이면 결과가 나오지 않는다.
SELECT user_id, rent_amount, rent_day, move_in_ym, contract_end_ym, home_address, noti_on
FROM user_settings WHERE user_id = @life_user_id;
SELECT user_id, contract_kind, deposit, rent, management_included, management_fee,
       contract_fee, has_loan, loan_amount
FROM housing_surveys WHERE user_id = @life_user_id;
SELECT id, user_id, principal, annual_rate, payment_day, start_date, is_active
FROM housing_loans WHERE user_id = @life_user_id;
SELECT i.id, i.name, i.default_amount, i.is_active, p.period_ym, p.amount, p.paid_at
FROM bill_items i LEFT JOIN bill_payments p ON p.bill_item_id = i.id
WHERE i.user_id = @life_user_id ORDER BY i.id, p.period_ym;
SELECT period_ym, amount, paid_at FROM rent_payments
WHERE user_id = @life_user_id ORDER BY period_ym;
```

서버화 후 확인 예: 월세 550,000원은 user_settings.rent_amount=55, housing_surveys.rent=550000이어야 한다. 날짜 초기화는 DB NULL, GET 응답은 빈 문자열이다. 잘못된 종료월을 보내면 HTTP 400이며 저장 전후 조회 결과가 같아야 한다.

### 프론트

frontend에서 npm run dev 실행 후 http://127.0.0.1:3000/my/settings → 로그인 → 생활 정보.

1. 입주월 2026-11, 종료월 2026-10: 저장 차단·오류 표시·기존 데이터 유지.
2. 종료월 2026-11: 정상 저장. 날짜 두 칸 삭제 후 저장·재열기: 빈 값 유지.
3. 월세 납부일 0/32/1.5, 필수 금액 빈 값/상한 초과: 저장 차단.
4. 월세 3원 저장·재열기·재저장: 3원 유지.
5. 서버화 후 Network의 저장 요청 성공 → 위 SQL 조회 → 로그아웃·별도 브라우저 로그인으로 복원 확인.
6. 서버를 연결할 수 없는 경우 오류 표시, 입력 유지, 성공으로 표시하지 않음.

## 작업 하나 완료 후 Git 공유

현재 점검 시 브랜치는 backend이며 기존 생활정보 변경 파일이 아직 커밋되지 않았다. 새 작업은 프로젝트 루트에서 전용 브랜치를 만들고 관련 파일만 명시해서 스테이징한다. 아래 명령은 안내이며 자동 실행하지 않았다.

```powershell
git status --short
git switch -c codex/life-input-validation
git diff --check
git diff
git add frontend/src/features/life/components/MyInfo.tsx frontend/src/features/life/validateLifeInfo.ts frontend/tests/life-info.test.mjs frontend/tests/housing-contract.test.mjs LIFE_IMPLEMENTATION_STATUS.md
git diff --cached
git commit -m "fix: 생활정보 입력 검증과 날짜 초기화 보완"
git push -u origin codex/life-input-validation
```

그 다음 GitHub에서 프로젝트의 팀 기준 브랜치를 대상으로 PR을 만든다. 다음 작업은 별도 브랜치/커밋으로 나눈다. 비밀번호·토큰·실제 주소·application-local.properties를 올리지 않는다.

현재 입력 수정 공유 문구 예:

> 생활정보 입력 검증과 날짜 초기화를 수정하고 월세 원 단위 복원 오차를 방지했습니다. 프론트 관련 테스트 32개 통과. 현재 저장은 localStorage이며 DB 연동은 후속 작업입니다. 검증 방법과 후속 범위는 LIFE_IMPLEMENTATION_STATUS.md를 참고해 주세요.

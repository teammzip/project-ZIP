# 고정 지출: 구현할 작업과 검증할 작업

기준: 2026-11-17 현재 코드. 기능 코드는 변경하지 않고 구현·검증 가이드를 작성했다.
이번 범위는 전기·가스·통신·구독·관리비 같은 고정 지출이다. 월세 납부, 수입·기타 지출 API는 다음 작업으로 분리한다.

## 먼저 이해할 개념

| 개념 | 예시 | DB/API |
| --- | --- | --- |
| 항목의 기본 금액 | 전기요금은 보통 40,000원 | bill_items.default_amount / defaultAmount |
| 선택한 월의 금액 | 11월은 30,000원으로 기록됨 | bill_payments.amount / amount |
| 선택한 월의 납부 상태 | 11월 납부 완료 | bill_payments.paid_at / paid, paidAt |
| 기록 없는 달의 예정액 | 12월은 기본 금액을 따라 40,000원 예상 | snapshot=false. 조회만으로 DB 기록이 생기지는 않음 |
| 해지 | 다음 달부터 사용하지 않음 | bill_items.is_active=0. 기존 월별 금액·납부는 보존 |

### 30,000원 → 40,000원 → 35,000원 예시

1. 11월에 전기요금 30,000원을 등록한다. 기본 금액과 당월 미납 기록이 함께 생성된다.
2. 기본 금액을 40,000원으로 수정한다. 이미 기록된 11월 금액은 30,000원이다.
3. 기록 없는 12월을 조회하면 예정액 40,000원이 표시된다. 이때 snapshot=false다.
4. 11월 실제 청구액을 35,000원으로 정정한다. 11월만 35,000원이 되고 기본 금액 40,000원은 유지된다.
5. 11월에 해지한다. 현재 월 스냅샷은 남으므로 11월 목록에는 해지 항목이 보일 수 있다. 기록 없는 이후 달에는 나오지 않는다.

금액·납부 기록 보존과 이름·분류 보존은 다르다. 현재 API는 금액·납부 이력을 보존하지만 항목 이름·분류를 과거 월별로 별도 저장하지 않는다.

## 1. 구현해야 할 작업

### 프론트 (핵심 구현 영역)

| 작업 | 구현 내용 | 완료 기준 |
| --- | --- | --- |
| API 모듈 | features/life/billsApi.ts에 조회·등록·수정·납부·해지 함수와 응답 타입 작성 | 모든 금액은 원, 서버 ID는 문자열 유지 |
| 월별 조회 | 선택 월 변경 시 GET /bills?month=YYYY-MM. 로딩·빈 목록·오류·재시도 표시 | 월을 빠르게 바꿔도 이전 월 응답이 새 월을 덮어쓰지 않음 |
| 등록 | 이름·분류·금액 입력 → POST → 성공 후 목록 갱신 | 새 항목은 현재 월부터 생성됨을 안내. 과거 월을 보고 있었다면 현재 월로 이동하거나 생성 월을 안내 |
| 기본 금액 수정 | PATCH /bills/{id}. '앞으로의 기본 금액'이라고 구분 | 기존 당월 기록을 임의로 새 기본 금액으로 바꾸지 않음 |
| 월 금액 정정 | PUT /bills/{id}/payments/{month}에 amount 전달 | 선택 월의 amount만 변경 |
| 납부 체크 | 같은 payments API에 paid 전달 | 서버 성공 응답 또는 재조회로 상태 확정. 실패 시 기존 상태 유지 |
| 해지 | DELETE /bills/{id}, 안내 후 처리 | 과거 금액·납부 기록 유지. 해지 항목은 기본값 수정 불가 표시 |
| 월별 합계 | 선택 월 응답의 amount 합계, paid=true 항목의 amount 합계 구분 | 기본 금액 합계를 과거 월 합계로 쓰지 않음 |
| 관리비 통합 | homeApi.ts의 임시 로컬 ID -1 처리 정리, 서버 managementBillId와 동일 항목 사용 | 내 집 정보·고정 지출에서 관리비가 한 개이며 저장 후 관련 조회 갱신 |
| 상태·오류 | 저장 중 중복 요청 차단, 계정별 조회 키 분리, 로그인 만료·재시도 처리 | 실패를 성공으로 표시하지 않고 입력을 보존 |

현재 파일:

- frontend/src/features/life/components/FixedExpense.tsx: useLifeStore의 addBill/updateBill/toggleBill/removeBill 사용 부분이 전환 대상.
- frontend/src/features/life/types.ts: 기존 Bill은 숫자 ID·로컬 상태 타입이다. 서버 응답 타입은 별도로 정의하고 숫자 강제 변환을 피한다.
- frontend/src/features/life/homeApi.ts: 관리비를 로컬 ID -1로 넣는 임시 연결이 있다. 서버 목록 전환 후 이중 데이터 출처를 정리한다.
- frontend/src/features/life/components/HomeWidgets.tsx, derive.ts: 고정 지출 합계의 데이터 출처와 선택 월 기준을 확인한다.

서버 응답 타입 예:

```ts
export type ServerBill = {
  id: string
  name: string
  tag: string
  month: string
  amount: number
  defaultAmount: number
  paid: boolean
  paidAt: string | null
  active: boolean
  snapshot: boolean
}
```

### DB

bill_items·bill_payments는 이미 정의되어 있고 기존 API도 저장한다. 우선 새 테이블을 만들 필요는 없다.
실제 개발 DB에 최신 컬럼·제약이 적용됐는지 확인한다. 특히 (bill_item_id, period_ym) UNIQUE가 있어야 한다.
테스트 데이터는 검증용 회원에만 생성하고 실제 납부 데이터와 구분한다. 기존 schema.sql 전체를 기존 DB에 다시 적용하지 않는다.

### 백엔드

기존 BillController/BillService/BillRepository/BillInput을 활용한다. API를 중복 생성하지 않는다.
정책을 바꾸거나 부족한 응답이 확인된 경우에만 관련 테스트와 함께 수정한다.

| 기능 | 기존 API |
| --- | --- |
| 월별 목록 | GET /api/bills?month=2026-11 |
| 항목 등록 | POST /api/bills |
| 기본값 수정 | PATCH /api/bills/{id} |
| 월 금액·납부 정정 | PUT /api/bills/{id}/payments/{month} |
| 해지 | DELETE /api/bills/{id} |

## 2. API 예시 (가상 데이터)

id는 예시 문자열 "42"다. 실제 검증 시 등록 응답에서 받은 본인 항목 ID를 사용한다.

등록 POST /api/bills:
```json
{ "name": "검증용 전기요금", "tag": "공과금", "amount": 30000 }
```

기본 금액 수정 PATCH /api/bills/42:
```json
{ "amount": 40000 }
```

이후 11월 응답의 핵심 예:
```json
{
  "id": "42", "month": "2026-11", "amount": 30000,
  "defaultAmount": 40000, "paid": false, "paidAt": null,
  "active": true, "snapshot": true
}
```

11월 실제 금액 정정 및 납부 PUT /api/bills/42/payments/2026-11:
```json
{ "amount": 35000, "paid": true }
```

납부 취소 (금액 유지) PUT /api/bills/42/payments/2026-11:
```json
{ "paid": false }
```

기록 없는 과거 월은 paid만 보내면 거부된다. 당시 금액 amount를 함께 입력해야 한다.
미래 월은 조회할 수 있지만 납부 기록 저장은 거부된다.
로그인 토큰은 Postman/HTTP 도구의 비공개 환경값으로 설정하고 저장소에 넣지 않는다.

## 3. 검증해야 할 작업: 테스트 → DB → 프론트

### 테스트

프로젝트 루트 PowerShell:
```powershell
Push-Location backend
.\gradlew.bat test --tests com.zip.backend.BillIntegrationTests --tests com.zip.backend.HomeInfoTests
Pop-Location
Push-Location frontend
node --test tests/*.test.mjs
npm run build
npm run lint
Pop-Location
```

추가할 프론트 검증: API 함수의 경로·금액·문자열 ID, 조회 중 월/계정 전환, 저장 성공/실패,
중복 클릭, 관리비 중복 방지, 기본 금액과 선택 월 금액의 구분, 해지 항목의 표시.
기존 백엔드 테스트는 H2이므로 실제 MySQL 확인을 이어서 진행한다.

### 실제 DB

```sql
SELECT DATABASE();
SET @bill_user_id = NULL; -- 검증용 로그인 회원 ID로 변경
SELECT id,name,tag,default_amount,is_active
FROM bill_items WHERE user_id=@bill_user_id;
SELECT b.id,b.name,p.period_ym,p.amount,p.paid_at
FROM bill_items b JOIN bill_payments p ON p.bill_item_id=b.id
WHERE b.user_id=@bill_user_id ORDER BY b.id,p.period_ym;
SHOW INDEX FROM bill_payments;
```

| 검증 | 예상 결과 |
| --- | --- |
| 30,000원 등록 | 항목 기본 금액 30,000 + 당월 미납 기록 1개 |
| 기본 금액 40,000원 수정 | default_amount=40000, 기존 당월 amount=30000 |
| 당월 35,000원 정정 | 해당 월 amount=35000, 기본 금액은 40000 |
| 납부 체크·반복 체크 | paid_at 저장. 반복 요청으로 월별 행이 늘어나지 않음 |
| 납부 취소 | paid_at=NULL, amount는 유지 |
| 해지 | is_active=0, 기존 bill_payments 보존 |
| 기록 없는 과거 월을 금액 없이 저장 | 400, 데이터 변경 없음 |
| 미래 월에 납부 저장 | 400, 데이터 변경 없음 |
| 같은 이름·분류 중복 등록 | 활성 항목 중복 거부. 다른 회원 항목과는 구분 |
| 다른 회원 항목 ID 수정·납부·해지 | 거부되고 원래 회원 데이터 유지 |
| 로그아웃·만료 토큰 | 401, 데이터 변경 없음 |

### 프론트 직접 확인

실제 모드(VITE_USE_MOCK=false)에서 /my/budget/expense → 고정 지출.

1. 검증용 전기요금 30,000원 등록 → 새로고침·재로그인 후 유지.
2. 기본 금액을 40,000원으로 수정 → 11월 기록은 30,000원 유지, 기록 없는 다음 달 예정액은 40,000원.
3. 11월 금액 35,000원 정정 → 11월만 바뀌는지 확인.
4. 저장 중 중복 클릭·납부 체크 → 행 중복이 없는지 DB로 확인.
5. 서버를 끊고 저장 → 오류 표시, 입력·기존 납부 상태 유지.
6. 해지 → 기록 있는 월에는 해지 상태로 남고, 기록 없는 이후 월에는 제외.
7. 내 집 정보에서 관리비 수정 → 고정 지출의 같은 항목에 반영되고 중복되지 않음.
8. 월을 빠르게 바꾸기·다른 회원으로 로그인·별도 브라우저 접속 → 해당 월/회원의 데이터만 표시.

서버 정책을 확인한 가이드이며 이번 문서 작성에서는 기능 테스트나 화면 조작을 새로 실행하지 않았다.

## 4. 권장 구현 순서

1. API 타입·호출 모듈 + 월별 조회만 연결.
2. 등록·기본 금액 수정·해지 연결.
3. 월 금액 정정·납부 체크 연결.
4. 관리비 단일 데이터 출처·홈 합계 연결.
5. 테스트 → MySQL → 프론트 검증 후 한 작업으로 공유.

월세·대출 이자는 현재 화면에 함께 표시되지만 이번 고정 지출 API 연결과는 별도다.
전체 합계에서 각각을 중복 합산하지 않도록 고정 지출 부분만 먼저 전환한다.

## 5. Git 공유 (현재 브랜치 유지)

```powershell
git status --short
git diff --check
git diff
git add <이번_작업에서_수정한_파일_경로>
git diff --cached
git commit -m "feat: 고정 지출 및 월별 납부 서버 연결"
git push origin backend
```

위 git add의 꺾쇠 부분은 예시이므로 실제 파일 경로로 바꾼다. 다른 작업 파일을 함께 올리지 않는다.
PR에는 테스트 결과·DB 확인 SQL·과거 금액 보존·화면 재로그인 확인 결과를 적는다.

# 2026-11-01 주거 설문·전세 대출 이자

검토 기준: `3aed321` 및 `frontend/src/features/onboarding/store.ts`, `loan/interest.ts`, `loan/store.ts`. 아래는 DB 저장 계약이며 API 구현 완료를 의미하지 않습니다. 신규 표 3개를 더해 전체 44개 테이블·2개 VIEW입니다.

## housing_surveys — 회원당 최신 설문 한 건

| API/프론트 | DB 컬럼 | 의미 |
|---|---|---|
| userId | user_id | PK·users FK, 요청자가 아닌 인증 세션에서 결정 |
| birth | birth_date | DATE, 나이는 저장하지 않고 계산 |
| address | address | 응답 당시 간략한 주소 |
| kind | contract_kind | monthly/jeonse → MONTHLY/JEONSE |
| deposit, rent | deposit, rent | 월세 보증금·월세, 원 단위 BIGINT |
| mgmtIncluded, mgmtFee | management_included, management_fee | 관리비 포함 여부·별도 관리비 |
| contractFee | contract_fee | 프론트가 부르는 전세 계약금. 전세 보증금으로 임의 변경하지 않음 |
| hasLoan, loanAmount | has_loan, loan_amount | 대출 여부·응답 당시 대출 금액 |
| loanAnnualRate | loan_annual_rate | DECIMAL(5,2), 기존 응답에 없으면 NULL |
| loanPaymentDay, loanStartDate | loan_payment_day, loan_start_date | 기존 응답에 없으면 NULL |
| income, incomePeriod | income, income_period | 원 단위 금액, MONTHLY/ANNUAL |
| answeredAt | answered_at | 서버가 기록한 응답 시각 |

설문을 건너뛰면 행을 만들지 않습니다. firstLogin은 현재 API 계약대로 로그인 처리 전 last_login_at이 NULL인지 계산하는 응답값이며 영구 boolean 컬럼으로 중복 저장하지 않습니다. 설문 미완료 여부는 별도로 행 존재 여부로 판단합니다.

서버는 생년월일 유효성·미래 날짜·서비스 연령 조건, 정수 금액 상한, 계약 유형에 따른 비적용 필드 0/NULL 처리, 대출 입력 조합을 검사합니다. 프론트 검사를 통과했다고 신뢰하지 않습니다. 설문 금액은 실제 수입/지출 실적이 아니므로 incomes/expenses에 자동 복사하지 않습니다.

설문 저장과 users.address 갱신, 동네 인증 초기화, 월세 설정, 관리비 항목 반영, 대출 설정을 트랜잭션으로 묶습니다. 재시도 시 관리비를 중복 생성하지 않게 서버에서 기존 대상 항목을 식별해야 합니다. 현재 스키마에는 관리비 자동 생성의 멱등 키가 없으므로 사용자 행 잠금 등과 명시적인 대상 항목 선택이 필요합니다.

## housing_loans — 회원당 대출 설정 한 건

| 컬럼 | 의미 |
|---|---|
| id | UUID 문자열, 프론트 loanId |
| user_id | users FK·UNIQUE, 현재 UI의 회원당 대출 하나 |
| principal | 원금, BIGINT, 1~9,999,990,000원 |
| annual_rate | 연 이율 %, DECIMAL(5,2), 0~100 |
| payment_day | 매월 1~31일 |
| start_date | 자동 기록 시작일, 2000-01-01~2100-12-31 |
| is_active | 자동 기록 사용 여부, 0/1 |
| created_at, updated_at | 생성·수정 시각 |

중지는 DELETE가 아니라 is_active=0입니다. 재개 시 같은 ID를 사용합니다. 활성 상태의 조건 변경은 시작일을 유지하고, 중지 후 재개 시에는 새 시작일을 받는 현재 코드 동작을 따릅니다. 조건 변경/중지 전에 이미 지난 납부일을 이전 조건으로 확정합니다. 기존 설문에 금리·납부일이 없으면 대출을 임의 생성하거나 자동 활성화하지 않습니다.

## loan_interest_charges — 확정된 월별 예상 이자 기록

| 컬럼 | 의미 |
|---|---|
| loan_id | housing_loans FK, 소유자는 JOIN으로 조회 |
| charge_date | 한국 날짜 기준 발생일, 월말 보정 후 저장 |
| period_ym | charge_date에서 생성한 YYYYMM 정수, 직접 입력하지 않음 |
| principal, annual_rate | 발생 당시 원금·금리 스냅샷 |
| amount | ROUND(principal * annual_rate / 1200, 0), 원 |
| created_at | 실제 행 생성 시각 |

PRIMARY KEY(loan_id, charge_date)와 UNIQUE(loan_id, period_ym)로 같은 대출의 같은 달 중복을 막습니다. 날짜를 바꾸어 같은 월을 다시 넣어도 실패해야 합니다. 프론트 응답 id는 loanId + ':' + YYYY-MM으로 조합하고 userId는 대출 소유자에서 얻습니다. 설정 변경 후 과거 스냅샷은 갱신하지 않습니다. 삭제·초기화 요청에는 소유권 검사가 필요합니다.

서버 작업에서 대출 행을 잠그고 한국 날짜 기준 지나간 납부일만 생성합니다. 29~31일이 없는 달은 말일로 조정하고 시작일 전 날짜는 제외합니다. 원금 상환·일할 계산·실제 출금 기능이 아닙니다. 예정 이자는 계산값이며, 아직 발생하지 않은 월의 내역을 미리 INSERT하지 않습니다.

v_monthly_spend_breakdown에 실제 생성된 행만 '전세 대출 이자'로 합산합니다. 대출이 중지돼도 과거 기록은 집계합니다. bill_payments/expenses에 복사하면 이중 집계되므로 복사하지 않습니다.

## 기존 금액·지도·기념일과의 차이

- user_settings.rent_amount는 기존 만원 단위를 유지하되 DECIMAL(14,4)로 변경합니다. 예: 555,555원 → 55.5555만원. 기존 정수 값은 그대로 유지됩니다.
- bill_items.default_amount 및 bill_payments/rent_payments/incomes/expenses.amount를 BIGINT UNSIGNED로 확장합니다. API는 JS 안전 정수 및 화면별 상한을 검사해야 하며 큰 DB 값을 무조건 Number로 변환하면 안 됩니다.
- 지도·날씨는 현재 코드에서 등록 동네 주소 기반 좌표를 공유합니다. GPS는 동네 인증에 사용하며 집 좌표와 혼동하지 않습니다. users.region_verified_at을 주소 변경 시 비우고 로그인 회원·미래 시각·30일 만료를 검사합니다. 추가 GPS 이력 표는 만들지 않습니다.
- API 문서의 is_anniv/is_yearly와 달리 정식 DB 이름은 기존 is_anniversary/repeat_yearly를 유지합니다. anniv/yearly를 이 두 컬럼으로 매핑합니다.

## 개인정보와 검증 범위

생년월일·주거 계약·소득·대출 정보는 실제 값으로 seed를 작성하지 않습니다. 회원 삭제 시 세 표는 CASCADE되며 백업·로그의 보관 정책도 별도로 필요합니다. 기존 약관을 자동으로 덮어쓰지 않았습니다. 실제 수집 전 추가 항목·목적·보관기간을 처리방침과 필요한 동의에 반영해야 합니다.

정적 비교와 프론트의 기존 계산 테스트는 실제 MySQL DDL·CHECK·외래키·마이그레이션 실행 검증을 대신하지 않습니다. 테스트 DB에서 최대 원금, 금리 0/100, 월별 중복 거부, 설정 변경 후 스냅샷 보존, 중지 후 집계, 원 단위 월세 보존을 확인하세요.

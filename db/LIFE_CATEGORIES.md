# 생활 기능 변경 반영 (2026-11-07)

검토 기준: HEAD `1a41a75`, 직전 DB 검증 커밋 `276db85` 이후의 `2cf0890`, `1a41a75` 변경 전체. 프론트 파일은 수정하지 않았습니다.

## 저장 계약

| 변경 | DB 반영 |
|---|---|
| 회원별 실제 집 주소 | `user_settings.home_address VARCHAR(200) NULL`. `homeAddresses[userId]`를 인증된 회원의 한 행으로 변환. 가입 주소 `users.address`, 동네 `region_name`, 설문 주소와 구분 |
| 회원별 추가 카테고리·색·순서 | `user_settings.ledger_category_settings JSON NULL`. 현재 브라우저의 `byUser`/`orders`에서 해당 회원 부분만 변환 |
| 고정 지출 사용자 태그 | `bill_items.tag`를 ENUM에서 VARCHAR(24)로 확장, 기존 문자열 보존 |
| 24자 수입·지출 카테고리 | 기존 `ledger_categories.name` 20→24자, color 20→32자 확장 |
| 여러 달 납부 체크·해제 | 기존 `bill_payments`의 항목/월 UNIQUE와 nullable paid_at으로 지원. 새 테이블 불필요 |
| 고정 지출 수정·월 선택·차트·모달 | 기존 항목/월별 납부 테이블과 조회·계산으로 지원 |

설정 JSON 예:

```json
{
  "fixed-income": { "custom": [{ "name": "배당", "color": "#6485df" }], "order": ["배당", "월급"] },
  "other-income": { "custom": [], "order": [] },
  "spend": { "custom": [], "order": [] },
  "bill": { "custom": [], "order": ["구독", "공과금"] }
}
```

NULL/생략 scope는 기본 목록과 기본 순서입니다. order는 일부 이름만 담을 수 있고 나머지 기본·사용자 분류를 원래 순서로 뒤에 붙입니다. 기본 카테고리도 회원마다 순서가 달라 JSON에 저장합니다. 브라우저의 다른 회원 설정을 서버의 한 회원 행에 넣지 않습니다. 브라우저 데이터는 SQL 실행으로 자동 수집되지 않습니다.

`ledger_categories`는 기존 수입·지출 FK를 유지하는 공용 분류 사전입니다. 개인 카테고리 선택 목록은 **기본 목록 + 본인 설정 custom**으로 응답하며 공용 사전 전체를 노출하지 않습니다. 기록 저장 시 scope에 맞춰 INCOME/EXPENSE와 이름으로 사전을 찾거나 생성합니다. 같은 kind/name의 동시 생성은 UNIQUE 충돌 후 기존 ID를 다시 조회합니다. 개인 색·표시 순서는 공용 사전을 수정하지 않고 설정 JSON을 우선합니다. 고정/기타 수입 구분은 기존 `incomes.income_type`으로 저장합니다. 서로 다른 회원이나 scope에 같은 이름이 있어도 개인 설정은 독립적입니다.

## 백엔드 검증·예외

- 허용 scope 네 개만 수락. custom/order 배열 구조, 이름 문자열·공백 정리·24자 제한, scope 안 기본/사용자 이름의 대소문자 무시 중복, order 중복·알 수 없는 이름을 검사합니다. DB는 JSON 최상위 객체만 검사합니다.
- 색은 허용된 hex/프론트 테마 토큰 목록으로 제한합니다. CSS 문자열 전체를 신뢰하지 않습니다. 설정 변경은 부분 병합/버전 확인 또는 행 잠금으로 동시 덮어쓰기를 막습니다.
- 사전 ID만으로 기록을 허용하지 않고 본인 선택 목록·수입/지출 kind·FIXED/OTHER scope를 검증합니다. FK만으로 이 정책이 보장되지는 않습니다.
- 현재 프론트는 분류 추가·순서 변경만 구현합니다. 향후 이름 변경/삭제 API는 기록 참조 및 대체 분류 이동 규칙을 별도 정의해야 합니다.
- `paidMonths[월]=false`는 이전 paidMonth보다 우선합니다. 이관 시 같은 항목/월을 한 행으로 합치고 false이면 paid_at=NULL로 저장합니다. true의 실제 납부 시각을 모르면 서버가 정한 기록 시각을 쓰고 실제 결제 시각이라고 표시하지 않습니다.
- 월별 amount는 납부 기록의 스냅샷입니다. 항목 default_amount 수정이 과거 납부액을 덮어쓰지 않아야 합니다. 현재 프론트의 과거 월 합계는 현재 항목 금액을 사용하므로 서버 연동 시 월별 스냅샷과 표시 기준을 합의해야 합니다. 월세도 rent_payments.amount를 동일하게 처리합니다.
- 관리비 포함 월세이면 별도 관리비를 중복 합산하지 않습니다. 설문 관리비와 고정 지출을 함께 바꾸는 API는 트랜잭션으로 처리합니다. 포함 전환만으로 과거 납부 행을 삭제하지 않습니다.
- 집 주소는 200자, 본인 행만 수정. 주소 변경 시 집 좌표 재계산/초기화 정책을 적용하고 동네 인증 GPS와 혼용하지 않습니다. 현재 프론트는 이 주소와 동네를 별도 보관하므로 단순 집 주소 수정이 동네를 자동 변경하지 않습니다.

## 기존 zip_test 적용

1. 백업 후 `SHOW COLUMNS FROM user_settings`로 home_address/ledger_category_settings가 아직 없는지 확인합니다. 이미 있으면 재실행하지 않습니다.
2. `migrations/20261107_life_categories.sql`을 열어 **USE `zip`; 한 줄만 USE `zip_test`;로 바꾸어** 한 번 실행합니다. 기존 20261102까지 적용된 DB 대상입니다. DDL은 암묵 커밋됩니다.
3. `tests/24_life_categories_positive.sql` 전체 실행: X01~X05 PASS. ROLLBACK으로 가상 데이터 정리.
4. `tests/25_life_categories_negative.sql`: 같은 연결에서 Y00 준비, Y01만 실행 → 3819/ck_settings_ledger_object 예상, Y99 실행 → PASS.
5. `tests/15_schema_audit.sql` 실행: M01~M07 PASS, 44테이블·358컬럼·71키·62FK·15CHECK·2VIEW, 추가 객체/컬럼 없음이 기준입니다.

새 DB는 최신 schema.sql만 실행합니다. 이 문서의 수정은 파일 설계 변경이며 기존 실행 중인 MySQL에 자동 반영하지 않습니다. 이전 결과 기록은 당시 356컬럼 기준의 이력으로 유지합니다.

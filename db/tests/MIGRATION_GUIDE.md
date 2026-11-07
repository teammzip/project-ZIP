# 이전 35개 테이블에서 최신 44개 테이블로 이전 검증

이전 62995d3 커밋의 스키마를 별도 DB zip_migration_test에 재현하고 가상 데이터에 실제 마이그레이션을 적용합니다. 현재 zip 및 zip_test는 변경하지 않습니다. 격리 MySQL 9.6.0에서 이전·보존·구조 감사가 통과했습니다(VALIDATION_20261107.json). 새 환경의 결과는 별도로 확인합니다.

## 1. 전용 DB가 비어 있는지 먼저 확인

로컬 테스트 서버에 새 Workbench 연결을 열고 실행합니다.

```sql
SELECT VERSION();
SELECT COUNT(*) AS existing_objects
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='zip_migration_test';
```

existing_objects가 **0일 때만** 다음 단계로 갑니다. 이 이름의 DB가 이전 작업에 사용됐다면 기존 자료를 지우거나 재사용하지 말고 상태를 확인하세요. 재실행이 필요하면 미사용 테스트 DB 이름을 정하고 18~20번 파일의 실행 대상 DB 이름을 모두 일치시켜 별도 사본으로 실행합니다. 현재 zip_test에 18/19번을 적용하면 안 됩니다.

## 2. 이전 DB 생성

18_legacy_schema.sql 전체를 실행합니다. 옛 스키마 snapshot이므로 Git 이력의 35개 테이블을 재현합니다. 원본 대비 실행 DB명만 테스트용으로 바꿨습니다. 테이블·FK·약관 초기 데이터도 당시 버전을 사용합니다.

```sql
USE zip_migration_test;
SELECT TABLE_TYPE,COUNT(*) AS object_count
FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_TYPE;
SELECT COUNT(*) AS user_count FROM users;
```

예상값은 BASE TABLE=35, VIEW=2, user_count=0입니다. 오류가 있거나 다르면 다음 단계로 진행하지 않습니다.

## 3. 가상 데이터 생성·최신 버전 적용

19_migration_upgrade.sql을 전체 실행합니다. 이 파일 안의 fixture와 검증 변수는 같은 연결에서 연속 실행돼야 합니다. 복사본은 다음 순서이며 별도 원본 마이그레이션을 추가 실행하지 않습니다.

1. 기존 스키마용 가상 회원·일정·할 일·가계부·납부·제재 생성 후 COMMIT
2. 20261031_current_project.sql
3. 20261031_02_event_anniversaries.sql
4. 20261101_housing_and_loan.sql
5. 20261102_requirements_hardening.sql
6. U01~U13 보존 확인·safe update 모드 복원
7. 20261107_life_categories.sql (19번 파일에 포함)

`20261101_event_anniversary.sql`은 이름이 다른 중복 경로라 포함하지 않습니다. 테스트 사본은 원본 다섯 마이그레이션에서 USE만 zip_migration_test로 변경한 것입니다. 원본을 수정하면 이 테스트 사본도 함께 갱신해야 합니다.

마이그레이션의 전체 수입 분류 UPDATE 때문에 이 연결에서만 sql_safe_updates를 잠시 0으로 설정하고 마지막에 원래 값으로 복원합니다. Workbench 환경설정은 변경하지 않습니다. 오류로 중단됐다면 같은 연결에서 다음을 실행해 설정을 복원하고 첫 오류와 실제 스키마 상태를 확인하세요.

```sql
SET SESSION sql_safe_updates=@mig_old_safe_updates;
```

이 파일은 단순 INSERT/ROLLBACK 테스트가 아닙니다. DDL은 암묵 커밋되므로 ROLLBACK으로 전체 이전을 취소할 수 없으며 파일을 무조건 재실행하면 안 됩니다. 테스트 DB는 결과 확인용으로 그대로 남깁니다. 중간 U00이 FAIL이거나 실행 오류가 있으면 후속 PASS만으로 전체 통과를 판단하지 않습니다.

## 4. 예상 결과

U00~U13 모두 PASS여야 합니다.

| ID | 검증 내용 |
|---|---|
| U00 | 이전 가상 데이터 준비: 수입 3,300,000원·지출 608,000원 |
| U01 | 현행 44개+할 일 보관 1개=45개 표, todos 이름 제거 |
| U02 | 기존 일정의 ID·제목·날짜·시간 보존 |
| U03~U04 | 할 일 2개 원본 보관, 새 일정 ID=이전 events 최대 ID+todos.id, 완료 상태·시각 보존 |
| U05~U06 | 수입 종류 분류와 수입·지출 합계 보존 |
| U07~U08 | 만원 단위 월세 설정, 기본 금액과 실제 납부액·납부 시각 보존 |
| U09 | 기존 회원에 카테고리 6개·기본 항목 30개 생성 |
| U10 | 기존 일정에 기념일을 임의로 추정하지 않음 |
| U11 | 새 설문·대출·이자 기록을 임의 생성하지 않음 |
| U12 | 기존 제재 보존, 차단 해시는 별도 이관 필요 |
| U13 | 기존 금액 5개 BIGINT, 월세 설정 DECIMAL로 변경 |

U12의 PASS는 차단 해시가 아직 생성되지 않았다는 마이그레이션의 범위를 확인합니다. 서버 HMAC 키를 쓰는 별도 이관이 필요하고 그 전에는 실제 정지 회원의 탈퇴·재가입 차단 완료로 간주하면 안 됩니다. 이번 가상 테스트는 운영 비밀키를 생성하거나 사용하지 않습니다.

## 5. 최종 구조 대조

20_migration_schema_audit.sql을 전체 실행합니다. 기존 15번 감사 SQL의 실행 DB명만 변경한 것입니다. M01~M07은 각각 PASS가 예상됩니다. 추가 객체는 **todos_legacy_20261031 하나**, 추가 컬럼은 없음이 정상입니다. 감사는 원본 44개 테이블 기준이므로 보관 표가 있어도 M01은 44개 대상을 확인합니다.

```text
MySQL 버전:
18번 실행 후: BASE TABLE / VIEW / user_count
U00~U13: 각 PASS / FAIL / 미실행
마지막 restored_safe_update_mode:
마이그레이션 DB의 M01~M07: result / checked_count / failed_count
추가 객체: todos_legacy_20261031만 있는지
추가 컬럼:
최초 오류:
```

## 검증의 한계

이번 fixture는 선택한 데이터 보존과 마이그레이션 실행·최종 구조를 검증합니다. 전체 테이블의 모든 데이터 모양, 운영 크기의 잠금·속도, 동시 쓰기, 실제 백업 복원은 검증하지 않습니다. 운영 적용 전 별도 백업/복구 리허설과 개인정보 보관·삭제 절차가 필요합니다. 결과 확인 전 '마이그레이션 통과'로 기록하지 않습니다.

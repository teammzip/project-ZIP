# DB 검사

DB 를 바꿨으면 저장소 최상위에서 자동 검사를 돌려요. 결과는 루트 [CHANGELOG.md](../../CHANGELOG.md#db) DB 항목에 한 줄로 남겨요.

```powershell
node --test --test-reporter=spec db/tests/schema-assets.test.cjs   # 빠른 정적 검사: 마이그레이션 빠짐 · 새 DB 와 업그레이드 DB 구조 차이
node db/tests/generate-schema-audit.cjs                            # schema.sql 을 바꾼 뒤 비교 자료(schema_expected.json · 15/20번) 갱신
node db/tests/run-isolated-mysql.cjs                               # 격리 MySQL 9.6 에서 아래 SQL 전부 + 새 설치 · 업그레이드 · 데이터 보존
```

격리 검사는 지금 켜진 MySQL 에 접속하지 않아요(`db/private` 에 임시 DB 를 만들고 끝나면 끔). 마이그레이션을 새로 만들 때 할 일은 [마이그레이션 안내](../migrations/README.md#마이그레이션을-새로-만들-때)에 있어요.

## Testcontainers 통합 검사

[백엔드 실행 명령](../../backend/README.md#테스트)과 [PR 검사](../../.github/workflows/test.yml)는 `mysqlTest`를 실행합니다. Testcontainers가 `mysql:8.0.46` 컨테이너를 만들고, 시나리오별 DB를 분리합니다. [통합 테스트](../../backend/src/test/java/com/zip/backend/tools/MySqlIntegrationTests.java)의 확인 범위입니다.

- 빈 DB의 Flyway `V1`~`V4` 이력과 전국 참조 데이터, 재실행 시 같은 이력과 데이터 유지
- 기준 버전 SQL로 구성한 기존 DB의 `V4` 등록, 회원·폴더·메모 보존, 후속 버전만 적용
- 참조 데이터가 빠진 DB에서 기준 등록과 자동 마이그레이션 거절, 이력 미생성
- 실제 API에서 메모 폴더 CRUD, 회원 간 접근 분리, 중복 이름 거절, 폴더 삭제 후 메모 보존과 분류 해제

[아래 SQL 검사](#sql-파일)는 `run-isolated-mysql.cjs`에서 실행합니다.

## SQL 파일

자동 검사가 아래 파일을 모두 실행해요. 테스트 번호 · 검사 내용 · 기대하는 오류 번호는 각 SQL 파일 안에 적혀 있어요.

| 파일 | 범위 |
|---|---|
| 01 · 02 | 주거 설문 · 전세 대출 · 월별 이자 |
| 03 · 04 | 회원 · 인증 · 약관 |
| 05 · 06 | 일정 · 카테고리 · 메모 · 알림 |
| 07 · 08 | 가계부 · 지출 VIEW |
| 09 · 10 | 커뮤니티 · 첨부 |
| 11 · 12 | 신고 · 제재 · 고객센터 |
| 13 · 14 | 동네 · 지도 · AI |
| 15 · 16 | 전체 구조 대조 · 금액 타입 복구 |
| 17 | 보완 제약 |
| 18 · 19 · 20 | 옛 35개 표 DB → 최신으로 이전 |
| 21 · 22 · 23 | 20261102 요구사항 단계 |
| 24 · 25 | 개인 분류 · 집 주소 |

`*_positive` 는 정상 저장 검사, `*_negative` 는 잘못된 값이 막히는지 검사예요.

Workbench 에서 직접 돌려 보고 싶다면 이렇게 해요.
- `zip_test` 같은 **테스트용 DB** 에서만 실행해요. 실제 데이터가 있는 DB 에서는 실행하지 않아요.
- `positive` 파일은 전체 실행해요. 끝에서 자동으로 ROLLBACK 돼요.
- `negative` 파일은 `00` 준비 블록을 먼저 실행하고, 그다음 문장을 하나씩 실행하면서 주석의 오류 번호와 비교해요.

# 데이터베이스와 검증

2026-11-24 확인 · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

| 상황 | 확인할 자료 |
| --- | --- |
| 신규 DB 생성 | [schema.sql](../../db/schema.sql)을 적용한 뒤 자료용 마이그레이션 세 개(`20261122_01_regions_nationwide`·`20261122_02_trash_schedules_nationwide`·`20261122_04_region_neighbors_nationwide`)를 실행합니다. [신규 DB 절차](../../db/migrations/README.md) |
| 기존 DB 갱신 | [마이그레이션 안내](../../db/migrations/README.md)의 순서와 사전 조건에 따라 대상 DB의 이미 적용된 컬럼·키를 확인하고, 백업 후 미적용 파일을 실행합니다. MySQL DDL이 중간에 실패하면 적용된 범위를 먼저 확인합니다. |
| 백엔드 자동 테스트 | [백엔드 안내](../../backend/README.md)의 기본 Gradle 테스트는 MySQL 호환 모드의 H2를 사용합니다. |
| MySQL 검증 | 실제 MySQL의 스키마·데이터 검증 방법은 [DB 검증 안내](../../db/tests/README.md)를 참고합니다. 고정 지출 검증 작업은 [백엔드 안내](../../backend/README.md)에 있습니다. |

## 전국 데이터

전국 배출표와 이웃 지역 데이터는 별도 데이터 마이그레이션으로 들어갑니다. 로컬 DB에 어떤 데이터가 있는지는 적용 이력으로 확인합니다. [DB 안내](../../db/README.md) · [배출표 조회](trash-schedules.md) · [앱 실행 모드](application.md)

[배출표 마이그레이션](../../db/migrations/20261122_02_trash_schedules_nationwide.sql)과 [이웃 지역 마이그레이션](../../db/migrations/20261122_04_region_neighbors_nationwide.sql)은 각각 기존 배출표·이웃 목록을 교체합니다. 문서 기준 자료는 지역 249건, 배출표 6,218건, 방향별 이웃 관계 1,286건입니다. 개별 배포 환경의 적용 여부는 별도 확인이 필요합니다. [전국 자료 적용 결과](../../db/README.md#전국-지역--쓰레기-배출표--주변-동네) · [변경 기록](../../CHANGELOG.md#db)

## 마이그레이션 정합성 점검

로그인 잠금 마이그레이션 `20261121_04_login_lockout.sql`을 검사 목록에 추가하고, 신규 스키마와 업그레이드 결과를 비교하는 자료를 재생성했습니다. SQL 파일명 전체로 적용 순서를 확인합니다. 같은 날짜·번호가 붙은 게시글 인덱스 파일도 검사 목록에 있습니다. 메모 폴더의 적용 파일은 `20261122_07_memo_folders.sql`입니다. [정합성 수정 커밋](https://github.com/teammzip/project-ZIP/commit/4f0db63) · [적용 순서](../../db/tests/migration-path.cjs) · [스키마 비교 자료](../../db/tests/schema_expected.json) · [검사 및 재생성 절차](../../db/tests/README.md)

## 기념일 마이그레이션

11월 24일 변경으로 기존 DB의 기념일 컬럼 정리가 `20261031_02_event_anniversaries.sql`에 통합됐습니다. 구형 `20261101_event_anniversary.sql`은 폐기됐습니다. 최신 `schema.sql`로 만든 신규 DB에는 정식 컬럼이 이미 있습니다. [변경 기록](../../CHANGELOG.md#db) · [마이그레이션 안내](../../db/migrations/README.md#구형-기념일-컬럼-정리)

통합 SQL은 구형 컬럼(`is_anniv`, `is_yearly`)만 있으면 값을 보존하며 `is_anniversary`, `repeat_yearly`로 이름을 바꿉니다. 두 쌍이 모두 있으면 모든 행의 값이 일치할 때만 구형 컬럼을 제거합니다. 값이 다르거나 컬럼 쌍이 불완전하면 사전 검사에서 중단됩니다. 신규 설치·구형 DB 전환·재실행 검증 결과는 변경 기록에 남아 있습니다. [통합 SQL](../../db/migrations/20261031_02_event_anniversaries.sql) · [격리 검증 코드](../../db/tests/run-isolated-mysql.cjs)

## DB 검증 결과

`250b8d9`에서 DB 정적 검사 7개와 격리 MySQL 9.6의 72단계·265개 검사를 통과했습니다. 신규 설치, 전체·증분 업그레이드, 기존 데이터와 구조 비교를 확인했습니다. 기념일은 구형 값 보존, 잘못된 값·상충 값 차단, 값이 일치할 때 구형 컬럼 제거와 재실행을 확인했습니다. 팀 배포 DB의 데이터와 적용 상태는 [검증해야 될 부분](project-status.md#검증해야-될-부분)에 기록했습니다. [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완)

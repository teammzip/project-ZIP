# 위키 작업 로그

[위키 색인](index.md)

## [2026-11-24] ingest | ZIP 위키 초기 구축

- [수집 기준과 원자료](raw/index.md)를 등록하고 [앱 실행](topics/application.md), [DB](topics/database.md), [배출표](topics/trash-schedules.md)를 정리했습니다.
- 배출표의 문서 상태와 코드에서 확인한 동작이 다른 지점을 [배출표 페이지](topics/trash-schedules.md)에 기록했습니다.

## [2026-11-24] ingest | 프론트 API 계약 변경 반영

- [API 계약 변경의 비교 기준과 코드 근거](raw/index.md#2026-11-24--api-계약-변경-반영)를 등록했습니다.
- OAuth 콜백의 토큰 전달 방식, ‘내가 쓴 글’ 집계, 서버 모드의 브라우저 저장 기준을 [앱 구조와 실행 모드](topics/application.md)에 반영했습니다.
- [내 집 정보와 대출](topics/home-info.md)에 저장 API 세 가지와 공통 조회 캐시를 정리했습니다.

## [2026-11-24] ingest | 변경 기록 반영

- [백엔드·DB·프론트엔드 변경 기록의 11월 24일 항목](raw/index.md#2026-11-24--변경-기록-수집)을 현재 코드와 대조했습니다. 게시글 수, 홈 정보 조회, OAuth 및 모의 API는 기존 주제에 연결했습니다.
- [가계부 메모 이어쓰기와 확정](topics/ledger-memos.md), [카카오 장소 ID](topics/map-place-ids.md), [기념일 마이그레이션](topics/database.md#기념일-마이그레이션)을 반영했습니다.
- 수집 당시 변경 기록의 검증 보고를 바탕으로 구현과 검증 코드를 확인했습니다. [당시 변경 기록](raw/index.md#2026-11-24--변경-기록-수집) · [검증 결과](topics/project-status.md#검증된-부분)

## [2026-11-24] ingest | 이전 작업과 최신 검증 이력 보완

- [원자료](raw/index.md#2026-11-24--작업과-검증-이력-보완)에 GitHub `dev` `250b8d9`와 `backend` `b0a937d`의 동일 트리, PR별 이력과 실행 환경을 등록했습니다.
- [계약 고정 지출·월세 알림](topics/fixed-expenses.md), [외부 서비스·AI](topics/service-integrations.md), [구현·검증 현황](topics/project-status.md)을 추가했습니다. 기존 주제에 토큰 재발급, 폴더 문제가 확인된 조건, DB 검사 정합성, 배출 알림, 리뷰 사진을 보완했습니다.

## [2026-11-24] lint | 위키 연결과 출처 점검

- 상대 링크와 제목 앵커, 주제별 색인 등록·복귀 링크, Git 출처 커밋을 점검했습니다. 현황 페이지에 색인 복귀 링크를 추가한 뒤 전체 점검을 통과했습니다.
- 루트 README의 배출표 문구와 현재 화면 동작의 차이, 메모 폴더 재현 결과, 배포 환경에서 남은 확인 범위를 주제 문서에 기록했습니다.

## [2026-11-24] ingest | 전체 PR 원자료와 현행 기능 보완

- [전체 PR 원자료](raw/pull-requests.md)에 PR #1~#137 및 직접 병합 메시지가 없는 `dev` 커밋을 연결했습니다. `dev` 직접 병합 130건의 변경 파일 목록과 나머지 PR 7건의 병합 상태·이력을 대조했습니다.
- [일정·기념일과 알림](topics/calendar-notifications.md)과 [커뮤니티·고객센터·관리자 운영](topics/community-operations.md)을 추가했습니다. 로그인 잠금과 계정 전환, 회원별 가계부 분류, 고정 지출 해지, 지도 저장 리스트, AI 주제 분기와 DB 적용 조건을 기존 주제에 보완했습니다.
- HTML 시안·폐기된 인증 경로·이전 알림 시각·중복 브랜치 병합은 전체 PR 원자료에서 추적할 수 있습니다. 기능별 실행 검증 이력은 [구현·검증 현황](topics/project-status.md#검증된-부분)에 두었습니다.

## [2026-11-24] lint | 전체 PR 원자료와 주제 링크 확인

- PR 번호 #1~#137과 원문·변경 파일 링크의 번호가 일치하는지 확인했습니다. 원자료가 가리키는 고유 Git 커밋 141개가 로컬 이력에 존재하고, 전체 주제가 색인에 등록됐으며 상대 링크와 제목 앵커가 연결됨을 확인했습니다.

## [2026-11-24] record | PR 문서 동기화

- [PR 문서 동기화](AGENTS.md#pr-문서-동기화)에서 코드 변경과 관련 위키 문서를 대조하는 검사와 같은 저장소의 PR에 문서 수정 커밋을 추가하는 흐름을 정리했습니다.
- 임시 Git 저장소와 모의 API 응답으로 문서 누락 감지, 자동 커밋 요청, 동시 변경 보호, 포크와 시크릿 미등록 시 검사 경로를 확인했습니다. 실제 GitHub 실행은 워크플로 병합과 시크릿 등록 후 확인이 필요합니다.

## [2026-11-24] record | PR 문서 동기화 데이터 전송 점검

- [PR 문서 동기화](AGENTS.md#pr-문서-동기화)에 OpenAI 전송 전 민감정보 검사와 자동 커밋 전 문서 검사가 없는 점을 기록했습니다. 작업 트리 변경 파일의 일반적인 자격증명 형식과 로컬 비밀 파일의 Git 제외 여부를 확인했습니다.

## [2026-11-24] record | 민감정보 전송·업로드 방지

- [PR 문서 동기화](AGENTS.md#pr-문서-동기화)에서 외부 모델 전송과 봇 커밋을 제거했습니다. PR 검사는 GitHub 실행 환경에서 관련 문서 누락과 커밋 이력의 민감정보 패턴을 검사합니다.
- [민감정보 검사](AGENTS.md#민감정보-검사)를 커밋·푸시 단계에 적용했습니다. 임시 Git 저장소에서 가짜 토큰, 로컬 전용 파일, 이후 커밋에서 삭제된 토큰이 차단되는 것을 확인했습니다. 로컬 검증 보고서 두 건은 Git 제외에 추가했습니다.

## [2026-11-24] lint | 중복 설명을 기준 문서로 연결

- 루트 [기존 문서 갱신 규칙](../AGENTS.md#기존-문서-갱신)을 추가하고, 근거 확인·작업 기록·민감정보 처리 안내는 [위키 운영 규칙](AGENTS.md)에 모았습니다.
- [본인 게시글 수](topics/community-operations.md#본인-게시글-수), [월세 알림](topics/fixed-expenses.md#월세-알림), [배출일 알림](topics/trash-schedules.md#배출일-알림)처럼 반복된 설명은 담당 페이지로 연결했습니다.

## [2026-11-24] record | API DTO 도입 범위 검토

- [API 데이터 계약과 DTO](topics/application.md#api-데이터-계약과-dto)에 기존 요청 `record`, DTO 도입 후보, 현행 OpenAPI 경로 누락, 가계부 목록의 행별 조회를 기록했습니다. `51cfc1a`에서 코드를 정적으로 확인했습니다.

## [2026-11-24] record | 가계부 목록의 연결 정보 일괄 조회

- 연결 메모와 자동 등록 월급 여부를 목록 쿼리에서 함께 조회하도록 변경하고, 메모 연결 조건과 응답 필드를 [가계부와 메모](topics/ledger-memos.md#가계부-기록과-회원별-분류)에 기록했습니다.
- H2 MySQL 호환 모드에서 가계부·월급·메모 통합 테스트 24개가 통과했습니다. [가계부 회귀 테스트](../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)
- 격리 MySQL 9.6.0의 새 스키마에서 수입·기타 지출 목록 SQL을 실행해 월급 여부, 회원·기록 종류별 메모 연결, 문자열 키 비교와 정렬을 확인했습니다.

## [2026-11-24] record | 운영 가계부 응답 시간 확인 범위

- 운영 URL과 인증 세션이 확인되지 않아 응답 시간을 측정하지 못했습니다. 원격 `dev`·`backend`에서 기존 가계부 목록 코드를 확인하고, 운영 확인 조건을 [구현·검증 현황](topics/project-status.md#검증해야-될-부분)에 기록했습니다.

## [2026-11-24] record | 가계부 저장 서비스 분리 검토

- 서비스 분리 시 확인할 회원 잠금·메모 롤백·월급 연동을 검토했습니다. 적용한 구조는 [가계부 저장 트랜잭션](topics/ledger-memos.md#가계부-저장-트랜잭션)에 기록했습니다.

## [2026-11-24] record | 가계부 저장과 분류를 서비스로 분리

- 가계부와 분류 컨트롤러가 API 요청을 서비스에 위임하도록 변경했습니다. 서비스의 트랜잭션 범위, 분류 조회 위치, 재실행 명령을 [가계부 저장 트랜잭션](topics/ledger-memos.md#가계부-저장-트랜잭션)에 기록했습니다.
- 수정·월급 연결 롤백과 동시 지출·첫 월급·신규 분류 저장을 추가했습니다. 해당 통합 테스트를 포함한 백엔드 전체 테스트 326개가 통과했습니다. 격리 MySQL 9.6에서 신규 분류의 동시 삽입 뒤 잠금 조회도 확인했습니다. [가계부 통합 테스트](../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

## [2026-11-24] record | 가계부 임시 메모 연결과 폐기 확인

- 메모 화면에서 확정한 초안이 수입·기타 지출 저장 시 연결되는 경로와 저장 실패·초안 폐기의 적용 범위를 [가계부와 메모](topics/ledger-memos.md)에 보완했습니다. 구현 코드와 앞서 통과한 가계부 통합 테스트 결과를 대조했습니다.

## [2026-11-24] record | 생활 API 계약과 프론트 요청 타입 동기화

- 가계부·월별 고정 지출·내 집 정보와 연결된 API를 현행 컨트롤러 기준으로 OpenAPI와 프론트 요청에 반영했습니다. 첫 주거 설문에서 대출 정보가 없으면 서버가 받는 형식에 맞춰 `home.loan`을 생략합니다. [API 데이터 계약과 DTO](topics/application.md#api-데이터-계약과-dto) · [설문 요청 회귀 테스트](../frontend/tests/onboarding-home-save.test.mjs)
- YAML 파싱과 내부 참조, 관련 경로·메서드 조합 28개의 응답 코드를 확인했습니다. 프론트 빌드와 테스트 193개, 관련 백엔드 테스트 84개가 통과했습니다.

## [2026-11-24] record | 변경 기록과 위키 작성 기준 정리

- 같은 설명을 반복해서 관리하는 일을 줄이기 위해 [변경 기록 작성 기준](../CHANGELOG.md#작성-기준)을 갱신하고 [프로젝트 작업 규칙](../AGENTS.md#기존-문서-갱신)에서 연결했습니다.
- 월세 자동 등록의 이전 항목에 [현재 적용되는 조건](topics/fixed-expenses.md)을 연결했습니다. [구현·검증 현황](topics/project-status.md)에는 11월 24일 변경 기록의 `backend` 반영 사실을 갱신했습니다.

## [2026-11-24] record | 생활 API PR의 문서 동기화 검사 보완

- [PR #139](https://github.com/teammzip/project-ZIP/pull/139)의 `2361c48`을 `dev` `1ed7ef8`과 비교해 문서 동기화 검사 종료 코드 1을 재현했습니다. 검사가 [프론트 API 문서](../frontend/API.md)의 변경을 파일 단위로 판단한 범위를 [PR 문서 동기화 안내](AGENTS.md#pr-문서-동기화)에 기록했습니다.
- 검사에 표시된 [알림](topics/calendar-notifications.md#알림-생성과-읽음-상태), [게시글 수](topics/community-operations.md#본인-게시글-수), [장소 리뷰](topics/map-place-ids.md), [배출표](topics/trash-schedules.md)의 현행 API 계약과 근거를 보완했습니다.

## [2026-11-24] record | 배출표 주소 다시 찾기 · 출처 표시

- [배출표](topics/trash-schedules.md): 내 집 주소로 시·군·구를 못 찾으면 회원 주소로 다시 찾도록 배출일 알림(`TrashReminderService`)과 배출표 조회(`CalendarService.myTrashSchedule`)를 같은 규칙(`RegionMatcher.matchFirst`)으로 바꿨습니다. 이전에는 내 집 주소가 있으면 그것만 봐서, 직접 입력한 주소에 시·군·구가 빠지면 알림도 화면도 동네를 찾지 못했습니다.
- 배출표 표 아래에 공공데이터 출처를 표시했습니다.
- 검증: `RegionMatcherTests` · `TrashReminderTests` · `CalendarIntegrationTests`에 주소 다시 찾기 테스트 추가.

## [2026-11-24] record | 메모 폴더 문제 2건 수정

- [확인된 폴더 문제](topics/ledger-memos.md#확인된-폴더-문제): 폴더 목록이 화면 복귀 때 다시 조회되도록 하고, 가계부 초안이 폴더 100개 제한을 넘겨 분류 폴더를 만들지 않도록 고쳤습니다(이미 100개면 미분류 초안). [구현해야 될 부분](topics/project-status.md#구현해야-될-부분)에서 해당 항목을 지웠습니다.
- 검증: 백엔드 `LedgerIntegrationTests` · `MemoIntegrationTests` 통과(새 테스트 1개).

## [2026-11-24] record | 동네 목록 API · 모의 모드 전국 이웃

- 서버에 `GET /api/regions`(동네 목록) · `GET /api/regions/{id}/neighbors`(주변 동네)를 `openapi.yaml` · `frontend/API.md` 계약대로 만들었고 로그인 없이 열립니다. [앱 구조](topics/application.md)
- 모의 모드의 주변 동네가 서울 4개 구 예시에서 전국 목록으로 바뀌었습니다. 이웃 변환 스크립트가 DB 이웃 데이터와 같은 내용으로 프론트 목록을 만듭니다. [커뮤니티](topics/community-operations.md) · [데이터베이스](topics/database.md)
- `regions.ts` · DB 지역 · 이웃 데이터 · 프론트 이웃 목록이 어긋나면 실패하는 동기화 테스트를 추가했습니다.

## [2026-11-24] record | 오래된 세션 · 이메일 인증 · 알림 정리

- 계속 쌓이던 세 표를 6시간마다 정리하는 작업을 추가했습니다: 만료 · 로그아웃 후 하루 지난 세션, 요청 후 하루 지난 이메일 인증, 알릴 시각 90일 지난 알림("배출 정보가 없어요" 안내 제외). [앱 구조](topics/application.md) · [알림](topics/calendar-notifications.md#알림-생성과-읽음-상태)
- 검증: `DataCleanupTests`(지울 것 · 남길 것 · 두 번 실행). 실제 MySQL 에서 같은 조건을 개수 세기로 확인(세션 20개 중 19개 · 이메일 인증 1개 대상, 알림 0개).

## [2026-11-24] record | 배출표 페이지에 알림 정리 예외 추가

- PR #142 의 문서 동기화 검사가 `TrashReminderService` · `application.properties` 변경에 대해 [배출표](topics/trash-schedules.md) 갱신 누락으로 실패해, "배출 정보가 없어요" 안내가 오래된 알림 정리에서 빠진다는 내용을 배출일 알림 절에 추가했습니다.

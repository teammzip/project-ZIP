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

## [2026-11-25] record | 원격 dev 주제별 변경 확인

- 원격 `dev` `c3ed411`을 이전 확인 기준 `250b8d9`와 비교하고 [PR #138~#142 원자료](raw/index.md#2026-11-25--pr-138142-이력-추가)를 등록했습니다. 조회 당시 원격 `backend` `d42841d`는 `dev`의 조상이며, `dev` 전용 커밋은 6개입니다. [원격 브랜치 비교](https://github.com/teammzip/project-ZIP/compare/d42841d07b9bbe2e37966e721fbdec04b005b72c...c3ed4115470eb3044c3ba8508d6a539744c44812)
- [구현·검증 현황](topics/project-status.md#검증해야-될-부분)의 원격 가계부 행별 조회 설명은 11월 24일 병합 전 점검에 해당합니다. 최신 `dev`는 [PR #139](https://github.com/teammzip/project-ZIP/pull/139)의 일괄 조회를 포함합니다. [변경 기록](../CHANGELOG.md#백엔드)의 11월 24일 항목에는 가계부 일괄 조회·저장 서비스 분리 항목이 없고, 세부 근거는 [가계부와 메모](topics/ledger-memos.md#가계부-기록과-회원별-분류)에 있습니다. 운영 응답 시간은 측정되지 않았습니다.

## [2026-11-25] record | API 계약 동기화 이후 DTO 적용 범위 재검토

- `c3ed411`에서 API 경계와 프론트 타입을 대조해 월별 고정 지출·가계부부터 적용할 후보, 기존 타입과 `Map`을 유지할 범위, DTO와 별도로 줄일 수 있는 조회·파싱을 [API 데이터 계약과 DTO](topics/application.md#api-데이터-계약과-dto)에 정리했습니다.
- OpenAPI 가입 주소의 필수 표기와 서버·프론트의 선택 처리를 확인했습니다. 코드를 정적으로 검토했고 구현 변경이나 운영 측정은 수행하지 않았습니다.

## [2026-11-25] record | 주거 설문과 내 집 주소 입력 방식 확인

- `c3ed411`의 화면 코드를 대조해 설문에서 동네를 검색해 선택하는 방식과 내 집 정보에서 상세주소를 직접 입력하는 경로를 [주소와 회원 설정](topics/home-info.md#주소와-회원-설정)에 기록했습니다.

## [2026-11-25] record | Elasticsearch 도입 근거 검토

- `c3ed411`의 게시글 검색 경로와 인덱스를 확인하고 [게시글 검색과 Elasticsearch 도입 검토](topics/community-operations.md#게시글-검색과-elasticsearch-도입-검토)에 현재 동작, MySQL `ngram` 대안, 운영 도입 판단 기준을 기록했습니다. 운영 검색 지표는 측정하지 않았습니다.
- 같은 커밋의 [OpenAPI 게시글 목록](../backend/openapi.yaml#L876)은 읽기에 동네 인증이 필요하고 `scope` 생략값은 `here`라고 설명합니다. [서버 조회 경로](../backend/src/main/java/com/zip/backend/community/CommunityService.java#L60)는 `all`을 기본값으로 사용하며 목록 조회에 30일 동네 인증을 검사하지 않습니다. 권한과 기본값의 계약은 별도 확인이 필요합니다.

## [2026-11-25] record | JDBC 유지와 데이터 접근 기술 도입 검토

- `c3ed411`의 빌드·서버 설정, 로그인 잠금, 월별 납부와 가계부 조회를 확인하고 [데이터 접근 방식 검토](topics/database.md#백엔드-데이터-접근-방식-검토)에 JDBC 유지 의견과 JPA·MyBatis·QueryDSL의 도입 조건을 기록했습니다. 코드 변경이나 실행 성능 측정은 수행하지 않았습니다.

## [2026-11-25] record | 가입 화면과 주거 설문의 주소 입력 범위 확인

- `c3ed411`에서 이메일 가입과 소셜 첫 동의 화면에 주소 칸이 없고 두 화면의 요청에도 주소를 보내지 않는 것을 확인했습니다. [이메일 가입 요청](../frontend/src/features/auth/hooks/useAuthMutations.ts) · [소셜 첫 동의](../frontend/src/features/auth/components/ConsentOnboarding.tsx)
- 주소 입력은 [첫 주거 설문과 내 집 정보](topics/home-info.md#주소와-회원-설정)에서 이어가는 방식을 제안했습니다. 당시 확인한 가입 API와 OpenAPI 표기의 차이는 같은 날 [주소 계약 문서 동기화](#2026-11-25-record--가입과-소셜-첫-동의의-주소-계약-문서-동기화)에서 정리했습니다.

## [2026-11-25] record | JDBC·JPA와 다른 조회 기술 병행 검토

- 공지 생성·수정이 상세 조회를 트랜잭션 안에서 재사용하는 점을 확인했습니다. [데이터 접근 방식 병행](topics/database.md#데이터-접근-방식-병행)에 동일 트랜잭션에서의 JDBC·JPA 연동 조건과 MyBatis·QueryDSL의 적용 범위를 기록했습니다. 검토 기준은 `c3ed411`이며 구현과 실행 검증은 수행하지 않았습니다.

## [2026-11-25] record | 월별 고정 지출과 가계부 DTO 호환 기준 확인

- `c3ed411`의 저장 응답, 월별 미납 필드와 가계부 메모 필드, 사진 고지서의 월별 등록 호출을 확인해 [DTO 도입 시 확인할 동작](topics/application.md#월별-고정-지출과-가계부의-dto-도입-시-확인할-동작)에 정리했습니다. 코드 변경은 수행하지 않았습니다.

## [2026-11-25] record | JDBC와 대안의 성능 비교 기준 확인

- `c3ed411`의 가계부 수입 목록, 공지 본문 조회·알림 일괄 삽입, 커뮤니티 페이지 조회 경로를 확인해 [성능 비교 기준](topics/database.md#성능-비교-기준)에 기록했습니다. 실제 MySQL의 실행 계획과 API 응답 시간은 측정하지 않았습니다.

## [2026-11-25] record | JPA·MyBatis·QueryDSL 도입 판단 기준

- 공지의 생성 키 처리와 갱신, 메모 폴더의 쓰기 조건, 커뮤니티의 검색 SQL·매핑 재사용을 확인했습니다. 다음 필드·필터 변경에 필요한 수정 지점을 기준으로 비교하는 방법을 [도입을 판단하는 기준](topics/database.md#도입을-판단하는-기준)에 기록했습니다. 코드 변경과 후보 구현 비교는 수행하지 않았습니다.

## [2026-11-25] record | 가입과 소셜 첫 동의의 주소 계약 문서 동기화

- 사용자 요청에 따라 주소 없이 진행하는 이메일 가입·소셜 첫 동의 화면과 선택 주소를 받는 API를 실제 동작에 맞춰 문서화했습니다. [OpenAPI](../backend/openapi.yaml) · [프론트 연동 문서](../frontend/API.md#회원가입) · [앱 인증](topics/application.md#인증과-토큰-재발급)
- OpenAPI YAML과 주소를 생략한 두 JSON 요청 예시를 파싱했습니다. 주소 생략 사례를 포함한 [이메일 가입 테스트](../backend/src/test/java/com/zip/backend/EmailAuthTests.java)와 [소셜 첫 동의 테스트](../backend/src/test/java/com/zip/backend/ConsentAndProfileTests.java)를 로컬 H2 테스트 환경에서 통과했습니다.

## [2026-11-25] record | project-ZIP 데이터 접근 기술 도입 의견

- `c3ed411`의 생성 키 처리, 관리자 회원 조회의 SQL·매핑 공유, 게시글·지도·일정의 검색 구조를 대조해 [현재 도입 의견](topics/database.md#project-zip-현재-도입-의견)을 기록했습니다. 기존 운영 코드는 JDBC를 유지하고 신규 단순 CRUD에서 JPA를 시험하며, MyBatis·QueryDSL은 공유할 조회가 늘어날 때 검토하는 의견입니다. 코드 변경과 운영 성능 측정은 수행하지 않았습니다.

## [2026-11-25] record | 신규 기능 JPA 시험과 조회 기술 병행 계획

- 사용자 요청에 따라 다음 DB 연동 신규 기능에서 JPA를 시험하고, MyBatis와 QueryDSL이 모두 필요해질 때 병행 방식을 검토하도록 [신규 기능에 적용할 계획](topics/database.md#신규-기능에-적용할-계획)을 등록했습니다. [색인](index.md)에서 계획으로 바로 이동할 수 있습니다.

## [2026-11-25] record | 동네 커뮤니티 검색 비교 절차

- `c3ed411`의 검색·페이지 처리, 서버 모드 요청과 H2 통합 테스트를 확인했습니다. [게시글 검색 비교 절차](topics/community-operations.md#게시글-검색-비교-절차)에 평가 검색어, 동네·카테고리·페이지 회귀, 실제 MySQL 성능 비교, 인덱스 지연·장애 검증 기준을 기록했습니다. 후보 구현과 벤치마크는 수행하지 않았습니다.

## [2026-11-25] record | 원격 dev 구현 및 검증 범위 확인

- 원격 `dev` `c3ed411`와 동일한 프런트 소스·테스트 및 DB 파일에서 프런트 테스트 195개, 프런트 빌드, DB 정적 검사 7개가 통과했습니다. 린트는 종료 코드 0이며 [메모 화면](../frontend/src/pages/my/MemoPage.tsx#L62)과 [지도 화면](../frontend/src/features/map/components/MapView.tsx#L125)의 경고 2건이 남았습니다.
- 가계부와 월별 고정 지출 DTO, 가입 주소 계약 문서의 작업 트리 변경은 원격 기준에서 제외했습니다. 백엔드와 격리 MySQL은 [기존 실행 기록](topics/project-status.md#검증된-부분) 및 [PR #139](https://github.com/teammzip/project-ZIP/pull/139)·[변경 기록](../CHANGELOG.md#백엔드)의 범위를 사용했습니다. [배포 환경 검증 항목](topics/project-status.md#검증해야-될-부분)은 별도로 남아 있습니다.

## [2026-11-25] record | 전체 PR과 Trello 작업 분류 동기화

- GitHub에서 PR #1~#142의 목록을 확인하고 [전체 PR 원자료](raw/pull-requests.md)와 대조했습니다. [ZIP-project Trello 보드](https://trello.com/b/8qibfPP2/zip-project)의 작업 카드와 병합 이력에 근거 링크를 반영했고, 반영한 카드 41장과 완료 체크 29개를 보드에서 다시 읽어 확인했습니다.
- 병합 없이 닫힌 PR 세 건은 [삭제 분류의 정리 기록](https://trello.com/c/o0kbKIAV)에 남겼습니다. 배포 DB와 운영 가계부 응답 시간은 [구현·검증 현황](topics/project-status.md#검증해야-될-부분)의 확인 과제로 유지했습니다.

## [2026-11-25] lint | 메모·지도 경고와 프로젝트 문서 정리

- [가계부 메모](topics/ledger-memos.md)는 목록 동기화 후 임시 편집 내용을 복구하고, [지도 검색](topics/map-place-ids.md#장소-검색과-저장-리스트)은 위치 변경 시 이전 검색을 정리하도록 수정했습니다. [로컬 점검 결과](topics/project-status.md#검증된-부분) · [프론트 검증 명령](../frontend/README.md#변경-검증)
- 사용자 확인에 따라 README의 [배출표 설명](../README.md#지금-상태)과 [신규 DB 준비](../README.md#백엔드-실행-선택)를 갱신했습니다. 가계부 일괄 조회와 저장 서비스 분리는 [11월 24일 백엔드 변경 기록](../CHANGELOG.md#백엔드)에 추가했습니다.

## [2026-11-25] record | 가계부와 월별 고정 지출에 DTO 적용

- [가계부 저장과 조회](topics/ledger-memos.md#가계부-저장-트랜잭션), [월별 고정 지출과 사진 고지서](topics/fixed-expenses.md#일반-고정-지출의-납부와-해지), [내 집 정보의 관리비 응답](topics/home-info.md)에 적용한 Java 타입과 JSON 계약을 반영했습니다.
- 백엔드 전체 테스트 334개와 프론트 관련 테스트 62개가 통과했습니다. 문자열·소수 금액 거부, 미납 `null`과 선택 메모 필드 생략, 사진 고지서 응답, 가계부 롤백·동시 저장을 확인했습니다. [월별 등록 통합 테스트](../backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java) · [가계부 통합 테스트](../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

## [2026-11-25] record | 게시글 검색 범위의 도입 판단 기준

- `c3ed411`의 검색 목록이 최신순이고 인기 글이 조회수순이며, 목록 응답에 제목·본문이 들어가는 것을 확인했습니다. [게시글 검색 비교 절차](topics/community-operations.md#게시글-검색-비교-절차)에 동네별 기대 ID와 삭제·숨김 이후 운영 전환을 보류하는 이유를 기록했습니다. 후보 간 실행 비교는 수행하지 않았습니다.

## [2026-11-25] record | 가계부 저장 요청 DTO 연결과 목록 계약 검증

- 가계부 수입·지출 등록과 수정의 HTTP 본문을 `LedgerWriteBody`로 바인딩했습니다. JSON의 원래 자료형과 필드 생략 여부를 보존해 기존 검증을 거친 뒤 수입·지출 저장 DTO로 변환합니다. [가계부 저장과 목록 계약](topics/ledger-memos.md#가계부-저장-트랜잭션) · [앱 API 계약](topics/application.md#api-데이터-계약과-dto)
- H2 MySQL 호환 모드에서 가계부·월급·메모 통합 테스트 32개와 프론트 가계부 테스트 11개가 통과했습니다. 등록·수정 상태 코드, 목록의 문자열 ID·월급 플래그·선택 메모 필드, 롤백·동시 저장을 확인했습니다. 백엔드 전체 실행은 Gradle 결과 파일 누락으로 종료돼 별도 출력 경로에서 관련 테스트를 실행했습니다. [가계부 통합 테스트](../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

## [2026-11-25] record | 기능 구현과 테스트 재검증

- 첫 백엔드 전체 실행은 고지서 테스트의 Spring 컨텍스트 초기화 실패와 Gradle 결과 처리 `EOFException`으로 종료했습니다. 별도 빌드·프로젝트 캐시 폴더에서 대표 고지서 테스트 한 건과 전체를 재실행했습니다. 최종 JUnit XML 48개에 기록된 백엔드 테스트 336개는 실패·오류·건너뜀 0건입니다. [관련 고지서 테스트](../backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java)
- 작업 트리의 프론트 테스트 195개·타입 검사·빌드·린트 경고 0건, OpenAPI YAML 파싱 99경로를 확인했습니다. DB 정적 검사 7개와 격리 MySQL 9.6 신규·업그레이드·보존 검사 72단계 265개가 통과했습니다. 모바일 WebKit의 모의 API에서 가계부 메모 보류·복구·저장·복귀·선택 폐기를 확인했습니다. [구현·검증 현황](topics/project-status.md#검증된-부분)
- 재검증 당시 GitHub `dev`는 `c3ed411`이었고, 가계부·고정 지출 DTO와 메모·지도 경고 수정은 로컬 작업 트리에 있었습니다. 최신 배포 DB 적용, 실제 제공자 연동, 서버 모드의 두 브라우저 계정 분리·동기화, 운영 가계부 응답 시간은 [배포 환경 검증 항목](topics/project-status.md#검증해야-될-부분)에 남아 있습니다.

## [2026-11-25] record | 내 집 정보 응답과 첫 주거 설문 DTO 적용 범위 확인

- 작업 트리의 서버 응답과 OpenAPI·프론트 타입을 대조했습니다. 내 집 정보 응답의 공통 설정 필드와 설문 서비스의 기존 계약·대출 참조, 설문 요청의 부분 입력·재요청·롤백 확인 항목을 [DTO 적용 검토](topics/home-info.md#내-집-정보와-첫-주거-설문의-dto)에 기록했습니다. 구현 변경과 테스트 실행은 수행하지 않았습니다.

## [2026-11-25] record | 내 집 정보 응답과 첫 주거 설문에 DTO 적용

- 조회·내 집 정보 저장·대출 조건 저장에 공통 응답 DTO를 적용하고 생활 설정 응답도 같은 타입 매핑을 사용하도록 바꿨습니다. 설문은 요청 DTO에서 `save`와 `skip`을 구분하고 기존 입력 계약을 유지합니다. [내 집 정보와 설문 DTO](topics/home-info.md#내-집-정보와-첫-주거-설문의-dto)
- 별도 Gradle 출력 경로에서 H2 백엔드 전체 339개가 실패·오류·건너뜀 없이 통과했습니다. 프론트 내 집 정보·설문·대출·월별 지출 관련 테스트 54개도 통과했습니다. 기존 대출 초안 읽기, 응답의 `null`·빈 배열·필드 생략, 설문 재요청과 롤백을 검증했습니다. [내 집 정보 테스트](../backend/src/test/java/com/zip/backend/HomeInfoTests.java) · [설문 테스트](../backend/src/test/java/com/zip/backend/HousingOnboardingTests.java)

## [2026-11-25] record | 생활 API DTO PR 문서 정리

- 사진 고지서 확정이 월별 고정 지출 등록 검증을 공유하는 경로를 확인했습니다. 기준 브랜치 `c3ed411`에서 고지서 컨트롤러를 참조하는 [외부 서비스와 AI](topics/service-integrations.md)에 월별 고정 지출 DTO 설명을 연결하고, 네 기능의 적용 범위와 기존 검증 결과를 [백엔드 변경 기록](../CHANGELOG.md#백엔드)에 추가했습니다. [사진 확정 컨트롤러](../backend/src/main/java/com/zip/backend/bills/BillPhotoController.java#L111) · [사진 등록 서비스](../backend/src/main/java/com/zip/backend/bills/BillService.java#L262)

## [2026-11-24] record | OpenAPI 최신화 · 실제 DB 구조 맞춤 · 마이그레이션 안내 정리

- [앱 구조](topics/application.md#api-데이터-계약과-dto): `openapi.yaml`을 서버 컨트롤러 전체와 대조해 빠진 경로 17개와 AI 대화 전체 삭제를 추가하고, 서버에 없는 `GET /api/ai/topics`를 지웠습니다. 문의 목록과 문의 쓰기 응답 코드도 서버에 맞췄습니다.
- [데이터베이스](topics/database.md#db-검증-결과): 개발용 실제 DB의 `bill_photo_drafts` 인덱스 이름과 `loan_interest_charges.paid_at` 설명을 `schema.sql`과 같게 맞췄습니다(백업 후 적용). 칸 순서를 빼고 비교하면 차이는 0입니다. `20261118_07` 마이그레이션 문구를 맞췄고, `db/migrations/README.md` 끝의 옛 안내문 중복을 정리했습니다.

## [2026-11-24] record | 내 집 주소 검색 · README 배출표 설명

- [내 집 정보](topics/home-info.md) · [배출표](topics/trash-schedules.md): 내 정보의 내 집 주소 칸에 주소 검색(주거 설문과 같은 동네 검색)을 붙였습니다. 고르면 시·도 · 시·군·구 · 동이 채워지고 상세주소를 이어서 씁니다. 직접 입력도 그대로 됩니다.
- 루트 README의 "배출표 화면은 아직 고정표" 문장을 지우고 연결된 기능에 배출표를 넣어, 배출표 페이지의 [문서 간 차이](topics/trash-schedules.md#문서-간-차이)를 해소했습니다.

## [2026-11-24] record | 메모 화면 린트 경고 정리

- [가계부와 메모](topics/ledger-memos.md): 메모 화면이 쓰던 내용을 되살린 뒤 편집 화면을 여는 시점을 메모 저장소 변경 알림으로 바꿔 `react(set-state-in-effect)` 경고를 없앴습니다. 동작은 같습니다. [프로젝트 현황](topics/project-status.md)의 남은 경고를 지도 1건으로 고쳤습니다.

## [2026-11-25] record | PR #144 반영 뒤 코드 기준 정리

- [PR #144](https://github.com/teammzip/project-ZIP/pull/144)가 `dev`(`f14b6f8`)에 병합된 뒤 코드와 위키를 대조했습니다. 메모 화면 린트 경고는 정리됐고 지도 화면 경고 1건이 남아 있었습니다. 지도 경고는 이후 [PR #146](https://github.com/teammzip/project-ZIP/pull/146)(`6bdff48`)으로 `dev`에서 정리돼 린트 경고 0건입니다.
- 같은 날 기록에서 ‘별도 확인 필요’로 남은 글 목록 계약과, 기록에는 동기화했다고 적혔지만 `dev`에 들어오지 않은 가입 주소 계약, 그리고 `PATCH /api/auth/me` 설명을 [OpenAPI](../backend/openapi.yaml)에서 서버 코드 기준으로 고쳤습니다. [앱 구조](topics/application.md#api-데이터-계약과-dto)

## [2026-11-25] record | 출시 전 보완 항목 점검

- `f14b6f8` 기준 백엔드·프론트 코드를 보안·운영 관점으로 점검해 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)에 화면 오류 처리, 사진 업로드 제한, 인증 메일 발송 제한, PR 자동 테스트, 무료 공개 API 사용 조건을 기록했습니다. 글·댓글·AI 대화·고지서 인식 결과의 소유자 확인, SQL 매개변수 사용, 요청마다의 세션 확인, 비밀번호 변경 시 전체 세션 종료는 문제없음을 확인했습니다. 코드 변경과 부하 시험은 수행하지 않았습니다.
- 정정: 연결되지 않은 업로드 사진은 [업로드 서비스](../backend/src/main/java/com/zip/backend/files/ProfileFileService.java)의 정리 작업이 7일 뒤 지우므로, 남은 문제는 회원당 업로드 개수 제한입니다. [구현·검증 현황](topics/project-status.md#구현해야-될-부분)도 고쳤습니다.

## [2026-11-25] record | 화면 오류 안내와 PR 자동 테스트

- [앱 구조](topics/application.md#화면-접근과-공통-모달): 최상위 경로에 오류 화면을 연결해 화면 오류가 빈 화면이 되지 않게 했고, 배포 뒤 옛 화면 파일 오류는 한 번 자동 새로고침합니다. 프론트 테스트 199개(새 4개) · 빌드 통과, 린트 경고는 기존 지도 1건입니다. 빌드 미리보기에서 로그인 화면 파일을 지우고 `/login`을 열어, 한 번 자동 새로고침한 뒤 안내 화면이 뜨고 파일을 되돌린 다음 [새로고침]으로 로그인 화면이 열리는 것을 확인했습니다.
- [구현·검증 현황](topics/project-status.md#구현해야-될-부분): `.github/workflows/test.yml`로 PR 자동 테스트를 추가했습니다. 로컬에서 같은 명령과 YAML 구문을 확인했고 GitHub 실행 결과는 첫 PR에서 확인합니다.

## [2026-11-25] record | 인증 메일 · 사진 업로드 남용 방지 제한

- [앱 구조](topics/application.md#인증과-토큰-재발급)에 인증 메일의 IP별·서버 전체 상한을, [지도 장소](topics/map-place-ids.md)에 회원당 사진 업로드 제한을 기록하고 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)의 두 항목을 해결로 고쳤습니다. [외부 서비스와 AI](topics/service-integrations.md)의 이메일 인증 행에서 발송 제한으로 연결했습니다.
- H2 백엔드 전체 345개(새 6개)가 통과했습니다. `schema.sql`로 만든 임시 MySQL DB와 메일을 로그로만 남기는 설정으로 서버를 띄워(`server.forward-headers-strategy=framework`, `X-Forwarded-For`로 IP 지정) 같은 IP 6번째 차단·다른 IP 허용, 시간당 100통에서 차단과 막힌 요청의 IP 횟수 미사용, 안 붙인 사진 21번째 차단·프로필 연결 후 허용, 지운 사진을 포함한 24시간 51번째 차단·하루 뒤 허용을 확인했습니다. 같은 날 로컬 서버와 실제 메일 계정으로 회원가입 인증 메일 수신, 인증번호 확인, 가입 완료까지 확인했습니다. 배포 프록시에서의 IP 구분은 확인하지 않았습니다.

## [2026-11-26] record | 동네 검색 순위·범위·API 성능 검증

- 격리 MySQL과 Elasticsearch에서 현행 `LIKE`, MySQL `ngram`, Elasticsearch Nori를 같은 Spring HTTP API로 비교했습니다. 합성 게시글에서 검색 순위, 세 동네 범위, 삭제·숨김 후 인덱스 지연, 1,152개 API 요청의 응답 시간을 [격리 검색 비교 결과](topics/community-operations.md#격리-검색-비교-결과)에 기록했습니다.
- 현행 API 회귀 테스트를 추가했고 커뮤니티 통합 테스트 17개가 통과했습니다. 검색 후보는 격리 시제품으로 실행했습니다. [검색 회귀 테스트](../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java#L127)

## [2026-11-26] record | 동네 검색 최신순과 제목 일치 우선 비교

- 같은 격리 MySQL과 Spring HTTP API에서 두 정렬의 검색 순위, 세 지역의 공개 범위, 숨김·삭제, 페이지 경계, 특수문자 입력을 확인했습니다. 합성 게시글 10,067건에서 두 차례 측정한 API 요청 5,760건과 MySQL 실행 계획을 기록했습니다. 일부 검색의 순위는 개선됐지만 모든 측정 조건에서 p95가 올라 현행 최신순 유지를 제안합니다. [최신순과 제목 일치 우선 정렬 비교](topics/community-operations.md#최신순과-제목-일치-우선-정렬-비교)

## [2026-11-26] record | 동네 검색의 조회순과 인기순 검토

- 게시글 검색의 최신순과 홈 인기 글의 누적 조회순을 구분했습니다. 검색 기본 최신순, 선택 조회순, 관련도 평가 기준과 조회수 변화 시 페이지 확인 항목을 검토했습니다. 이후 구현은 [검색 정렬과 관련도](topics/community-operations.md#검색-정렬과-관련도)에 기록했습니다.

## [2026-11-26] record | 동네 검색 정렬과 관련도 구현·비교

- 회원 게시글 검색에 최신순·조회순·인기순·관련도순을 연결하고, 검색어가 있을 때 관련도순을 적용했습니다. 격리 MySQL에서 합성 검색어의 순위, 공개 범위, 삭제·숨김, 페이지 경계와 HTTP 요청 3,072건을 검증했습니다. [검색 정렬과 관련도](topics/community-operations.md#검색-정렬과-관련도)

## [2026-11-26] record | 원격 dev PR 143·144 병합 확인

- GitHub `dev`의 최신 커밋은 `f14b6f8`입니다. 이전 확인 기준 `c3ed411` 이후 PR 2건, 커밋 4개, 파일 50개가 바뀌었습니다. [커밋 및 파일 비교](https://github.com/teammzip/project-ZIP/compare/c3ed4115470eb3044c3ba8508d6a539744c44812...f14b6f876232eabe32d30b78c6e65ab8e0804a95)
- 원격 `backend`의 DTO 커밋 `8f2c998`은 [PR #143](https://github.com/teammzip/project-ZIP/pull/143/files)으로 `dev`에 병합됐습니다. [PR #144](https://github.com/teammzip/project-ZIP/pull/144/files)는 내 집 주소 검색, 메모 복구 시점, OpenAPI 경로와 개발 DB·마이그레이션 안내를 갱신했습니다. [커밋 기준 변경 기록](https://github.com/teammzip/project-ZIP/blob/f14b6f876232eabe32d30b78c6e65ab8e0804a95/CHANGELOG.md)
- 변경 파일과 기록을 대조했습니다. 테스트와 배포는 이번 점검에서 실행하지 않았습니다. 로컬의 커뮤니티 검색·지도 수정은 미커밋 상태로 확인했습니다.

## [2026-11-26] record | 생활 API DTO 적용 이후 후속 검토

- `backend` `8f2c998`과 커뮤니티 검색 작업 트리에서 [DTO 적용 범위](topics/application.md#dto-적용-검토)를 다시 확인했습니다. 공통 회원 응답을 우선 후보로 두고, 게시글과 월급 설정 응답은 관련 기능을 변경할 때 검토하도록 정리했습니다. 회원 응답 조립의 분리 조회, 가계부 저장과 고정 지출 검증의 중복 조회를 [코드 최적화 후보](topics/application.md#dto와-별도로-검토할-최적화)에 연결했습니다. 코드 구현과 응답 시간 측정은 수행하지 않았습니다.

## [2026-11-26] record | 공통 회원 응답에 DTO 적용

- 로그인·가입, 내 정보 조회·수정, 첫 주거 설문 완료에 [공통 회원 응답 DTO](topics/application.md#공통-회원-응답-dto)를 연결했습니다. 로그인·가입 본문은 `accessToken`과 `user`를 반환하고 재발급 토큰은 쿠키로 발급합니다. [설문 응답](topics/home-info.md#내-집-정보와-첫-주거-설문의-dto)
- `8f2c998` 기준 작업 트리에서 별도 Gradle 출력으로 H2 백엔드 전체 344개를 실행해 실패·오류·건너뜀 0건을 확인했습니다. 프론트 인증 재발급, 소셜 콜백, 설문 저장, 내 정보 테스트 20개가 통과했습니다. [회원 응답 테스트](../backend/src/test/java/com/zip/backend/AuthIntegrationTests.java) · [소셜 회원 응답 테스트](../backend/src/test/java/com/zip/backend/ConsentAndProfileTests.java)
- 실제 응답과 프론트 회원 타입의 `birth`·`banCount`는 로컬 [OpenAPI `User`](../backend/openapi.yaml) 스키마에 기재돼 있지 않습니다. 이번 검증은 기존 HTTP 응답을 기준으로 했습니다. [프론트 회원 타입](../frontend/src/features/auth/types.ts)

## [2026-11-26] record | 새 동네 검색의 관련도순 기본값

- 목록을 조회순으로 보던 중 새 검색을 시작하면 관련도순이 적용되고, 검색어를 지우면 목록 정렬이 복원됩니다. 모바일 WebKit의 모의 화면에서 새 검색과 검색 재시작의 기본값을 확인했습니다. [검색 정렬과 관련도](topics/community-operations.md#검색-정렬과-관련도)

## [2026-11-26] record | 동네 검색 후속 작업 검토

- [관련도순 적용 후 검증 후보](topics/community-operations.md#관련도순-적용-후-검증-후보)에 대표 검색어의 순위·누락, 동네 범위 확인, 실제 API 응답 시간 측정을 우선순위로 기록했습니다. 저장소의 코드와 기존 측정 결과를 확인했으며 새 측정은 수행하지 않았습니다.

## [2026-11-26] record | 동네 검색 대표 검색어 30개 기준 점수

- [검색어·기대 결과·합성 글 66건](../db/tests/community-search/fixture-v1.json)을 실행 전에 고정했습니다. 격리 MySQL 9.6.0의 Spring API를 270회 호출해 관련도순과 최신순의 순위, 검색 누락, 정렬 생략, 범위·공개 상태를 확인했습니다. 관련도순은 적합한 글이 있는 25개 중 1위 14개, 상위 5개 22개를 기록했습니다. [평가 결과와 재실행](topics/community-operations.md#대표-검색어-30개-기준-평가)

## [2026-11-26] record | 커뮤니티 게시글 응답에 DTO 적용

- `8f2c998` 기반 작업 트리의 공백 단위 검색, 동네·카테고리 필터와 네 정렬 옵션을 사용한 뒤 검색 결과를 [게시글 응답 DTO](topics/community-operations.md#게시글-응답-dto)로 변환합니다. 회원 목록의 상세 필드 생략과 글 상세·관리자 목록의 댓글·첨부 배열을 유지했습니다.
- 별도 Gradle 출력에서 H2 백엔드 전체 345개가 실패·오류·건너뜀 없이 통과했습니다. 커뮤니티 테스트 19개에서 네 정렬과 지역·공개 범위, 검색 결과 21건의 두 페이지, 댓글·첨부 응답을 확인했습니다. 프론트 전체 테스트 195개와 빌드도 통과했습니다. [검색 페이지 회귀 테스트](../backend/src/test/java/com/zip/backend/community/CommunityIntegrationTests.java#L123) · [정렬·범위 통합 테스트](../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java)
- 검증 기준은 현재 HTTP 응답입니다. 기존 [OpenAPI 스키마](../backend/openapi.yaml)의 `Post`에는 `reported`·`homeTip`, `Comment`에는 `reported`·`parentId`가 기재돼 있지 않습니다. [프론트 응답 타입](../frontend/src/features/community/server.ts)

## [2026-11-26] record | 월급 설정 응답 DTO 적용 범위 검토

- 가입 후 첫 주거 설문과 마이페이지 수입 정보의 호출 경로를 대조했습니다. 월급 조회·저장 응답과 선택 초안에 적용할 범위와 회귀 확인 항목을 [월급 설정 응답 DTO](topics/fixed-expenses.md#월급-설정-응답-dto)에 기록했습니다. 구현과 테스트 재실행은 이번 검토 범위에 포함하지 않았습니다.

## [2026-11-26] record | 월급 설정 응답에 DTO 적용

- 월급 조회·저장에 [월급 설정 응답 DTO](topics/fixed-expenses.md#월급-설정-응답-dto)를 적용했습니다. 완성된 설문 월급 값의 조회, 수령일 없는 초안 조회, 수입 정보 저장 후 재조회 값 일치와 초안 제거, 설문 재요청 시 수정 내용 보존을 통합 테스트로 확인했습니다. [설문·수입 정보 통합 테스트](../backend/src/test/java/com/zip/backend/HousingOnboardingTests.java#L85)
- `8f2c998` 기준 작업 트리의 별도 Gradle 출력에서 H2 백엔드 전체 347개가 실패·오류·건너뜀 없이 통과했습니다. 프론트 월급·설문 요청 테스트 5개가 통과했습니다. [월급 회귀 테스트](../backend/src/test/java/com/zip/backend/SalaryIntegrationTests.java) · [프론트 월급 테스트](../frontend/tests/salary.test.mjs)

## [2026-11-26] record | 수입 정보의 가계부 월급 반영 확인

- [월급 자동 등록](topics/fixed-expenses.md#월급-자동-등록)에서 수입 정보의 저장 값이 가계부 고정 수입과 월별 합계에 반영되는 경로를 확인했습니다. H2 설문·월급 테스트 15개와 프론트 가계부·설문·월급 테스트 11개를 다시 실행해 모두 통과했습니다. 테스트는 수령일 전 등록 보류, 중복 방지, 설정 변경 시 기존 월급 금액 보존을 포함합니다. [백엔드 월급 회귀 테스트](../backend/src/test/java/com/zip/backend/SalaryIntegrationTests.java#L70) · [프론트 가계부 테스트](../frontend/tests/ledger.test.mjs)

## [2026-11-26] record | 동네 검색 기본 관련도순 유지 검토

- [기준 평가](topics/community-operations.md#대표-검색어-30개-기준-평가)의 순위를 대조해 관련도순에서 적합한 글이 새로 1위에 오른 검색 10개와 최신순 1위가 유지된 검색 4개를 확인했습니다. 기본 관련도순 유지와 띄어쓰기 차이로 인한 검색 누락 개선을 제안했습니다. 기존 결과와 코드로 검토했습니다.

## [2026-11-26] record | 동네 검색의 띄어쓰기 누락 개선

- 3자 이상 한글 음절을 붙여 검색할 때 제목·본문의 일반 공백을 각각 빼고 비교하도록 회원 API와 모의 검색을 갱신했습니다. 격리 MySQL의 고정 평가에서 적합한 글 누락은 3/25에서 1/25로 줄었고, 별도 평가에서는 4/6에서 0/6으로 줄었습니다. 동네·카테고리·공개 상태와 관련도순 기본값, 합성 게시글 1만 건 API 부하를 확인했습니다. [검색 품질·응답 시간과 재실행](topics/community-operations.md#띄어쓰기-누락-개선-검증)

## [2026-11-26] record | 동네 검색 개선안의 품질 유지 기준 검토

- 고정 30개의 상위 5개 반환 항목을 다시 집계해 적합한 항목은 25개에서 27개로 증가하고 적합 표시가 없는 항목은 24개로 유지된 것을 확인했습니다. 검색어별 순위 하락, 대조 검색의 새 결과 확인, 결과가 비어 있는 철자 오류 검색의 제안 후보를 [품질 유지 검토](topics/community-operations.md#띄어쓰기-누락-개선-검증)에 기록했습니다.

## [2026-11-26] record | 동네 검색 결과가 없을 때 오타 교정 제안

- 회원 검색 첫 페이지가 0건이면 같은 동네·카테고리의 공개 검색 결과로 검증된 유일한 교정 후보를 제안합니다. 격리 MySQL에서 오타 4개는 제안 선택 후 적합한 글이 모두 1위였고, 대조 사례 8개에서 잘못된 제안은 0건이었습니다. 기존 30개 검색어의 범위별 90개 직접 검색 순위, 모바일 WebKit의 선택 후 검색 조건 유지, 커뮤니티 통합 테스트 21개를 확인했습니다. [오타 교정 제안과 사례 평가](topics/community-operations.md#오타-교정-검색어-제안)

## [2026-11-26] record | DTO·검색·화면 변경의 통합 PR 범위 확인

- `9959096`과 남은 변경을 합친 작업 트리에서 검색 오타 제안 응답 계약과 [메모 복구](topics/ledger-memos.md), [가입 주소와 배출표 조회](topics/calendar-notifications.md#알림-생성과-읽음-상태)를 대조했습니다. [변경 기록](../CHANGELOG.md#백엔드) · [프론트 API 계약](../frontend/API.md#7-커뮤니티--첨부--신고-)
- `dev` 병합 전 작업 트리에서 회원·커뮤니티·월급·설문 H2 통합 테스트 70개와 프론트 전체 테스트 198개, 프론트 린트와 빌드가 통과했습니다. 관련 위키 누락 후보는 없었으며, `dev` `f14b6f8`과의 모의 병합에서 메모 화면·위키 작업 로그·배출표 문서의 충돌을 확인했습니다.

## [2026-11-26] record | 동네 검색 품질 평가 보완점 검토

- 기존 평가 결과와 채점 코드를 대조해 새 검증 검색어 선정, 상위 결과별 적합성 판단, 교정 후보 확인 경로의 API 부하 측정을 [검색 품질 평가 보완점](topics/community-operations.md#검색-품질-평가-보완점)에 기록했습니다. 기존 결과를 검토했으며 새 측정은 수행하지 않았습니다.

## [2026-11-26] record | 메모·지도 변경 복구와 공용 API 문서 동기화

- PR #145가 병합된 `ac23a70`에서 보관 변경을 복구했습니다. 목록 동기화 뒤 초안 입력을 복구하는 [메모 흐름](topics/ledger-memos.md)과 기존 주소 검색 및 신규 DB 자료 안내를 담은 [배출표 문서](topics/trash-schedules.md)를 정리했습니다.
- [공용 API 문서](../frontend/API.md)의 가입·동의·회원 주소 변경과 내 집 상세주소 계약을 [인증](topics/application.md#인증과-토큰-재발급), [내 집 정보](topics/home-info.md#주소와-회원-설정), [고정 지출](topics/fixed-expenses.md)과 대조했습니다. 게시글 정렬과 교정 제안의 [검색 API 계약](../frontend/API.md#동네-게시글-검색)을 [커뮤니티 검색](topics/community-operations.md#검색-정렬과-관련도)에서 연결했습니다.

## [2026-11-26] record | dev PR 145·146 받은 뒤 남용 방지 · 오류 화면 작업 확인

- 미커밋 작업(인증 메일·사진 업로드 제한, 오류 화면, PR 자동 테스트)을 `dev` `6bdff48` 위로 옮겼습니다. [OpenAPI](../backend/openapi.yaml)의 가입·동의 `address` 설명은 `dev`가 먼저 고친 내용을 기준으로 두고, 429 응답과 글 목록 설명만 남겼습니다. 지도 린트 경고는 `dev`에서 정리돼 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)의 해당 줄을 뺐습니다.
- H2 백엔드 전체 355개, 프론트 테스트 202개, 린트 경고 0건, 빌드, DB 정적 검사 7개가 통과했습니다. `openapi.yaml`을 새로 근거로 건 [고정 지출](topics/fixed-expenses.md#검증-결과)의 월급 스키마도 대조했습니다.

## [2026-11-26] record | dev `6bdff48` 위 전체 동작 확인

- `schema.sql`로 만든 임시 MySQL DB(약관·지역·이웃·배출표는 로컬 DB에서 복사)와 메일을 로그로만 남기는 설정으로 서버를 띄워 가입 인증 메일 → 인증 → 가입 → 로그인 → 내 정보·설정·월급·내 집·지역·글 목록·일정·알림·가계부·메모·AI 대화·배출표·공지 조회, 글쓰기, 메모 폴더, 사진 업로드, 로그아웃 뒤 401을 확인했습니다. 동네 글 검색은 관련도순, 붙여 쓴 검색어(`분리수거`), 3자 이상 오타의 교정 제안(`분리수게` → `분리수거`)이 응답했습니다. 같은 IP 6번째 인증 메일은 429였습니다. 서버 오류 로그는 없었습니다.
- 서버 모드 화면에서 로그인 → 첫 설문 건너뛰기 → 홈·지도·AI·마이페이지 각 탭·내 정보·내 리뷰가 열렸고 콘솔 오류는 없었습니다. 커뮤니티는 다른 경로로 동네를 인증한 회원에게 인증 안내가 떠서 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)에 기록했습니다. 임시 DB와 업로드 파일은 지웠습니다.

## [2026-11-26] record | 다른 기기의 동네 인증을 커뮤니티에 반영

- 서버 모드의 동네 인증 판정이 브라우저의 동네 이름이 비면 로그인 응답의 회원 동네 이름을 쓰도록 고쳤습니다. [커뮤니티 동네 인증](topics/community-operations.md#동네-글과-조회-집계) · [구현·검증 현황](topics/project-status.md#구현해야-될-부분)
- 프론트 테스트 207개(새 5개) · 타입 검사 · 린트 경고 0건 · 빌드가 통과했습니다. `schema.sql`로 만든 임시 DB 서버에서 API로 동네를 인증한 회원이 저장소를 비운 브라우저로 로그인해 커뮤니티에 들어가 글을 썼고, 인증 시각을 지우면 인증 안내가 다시 뜨는 것을 확인했습니다. 임시 DB는 지웠습니다.

## [2026-11-26] record | 날씨·지도도 다른 기기의 동네 인증 사용

- 서버 회원 응답의 `region`에 시·도를 붙인 `fullName`을 추가하고, 날씨·홈·동네 지도의 동네 선택이 이 브라우저에 고른 동네가 없을 때 서버의 동네 인증을 설문 주소보다 먼저 쓰도록 고쳤습니다. 커뮤니티 입장의 동네 이름도 같은 이름을 씁니다. [홈 날씨 위치](topics/service-integrations.md#홈-날씨-위치) · [공통 회원 응답 DTO](topics/application.md#공통-회원-응답-dto)
- H2 백엔드 전체 356개(새 1개), 프론트 210개(새 3개)·타입 검사·린트 경고 0건·빌드가 통과했습니다. 임시 DB 서버에서 API로 동네를 인증한 회원이 저장소를 비운 브라우저로 로그인하자 홈 날씨 카드가 `서울 중구` 날씨를, 동네 지도가 `서울 중구` 중심과 주변 장소를 보여 줬습니다(이전에는 동네 설정 안내). 임시 DB는 지웠습니다.
- 로그인 조회의 `FOR UPDATE`가 동네 행까지 잠그는 기존 동작을 [데이터 접근 방식 검토](topics/database.md#백엔드-데이터-접근-방식-검토)에 기록했습니다(미수정).
- [공용 API 문서](../frontend/API.md)의 회원 `region` 설명에 `fullName`을 넣고, 이미 있는 동네 목록·이웃 API를 없다고 적은 두 곳과 화면이 부르지 않는 `/api/me/settings`를 호출한다고 적은 2장 머리 문장을 코드 기준으로 고쳤습니다. 근거로 건 [내 집 정보](topics/home-info.md#주소와-회원-설정)·[배출표](topics/trash-schedules.md) 문서에 영향 범위를 적었습니다.

## [2026-11-26] record | 동네 검색 새 검색어 30개 독립 평가

- [검색어·기대 결과·합성 게시글 60건](../db/tests/community-search/independent-v1.json)을 요청 전에 고정했습니다. `a9e9ad9`의 API와 격리 MySQL 9.6.0에서 직접 검색은 관련도순·최신순 모두 1위 0/18, 상위 5개 9/18이었습니다. 올바른 교정 제안 4/8은 다시 검색하면 모두 기대 글이 1위였고, API 요청 279건에서 가시성 위반은 없었습니다. [사례별 평가와 후속 검증](topics/community-operations.md#새-검색어-30개-독립-평가)

## [2026-11-26] record | 독립 검색 평가 누락·순위 분석

- 고정 기대 글과 API 응답을 대조해 누락 9개 중 복합어 띄어쓰기 차이가 있는 4개와 다른 표현으로 작성된 5개를 확인했습니다. 적합한 글이 반환된 9개에서 첫 적합 글은 2위 6개, 3위 3개였습니다. 변경 효과는 추가 평가가 필요합니다. [독립 평가와 개선 후보](topics/community-operations.md#새-검색어-30개-독립-평가)

## [2026-11-27] record | 여러 단어 검색의 복합어 공백 보완

- 회원 검색과 모의 검색에서 한글 음절만 3자 이상인 각 단어의 공백 비교를 보완했습니다. 격리 MySQL 평가에서 독립 검색의 관련 글 누락 4개를 모두 회복했고, 새 10개 사례의 상위 5개 적중은 1/5에서 5/5로 늘었습니다. 변경 후 API 호출 822회에서 공개 범위 위반은 없었습니다. 합성 글 1만 건 부하에서 복합어가 포함된 전체 범위 첫 페이지 API p95는 59.50 → 76.98ms였습니다. [검증 결과와 재실행](topics/community-operations.md#여러-단어-검색의-띄어쓰기-개선-검증)

## [2026-11-27] record | 후속 DTO와 조회 최적화 검토

- `backend`의 `e543b6b` 기준으로 주요 DTO 적용 범위를 다시 확인했습니다. 일정·알림·메모 응답과 관리자·문의·AI 응답의 [후속 DTO 후보](topics/application.md#후속-dto-후보)를 정리했습니다.
- 가계부·월급 INSERT의 생성 키 사용, 월급 동기화의 월별 조회 일괄 처리와 기존 응답의 스키마 누락을 [별도 최적화](topics/application.md#dto와-별도로-검토할-최적화)에 기록했습니다. 코드 변경과 응답 시간 측정은 수행하지 않았습니다.

## [2026-11-27] record | 배포 준비 문서·설정과 지도 응답 DTO

- [앱 구조와 실행 모드](topics/application.md)에 운영 빌드, 프록시 헤더, 오류 응답 형식, 시스템 구성도, OpenAPI 대조 결과를 반영했습니다. 지도·장소 리뷰 응답 11곳의 DTO 적용도 기록했습니다.
- [외부 서비스와 AI](topics/service-integrations.md)에 서버 모드의 AI 연결 실패 안내와 처리방침 외부 전송 4곳을 반영했습니다. 처리방침 1번에 동네 인증 위치(GPS)가 빠져 있다는 점은 미해결로 남겼습니다.
- [데이터베이스와 검증](topics/database.md)에는 약관 동기화 마이그레이션의 격리 MySQL 검증과 운영 DB 생성 절차 연결을 적었습니다. [계약 고정 지출](topics/fixed-expenses.md)에는 `homeManaged`를 적었습니다.
- [구현·검증 현황](topics/project-status.md)에는 프록시 IP 해결과 잘못된 입력 점검(5xx 0건)을 적었습니다. [지도 장소 식별자](topics/map-place-ids.md#지도-응답-dto)에는 지도 응답 DTO와 확인 방법(바꾸기 전 고정한 모양 테스트, 임시 MySQL에서 바꾸기 전·후 서버 응답 24개 비교)을 적었습니다.
- 남은 일: 화면에서 쓰지 않는 API 정리 여부, 처리방침 GPS 문구, 남은 요청 DTO 14곳과 응답 약 55곳(문원 님과 범위 조율), 10단계 로컬 통합 테스트.

## [2026-11-28] record | 최신 dev와 동네 검색 작업 병합

- `backend`를 `e543b6b`에서 `dev`의 `731e329`까지 fast-forward했습니다. 작업 복구 중 이 로그 끝부분의 충돌을 원격 운영 기록과 로컬 검색 평가 기록을 모두 보존해 해결했습니다. 다른 변경은 자동으로 합쳐졌습니다. [원격 기준 비교](https://github.com/teammzip/project-ZIP/compare/e543b6bf88c3d3246e8d1443b5223cc9435c9593...731e32941268635c45bf6b61d759f39339b270a1)
- 복합어 검색을 [API 계약](../frontend/API.md#동네-게시글-검색), [검색 규칙과 검증](topics/community-operations.md#검색-정렬과-관련도), [변경 기록](../CHANGELOG.md)에서 대조했습니다. 프론트 213개, 린트, 운영 빌드, DB 정적 7개와 격리 MySQL 9.6의 73단계가 통과했습니다. DB 검증은 `20261127_01_terms_privacy_transfers.sql`을 포함합니다. [배포 환경에서 남은 검증](topics/project-status.md#검증해야-될-부분)
- 병합 후 실행 JAR과 격리 MySQL에서 합성 검색어 40개를 다시 실행했습니다. API 요청 369건의 공개 범위 위반은 0건이었고, 복합어 평가의 기대 글 5개가 모두 상위 5개에 들었습니다. 결과가 없어야 하는 복합어 검색 5개는 모두 0건을 반환했습니다. [복합어 평가 사례](../db/tests/community-search/multiword-spacing-holdout-v1.json) · [독립 평가 사례](../db/tests/community-search/independent-v1.json)
- 백엔드 전체 369개가 실패·오류·건너뜀 없이 통과했습니다. 실행 JAR 빌드와 OpenAPI 경로 115개의 YAML 구문 및 중복 키 검사도 통과했습니다. [백엔드 검증 명령](../.github/workflows/test.yml)

## [2026-11-26] record | CI 액션 버전 올림
- PR #147에서 [테스트 워크플로](../.github/workflows/test.yml)가 처음 실행되어 backend·frontend·db가 모두 통과했고, `actions/setup-java@v4`·`actions/setup-node@v4`가 Node.js 20 기반(지원 종료)이라는 경고 4건이 나왔습니다. `setup-java`·`setup-node`·`upload-artifact`를 v5로 올리고 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)의 CI 설명을 갱신했습니다.

## [2026-11-26] record | 배포 전 전체 점검
- 보안 설정·환경변수·토큰 저장·사진 접근·탈퇴·오류 응답·입력 제한·남용 제한의 저장 위치를 코드와 대조했습니다. 운영 빌드의 가짜 API 기본값, 배포 구성(같은 주소 권장·배포 파일 없음), 커뮤니티 쓰기 횟수 제한 없음, 메모리 기반 제한을 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)에 기록했습니다. 코드는 바꾸지 않았습니다.

## [2026-11-27] record | dev PR #148~#150 반영 후 배포 점검 항목 갱신
- dev `731e329`을 받으면서 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)의 배포 전 점검 항목을 갱신했습니다. 운영 빌드의 가짜 API 문제는 `871f95e`에서 해결됐고, 배포 구성 전제와 환경변수는 [운영 배포 설정](../backend/README.md#운영-배포-설정)에 정리돼 있습니다. 병합 중 CI 설명 충돌은 dev의 인증 메일 설명과 이 작업의 CI 첫 실행 기록을 함께 남기는 방식으로 정리했습니다.

## [2026-11-27] record | 처리방침 마이그레이션 로컬 적용과 남은 항목 재확인
- 로컬 개발 DB에 `20261127_01_terms_privacy_transfers.sql`을 적용했습니다. 처리방침 본문만 바뀌었고, 새 DB에 `schema.sql`을 넣어 약관 3종 본문이 같은지 대조했습니다. 적용 전에는 DB를 전체 백업했습니다.
- dev `731e329` 기준으로 남은 항목을 다시 확인했습니다. 처리방침 수집 항목에서 빠진 부분을 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)에 기록했습니다. 비밀번호 재설정 시 모든 세션을 끝내는 것과, 저장소 스키마·마이그레이션에 회원 계정을 넣지 않는 것도 확인했습니다.

## [2026-11-28] record | 코드베이스 전체 분석 결과 기록
- dev `731e329`를 기준으로 백엔드 엔드포인트 156개를 프론트 호출과 대조했습니다. 함께 보안·토큰·예약 작업·데이터 흐름도 코드에서 확인했습니다. 새로 확인한 항목은 [구현·검증 현황](topics/project-status.md#구현해야-될-부분)에 기록했습니다. AI 질문 대기 시간 불일치, 조회수 중복 증가, 예약 작업 실패 기록, 화면이 부르지 않는 API 17개, 목록 동기화의 거절 처리, 미연결 사진 정리, 미사용 뷰입니다. 코드는 바꾸지 않았습니다.

## [2026-11-28] record | 쓰레기 배출일 알림 제거와 홈 알림 칸 정리
- 사용자 결정으로 쓰레기 배출일 알림을 없앴습니다. 일정 화면의 우리 동네 배출표 보기가 있어 알림은 없어도 된다는 판단입니다. 서버의 예약 작업과 테스트, 설정을 지웠고, 오래된 알림 정리에서 "배출 정보가 없어요" 안내를 지우지 않던 예외도 없앴습니다. 설정 화면·내 집 주소 안내·소개 화면 문구도 고쳤습니다. 지난 동작은 [배출일 알림](topics/trash-schedules.md#배출일-알림)에 이력으로 남겼고, [일정·알림](topics/calendar-notifications.md), [앱 구조](topics/application.md), [구현·검증 현황](topics/project-status.md), [색인](index.md)도 갱신했습니다.
- 홈 알림 칸이 읽은 알림까지 보여 주던 것을 안 읽은 알림만 보이게 고쳤습니다. 읽은 알림은 알림 전체 보기에서 봅니다. 새 테스트(`frontend/tests/home-noti-card.test.mjs`)는 고치기 전 코드에서는 실패하고 고친 코드에서는 통과하는 것을 확인했습니다. [일정·알림](topics/calendar-notifications.md)
- 위키 누락 검사에 걸린 [계약 고정 지출](topics/fixed-expenses.md)·[데이터베이스](topics/database.md)·[커뮤니티](topics/community-operations.md)·[가계부와 메모](topics/ledger-memos.md)·[내 집 정보](topics/home-info.md)·[지도](topics/map-place-ids.md)·[외부 서비스](topics/service-integrations.md)에 이번 변경과의 관계(영향 있음·없음)를 확인해 적었습니다.

## [2026-11-28] record | Claude Code용 작업 규칙 파일 분리

- Codex는 [AGENTS.md](../AGENTS.md)·[위키 AGENTS.md](AGENTS.md)를 읽고, Claude Code는 기본적으로 `CLAUDE.md`를 읽습니다. 2026-11-28 작업 대화에서 Claude Code 세션에 최상위 `AGENTS.md`가 처음부터 들어오지 않는 것을 확인했습니다.
- 도구별로 자기 파일만 읽도록 [CLAUDE.md](../CLAUDE.md)와 [위키 CLAUDE.md](CLAUDE.md)를 추가했습니다. 내용은 AGENTS 파일과 같고, 안의 링크만 Claude 파일끼리 가리킵니다. 네 파일 맨 위에 짝 파일과 함께 고치라는 안내를 넣었고, [색인](index.md)에 두 파일의 관계를 적었습니다.
- 할 일: 규칙을 고칠 때 AGENTS·CLAUDE 두 쌍을 같은 내용으로 유지해야 합니다. 어긋남을 자동으로 잡는 검사는 아직 없습니다.

## [2026-11-28] record | 화면에서 쓰지 않는 API 6개 삭제

- 결정(2026-11-28 작업 대화, 곽성미): 화면에서 부르지 않는 API 14개 중 "삭제 검토"로 분류한 6개를 지웠습니다. 예전 일반 고정 지출 5개(`/api/bills`, `/api/bills/{id}`, `/api/bills/{id}/payments/{month}`)와 일정 완료 전용 `PATCH /api/events/{id}/done`입니다. 화면은 각각 `/api/bills/monthly/**`와 `PATCH /api/events/{id}`의 `done`을 씁니다.
- 지우기 전에 확인한 것: 프론트(모의 모드 포함)에서 부르는 곳이 없었습니다. 서비스 메서드는 이 API들만 썼습니다. 예전 API 테스트 중 월별 API에 없던 동시 납부 검사는 [월별 테스트](../backend/src/test/java/com/zip/backend/BillIntegrationTests.java)로 옮겼습니다.
- 남은 일: 관리자 일괄 제재, 일정 검색, 홈 꿀팁 3개(DB `posts.is_home_tip`과 인덱스 포함), 생활 설정 2개는 팀 협의 후 결정합니다. 지역 목록은 유지합니다. [프론트 API 문서](../frontend/API.md) · [백엔드 구현 설명](../backend/IMPLEMENTATION.md#고정-지출-api-확인)

## [2026-11-28] record | 화면에 연결하지 않았던 API 4가지 연결

- 결정(2026-11-28 작업 대화): 변경안 자료 "ZIP API 변경안 한 장 요약"에서 네 가지를 골라 화면에 연결했습니다.
- [AI 대화 한 건 삭제](topics/service-integrations.md)와 [저장 리스트 이름·색 변경](topics/map-place-ids.md#장소-검색과-저장-리스트)을 연결했습니다. [다른 동네 주변 보기](topics/community-operations.md#동네-글과-조회-집계)도 넣었습니다.
- [알림 받기 서버 저장·복원](topics/calendar-notifications.md#알림-생성과-읽음-상태)을 연결했습니다. 그전에는 알림을 꺼도 서버의 월세 알림·공지 팝업이 생성됐습니다.
- 백엔드는 바꾸지 않았습니다. 프론트 테스트는 227개로 늘었고(새 11개), 린트·빌드가 통과했습니다. 지역 목록·인접 지역은 실행 중인 서버에서도 응답을 확인했습니다. 화면 동작은 브라우저에서 직접 확인해야 합니다.

## [2026-11-28] record | 공지 팝업을 홈에서만 표시

- 결정(2026-11-28 작업 대화, 곽성미): 공지 팝업은 홈(`/`)에서만 띄웁니다. 그전에는 틀(`AppLayout`)에 붙어 있어 지도·커뮤니티 등 어느 화면에서 새로고침해도 떴습니다.
- 팝업은 틀에 그대로 두고 주소가 홈일 때만 그립니다. 그래서 홈에서 닫은 뒤 다른 화면에 갔다 와도 다시 뜨지 않습니다. 공지 화면의 "팝업 공지 다시 보기"는 그 화면에서 바로 띄웁니다.
- 갱신: [공지사항 운영](topics/community-operations.md) · 검증: [팝업 표시 테스트](../frontend/tests/notice-popup-home.test.mjs) 3개, 프론트 230개·린트·빌드 통과

## [2026-11-28] record | 다른 동네 둘러보기 디자인 정리

- 결정(2026-11-28 작업 대화, 곽성미): 커뮤니티 "주변 동네" 탭의 다른 동네 보기가 머리말과 따로 노는 테두리 상자라 디자인을 바꿨습니다. 여는 버튼은 "동네 인증하기"와 같은 알약 모양으로 안내 줄 끝에 두고, 연 칸은 검색창과 같은 연회색 배경, 선택 상자는 테두리 없는 흰 상자, 결과는 칩으로 보여 줍니다. 이름은 "다른 동네 둘러보기"로 바꿨습니다.
- 기능(API · 고른 지역 · 이웃 이름 붙이기)은 바꾸지 않았습니다. 갱신: [커뮤니티 운영](topics/community-operations.md) · [프론트 API 문서](../frontend/API.md)

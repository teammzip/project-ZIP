# 구현·검증 현황

2026-11-24 확인 · GitHub `dev` `250b8d9`, 기존 `backend` `b0a937d` · 두 커밋의 파일 트리 동일. [위키 색인](../index.md) · [PR #137](https://github.com/teammzip/project-ZIP/pull/137) · [수집 및 검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완)

## 구현된 부분

| 영역 | 구현 문서 |
| --- | --- |
| 계정·인증 | [인증과 토큰 재발급](application.md#인증과-토큰-재발급) · [계정 전환과 브라우저 저장](application.md#서버-데이터와-브라우저-저장) |
| 주거·가계부 | [내 집 정보](home-info.md) · [가계부와 메모](ledger-memos.md) · [계약 고정 지출](fixed-expenses.md) |
| 일정·메모·알림 | [일정·알림](calendar-notifications.md) · [배출표](trash-schedules.md) · [폴더와 메모 동기화](ledger-memos.md#폴더와-메모-동기화) |
| 동네·지도 | [동네 글과 조회 집계](community-operations.md#동네-글과-조회-집계) · [지도](map-place-ids.md) · [홈 날씨 위치](service-integrations.md#홈-날씨-위치) |
| 지원·운영 | [문의·공지·회원 제재](community-operations.md#문의공지회원-제재) |
| AI·화면 | 모바일 레이아웃을 반영했습니다. [외부 서비스와 AI](service-integrations.md) · [화면 접근과 공통 모달](application.md#화면-접근과-공통-모달) |
| DB | [데이터베이스와 검증](database.md) · [리뷰 사진과 약관 마이그레이션 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |

PR #137에 해당하는 11월 24일 변경 기록은 `51cfc1a`로 `backend`에 반영됐습니다. [프로젝트 변경 기록](../../CHANGELOG.md) · [수집 당시 기록](../raw/index.md#2026-11-24--변경-기록-수집)

## 구현해야 될 부분

- [폴더 목록 갱신 문제](ledger-memos.md#확인된-폴더-문제)를 수정하고, 일반 생성과 가계부 초안에 같은 폴더 개수 제한을 적용해야 합니다.
- 메모·지도 화면의 `react(set-state-in-effect)` 경고 2건이 남아 있습니다. [MemoPage.tsx](../../frontend/src/pages/my/MemoPage.tsx) · [MapView.tsx](../../frontend/src/features/map/components/MapView.tsx)
- 루트 README의 배출표 상태 설명을 실제 조회 경로에 맞춰 갱신하고, 출시용 처리방침의 클라우드 업체·보관 국가를 확정해야 합니다. [배출표 문서 차이](trash-schedules.md#문서-간-차이) · [약관 현황](service-integrations.md)

## 검증된 부분

| 기준과 환경 | 결과 |
| --- | --- |
| `250b8d9` 로컬 점검 | 백엔드 320개, 프론트 192개, 프론트 빌드 통과. 린트 종료 코드 0, 경고 2건. [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |
| `250b8d9` DB 정적 검사·격리 MySQL 9.6 | [DB 검사 결과](database.md#db-검증-결과) |
| `250b8d9` 모바일 WebKit, 모의 API | 가계부 초안 나중에 쓰기·복구·확정·복귀·선택 삭제와 금액 보존을 확인. [가계부와 메모](ledger-memos.md) · [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |
| PR #132 당시 WebKit·격리 MySQL 9.6 | [계약월 비용·월세 알림 검증 결과](fixed-expenses.md#검증-결과) |
| 2026-11-20 실제 서버·격리 MySQL | 분리된 화면·API·DB에서 두 계정의 조회·수정 격리와 금액 일치 확인. 당시 작업 트리 기준의 역사적 검증입니다. [기존 검증 기록 출처](../raw/index.md#2026-11-24--작업과-검증-이력-보완) |

## 검증해야 될 부분

- **최신 서버 모드의 두 브라우저·두 계정**에서 폴더 변경·삭제 반영, 연결 오류 후 초안 확정 재시도, 재로그인 후 홈 정보 격리를 확인합니다. 모바일과 키보드 검증은 이번에 바뀐 메모 이어쓰기 화면을 포함합니다. [가계부와 메모](ledger-memos.md) · [내 집 정보](home-info.md)
- **팀 배포 DB의 적용 상태**에서 구형 기념일 컬럼·데이터와 전국 배출표·메모 폴더의 적용 여부를 확인합니다. 월말·연말과 시간대 경계에서는 서버 재기동 전후에 월급·계약 기록과 알림이 보존되고 중복되지 않는지 확인합니다. [데이터베이스와 검증](database.md) · [계약 고정 지출](fixed-expenses.md)
- **최신 배포의 외부 연동**에서 변경된 OAuth 콜백과 카카오 검색→즐겨찾기→리뷰 흐름을 확인합니다. 이메일·Gemini·GPS 등은 환경이나 경로가 변경된 경우 [기존 외부 서비스 검증 범위](service-integrations.md#검증-범위)를 다시 확인합니다.
- **운영 가계부 API 응답 시간**은 측정 대기 중입니다. 2026-11-24에 원격 `dev`·`backend`의 목록 코드가 행별 조회를 사용하는 것을 확인했습니다. 일괄 조회 변경은 로컬 작업 트리에서 확인했습니다. 운영 URL, 인증된 테스트 세션, 배포 버전이 확인되면 같은 회원·월을 기준으로 수입·지출 목록의 성공 응답 시간과 거래 건수를 기록합니다. [원격 목록 코드](https://github.com/teammzip/project-ZIP/blob/dev/backend/src/main/java/com/zip/backend/ledger/LedgerController.java#L42) · [가계부 목록 변경](ledger-memos.md#가계부-기록과-회원별-분류)

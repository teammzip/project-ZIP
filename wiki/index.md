# ZIP LLM Wiki

ZIP은 자취 생활에 필요한 일정, 가계부, 동네 정보 등을 한곳에서 관리하는 웹 서비스입니다. 이 위키에서 프로젝트 구조와 기능별 근거를 찾아볼 수 있습니다. [프로젝트 README](../README.md)

최신 확인 기준은 [구현·검증 현황](topics/project-status.md)에서 확인할 수 있습니다.

## 주제

| 페이지 | 담긴 내용 |
| --- | --- |
| [구현·검증 현황](topics/project-status.md) | 구현·검증의 완료 범위, 남은 작업, 실행 환경별 결과 |
| [앱 구조와 실행 모드](topics/application.md) | React·Spring API·MySQL, 로그인 잠금·인증 세션, 회원별 저장, 화면 접근·키보드 조작 |
| [내 집 정보와 대출](topics/home-info.md) | 첫 주거 설문·내 집 정보·대출 카드의 저장 API와 회원·세션별 공통 조회 |
| [계약 고정 지출과 월세 알림](topics/fixed-expenses.md) | 계약월 월세·별도 관리비, 납부 상태 보존, 월세 알림, 월급 자동 등록 |
| [가계부와 메모](topics/ledger-memos.md) | 회원별 수입·지출과 분류, 초안 이어쓰기, 메모 폴더 동기화와 확인된 문제 |
| [일정·기념일과 알림](topics/calendar-notifications.md) | 일정과 카테고리, 반복 기념일, 서버 알림 생성과 읽음 상태 |
| [커뮤니티·고객센터·관리자 운영](topics/community-operations.md) | 동네 인증·인기 글, 신고·회원 제재, 공지·문의 답변 |
| [지도 장소 식별자](topics/map-place-ids.md) | 장소의 키 형식, 카카오 검색과 DB 대체, 저장 리스트·리뷰 사진 |
| [외부 서비스와 AI](topics/service-integrations.md) | 이메일·소셜, Gemini·고지서, 지도·GPS, 약관과 실제 연동 확인 범위 |
| [데이터베이스와 검증](topics/database.md) | [신규 기능의 데이터 접근 계획](topics/database.md#신규-기능에-적용할-계획), 마이그레이션과 격리 MySQL 검증 |
| [우리 동네 쓰레기 배출표](topics/trash-schedules.md) | 주소별 배출표 조회·알림과 공공데이터 출처 |

## 위키 사용

- [원자료 목록](raw/index.md)에서 현재 파일과 수집 시점의 버전을 찾을 수 있습니다.
- [전체 PR 원자료](raw/pull-requests.md)에서 PR 설명·변경 파일·Git 버전과 별도 커밋 이력을 찾을 수 있습니다.
- [운영 규칙](AGENTS.md)에서 자료 수집, 작업 중 발견한 내용 기록, 질의와 점검 절차를 확인할 수 있습니다.
- [PR 문서 동기화](AGENTS.md#pr-문서-동기화)에서 관련 문서 누락 검사와 같은 PR에서 문서를 갱신하는 방법을 확인할 수 있습니다.
- [민감정보 검사](AGENTS.md#민감정보-검사)에서 Git 훅 설치와 검사 범위를 확인할 수 있습니다.
- [작업 로그](log.md)에서 수집 및 점검 이력을 볼 수 있습니다.

Codex에서 “`frontend/API.md` 변경을 위키에 반영해줘”, “쓰레기 배출표는 어디서 데이터를 가져와?”, “위키 링크와 오래된 주장을 점검해줘”처럼 요청하면 됩니다.

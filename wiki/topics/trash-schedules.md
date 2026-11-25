# 우리 동네 쓰레기 배출표

2026-11-24 코드 확인(주소 다시 찾기 · 출처 표시 반영) · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

1. 일정 화면의 `CalendarBoard`가 접힌 배출표를 렌더링합니다. 실제 서버 모드에서 로그인한 사용자가 펼치면 `GET /api/trash-schedules/me`를 호출합니다. 모의 API 모드에서는 서버 연결 안내를 표시합니다. [일정 화면](../../frontend/src/features/life/components/CalendarBoard.tsx) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [앱 실행 모드](application.md)
2. 서버는 내 집 주소로 먼저 시·군·구를 찾고, 내 집 주소가 비었거나 **그 주소로 시·군·구를 찾지 못하면**(직접 입력이라 "마포 합정동"처럼 시·군·구가 빠진 경우 등) 회원 주소로 다시 찾습니다(2026-11-24, `RegionMatcher.matchFirst`). 내 정보의 내 집 주소 칸에는 주소 검색(주거 설문과 같은 OpenStreetMap 동네 검색)이 있어, 시·도 · 시·군·구 · 동을 고른 뒤 상세주소를 이어서 입력합니다(2026-11-24). [내 집 주소 입력](../../frontend/src/features/life/components/MyInfo.tsx) 응답의 `items`에는 장소별 생활쓰레기·음식물·재활용 배출 요일과 시작 시각이 들어갑니다. [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-) · [서버 조회](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java) · [주소 순서대로 찾기](../../backend/src/main/java/com/zip/backend/auth/RegionMatcher.java)
3. 화면은 `regionName`이 `null`이면 주소로 지역을 찾지 못했다는 안내를 표시합니다. 지역 이름이 있고 `items`가 비어 있으면 해당 지역의 배출표가 없다는 안내를 표시합니다. 전국 자료가 필요한 DB의 적용 순서는 DB 문서에서 확인할 수 있습니다. [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [DB 안내](../../db/README.md) · [데이터베이스와 검증](database.md)

4. 표 아래에 공공데이터 출처(행정안전부 「전국생활쓰레기배출정보표준데이터」, 공공데이터포털)를 표시합니다. 이용약관 제2조 · 소개 페이지 푸터에도 같은 출처가 있습니다. [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx)

## 배출일 알림

배출일 알림은 배출표 조회와 같은 주소 우선순위를 사용합니다. 서버 스케줄러는 알림을 켠 회원에게 배출일 정해진 시각 이후 한 번 생성하며, 기본 시각은 한국 시간 0시이고 서버 설정으로 바꿀 수 있습니다. 배출표가 없는 동네의 안내는 회원·지역별로 한 번만 보냅니다. 이 "한 번만"은 안내 알림이 남아 있는지로 판단하므로, 6시간마다 도는 오래된 알림 정리(알릴 시각 90일 지난 알림 삭제, `zip.cleanup.*` 설정)에서도 이 안내는 지우지 않습니다(2026-11-24). [오래된 데이터 정리](../../backend/src/main/java/com/zip/backend/maintenance/DataCleanupService.java) · [배출 알림 서비스](../../backend/src/main/java/com/zip/backend/notification/TrashReminderService.java) · [서버 설정](../../backend/src/main/resources/application.properties)

배출 자료는 시·군·구 단위라 같은 지역 안에서 동별 요일이 다른 경우에는 현장 안내와 다를 수 있습니다. 백엔드 문서는 배출 알림의 중복 방지를 단일 서버 기준으로 설명합니다. 여러 서버가 스케줄러를 함께 실행하는 환경의 발송 이력은 별도 확인이 필요합니다. [백엔드 배출 알림 설명](../../backend/IMPLEMENTATION.md#쓰레기-배출표--배출일-알림)

PR #136의 격리 MySQL·WebKit 검증 범위는 기본 접힘, 주소별 조회와 오류 후 재시도였습니다. [변경 기록](../../CHANGELOG.md#프론트엔드)

## 문서 간 차이

초기 수집 커밋의 루트 README는 화면에 고정표가 남아 있다고 설명했지만, 화면 코드는 실제 서버 모드에서 API를 조회했습니다. 2026-11-24에 README를 현재 상태(일정 화면의 배출표 서버 조회 + 배출일 알림)로 고쳐 차이가 없어졌습니다. 배포 환경의 데이터 적용 상태는 별도 확인이 필요합니다. [루트 README](../../README.md) · [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx)

# 우리 동네 쓰레기 배출표

2026-11-24 코드 확인 · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

1. 일정 화면의 `CalendarBoard`가 접힌 배출표를 렌더링합니다. 실제 서버 모드에서 로그인한 사용자가 펼치면 `GET /api/trash-schedules/me`를 호출합니다. 모의 API 모드에서는 서버 연결 안내를 표시합니다. [일정 화면](../../frontend/src/features/life/components/CalendarBoard.tsx) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [앱 실행 모드](application.md)
2. 서버는 내 집 주소를 우선 사용하고, 내 집 주소가 비면 회원 주소를 사용해 시·군·구를 찾습니다. 응답의 `items`에는 장소별 생활쓰레기·음식물·재활용 배출 요일과 시작 시각이 들어갑니다. [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-) · [서버 조회](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java)
3. 화면은 `regionName`이 `null`이면 주소로 지역을 찾지 못했다는 안내를 표시합니다. 지역 이름이 있고 `items`가 비어 있으면 해당 지역의 배출표가 없다는 안내를 표시합니다. 전국 자료가 필요한 DB의 적용 순서는 DB 문서에서 확인할 수 있습니다. [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [DB 안내](../../db/README.md) · [데이터베이스와 검증](database.md)

## 배출일 알림

배출일 알림은 배출표 조회와 같은 주소 우선순위를 사용합니다. 서버 스케줄러는 알림을 켠 회원에게 배출일 정해진 시각 이후 한 번 생성하며, 기본 시각은 한국 시간 0시이고 서버 설정으로 바꿀 수 있습니다. 배출표가 없는 동네의 안내는 회원·지역별로 한 번만 보냅니다. [배출 알림 서비스](../../backend/src/main/java/com/zip/backend/notification/TrashReminderService.java) · [서버 설정](../../backend/src/main/resources/application.properties)

배출 자료는 시·군·구 단위라 같은 지역 안에서 동별 요일이 다른 경우에는 현장 안내와 다를 수 있습니다. 백엔드 문서는 배출 알림의 중복 방지를 단일 서버 기준으로 설명합니다. 여러 서버가 스케줄러를 함께 실행하는 환경의 발송 이력은 별도 확인이 필요합니다. [백엔드 배출 알림 설명](../../backend/IMPLEMENTATION.md#쓰레기-배출표--배출일-알림)

PR #136의 격리 MySQL·WebKit 검증 범위는 기본 접힘, 주소별 조회와 오류 후 재시도였습니다. [변경 기록](../../CHANGELOG.md#프론트엔드)

## 문서 간 차이

초기 수집 커밋의 루트 README는 화면에 고정표가 남아 있다고 설명합니다. 같은 커밋의 화면 코드에서는 실제 서버 모드에서 API를 조회하는 경로가 확인됩니다. 이 판단은 코드와 계약 검토에 근거하며 배포 환경의 데이터 적용 상태는 별도 확인이 필요합니다. [루트 README](../../README.md) · [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx)

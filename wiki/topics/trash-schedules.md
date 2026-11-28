# 우리 동네 쓰레기 배출표

2026-11-28 코드 확인(배출일 알림 제거) · 2026-11-24 코드 확인(주소 다시 찾기 · 출처 표시 반영) · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

1. 일정 화면의 `CalendarBoard`가 접힌 배출표를 렌더링합니다. 실제 서버 모드에서 로그인한 사용자가 펼치면 `GET /api/trash-schedules/me`를 호출합니다. 모의 API 모드에서는 서버 연결 안내를 표시합니다. [일정 화면](../../frontend/src/features/life/components/CalendarBoard.tsx) · [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [앱 실행 모드](application.md)
2. 서버는 내 집 주소로 먼저 시·군·구를 찾고, 내 집 주소가 비었거나 **그 주소로 시·군·구를 찾지 못하면**(직접 입력이라 "마포 합정동"처럼 시·군·구가 빠진 경우 등) 회원 주소로 다시 찾습니다(2026-11-24, `RegionMatcher.matchFirst`). 내 정보의 내 집 주소 칸에는 주소 검색(주거 설문과 같은 OpenStreetMap 동네 검색)이 있어, 시·도 · 시·군·구 · 동을 고른 뒤 상세주소를 이어서 입력합니다(2026-11-24). [내 집 주소 입력](../../frontend/src/features/life/components/MyInfo.tsx) 응답의 `items`에는 장소별 생활쓰레기·음식물·재활용 배출 요일과 시작 시각이 들어갑니다. [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-) · [서버 조회](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java) · [주소 순서대로 찾기](../../backend/src/main/java/com/zip/backend/auth/RegionMatcher.java)
3. 화면은 `regionName`이 `null`이면 주소로 지역을 찾지 못했다는 안내를 표시합니다. 지역 이름이 있고 `items`가 비어 있으면 해당 지역의 배출표가 없다는 안내를 표시합니다. 전국 자료가 필요한 DB의 적용 순서는 DB 문서에서 확인할 수 있습니다. [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx) · [DB 안내](../../db/README.md) · [데이터베이스와 검증](database.md)

4. 표 아래에 공공데이터 출처(행정안전부 「전국생활쓰레기배출정보표준데이터」, 공공데이터포털)를 표시합니다. 이용약관 제2조 · 소개 페이지 푸터에도 같은 출처가 있습니다. [배출표 컴포넌트](../../frontend/src/features/life/components/TrashScheduleDisclosure.tsx)
5. 배출표는 주소(내 집 주소 → 회원 주소)로만 지역을 찾고 회원 동네 인증(`users.region_id`)은 쓰지 않습니다. 2026-11-26 회원 응답 `region.fullName` 추가와 날씨·지도의 동네 선택 변경, [회원 응답 계약](../../frontend/API.md#user-모양)의 동네 설명 수정은 이 경로에 영향이 없습니다(임시 DB 서버에서 `GET /api/trash-schedules/me` 200 확인). [배출표 조회](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java)

## 배출일 알림

**2026-11-28에 없앴습니다.** 사용자가 일정 화면의 우리 동네 배출표 보기로 배출 요일을 확인할 수 있으니 알림은 없어도 된다고 결정했습니다. 그래서 서버의 배출 알림 예약 작업(`TrashReminderService` · `TrashReminderScheduler`)과 그 테스트, 설정(`zip.trash.reminder.*` · `TRASH_REMINDER_*`)을 지웠습니다. 설정 화면의 "알림 받기" 설명과 소개 화면 문구에서도 쓰레기 배출 알림을 뺐습니다. [백엔드 배출표 설명](../../backend/IMPLEMENTATION.md#쓰레기-배출표) · [알림 API](../../frontend/API.md)

- **이미 만든 알림**: 예전에 만든 `TRASH` 알림은 알림함에 그대로 보입니다. 예전에는 배출표가 없는 동네의 안내를 다시 보내지 않으려고, 오래된 알림 정리에서 이 안내만 지우지 않았습니다. 이제 다시 보낼 일이 없어서 이 예외를 없앴고, 알릴 시각이 90일 지난 알림은 종류와 상관없이 지웁니다. `notifications.noti_type`의 `TRASH` 값과 화면의 아이콘은 예전 알림을 보여 주려고 남겼습니다. [오래된 데이터 정리](../../backend/src/main/java/com/zip/backend/maintenance/DataCleanupService.java) · [알림 목록](../../frontend/src/features/life/notifications.ts)
- **당시 동작(2026-11-21 ~ 11-28, 이력)**: 동네는 배출표 조회와 같은 주소 우선순위로 찾았습니다. 알림을 켠 회원에게 배출일의 정해진 시각 이후 하루 한 번 알림을 만들었습니다. 시각은 처음에 아침 7시였고, 11-22부터 한국 시간 0시였습니다. 배출표가 없는 동네에는 안내를 회원·지역별로 한 번만 보냈습니다. 서버가 켜져 있을 때만 1분마다 확인했기 때문에, 서버가 꺼져 있던 날의 알림은 나중에도 만들지 않았습니다. 중복 방지는 서버 1대를 기준으로 했습니다. 지운 코드는 Git 이력에 있습니다. [변경 기록](../../CHANGELOG.md#백엔드)

배출 자료는 시·군·구 단위라, 같은 지역 안에서 동마다 요일이 다르면 현장 안내와 다를 수 있습니다.

PR #136의 격리 MySQL·WebKit 검증 범위는 기본 접힘, 주소별 조회와 오류 후 재시도였습니다. [변경 기록](../../CHANGELOG.md#프론트엔드)

## 문서 간 차이

초기 수집 당시 루트 README의 고정표 설명과 서버 조회 코드가 서로 달랐습니다. PR #144에서 README를 일정 화면의 배출표 조회와 배출일 알림에 맞게 갱신했습니다. 2026-11-28 알림을 없애면서 README 알림 목록에서도 쓰레기 배출을 뺐습니다. README에서 신규 DB에 전국 배출표 자료를 적용하는 순서도 확인할 수 있습니다. 배포 환경의 데이터 적용 상태는 [검증해야 될 부분](project-status.md#검증해야-될-부분)에서 추적합니다. [루트 README](../../README.md#지금-상태) · [전국 데이터](database.md#전국-데이터) · [배출표 조회 API 계약](../../frontend/API.md#3-일정--쓰레기-배출-)

2026-11-28 확인: [공용 API 문서](../../frontend/API.md)의 이번 변경(글 목록 `GET /api/posts`의 `regionId`, AI 대화 목록을 AI 화면으로 옮김, "다른 동네 둘러보기" 이름 변경)은 배출표 조회에 영향이 없습니다.

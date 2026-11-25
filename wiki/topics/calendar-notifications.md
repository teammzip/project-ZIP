# 일정·기념일과 알림

2026-11-24 확인 · GitHub `dev` `250b8d9` · [PR 원자료](../raw/pull-requests.md) · [위키 색인](../index.md)

## 일정 저장과 반복 기념일

- 일정 화면에 할 일을 함께 표시합니다. 서버 모드에서는 일정·카테고리·항목 버튼을 각각 `/api/events`, `/api/event-categories`, `/api/event-presets`에서 회원별로 관리합니다. 일반 일정은 완료할 때 완료 시각을 저장하고, 완료를 해제하면 시각을 지웁니다. [일정 컨트롤러](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) · [일정 서비스](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java)
- 기념일은 원본 한 행에 저장하고 시간·카테고리·완료를 적용하지 않습니다. 매년 반복은 기념일만 지원합니다. 조회한 원본을 화면에서 연도별로 표시하며, 2월 29일은 평년에 2월 28일로 표시합니다. [화면 계산](../../frontend/src/features/life/derive.ts) · [DB 저장 계약](../../db/README.md#일정과-카테고리) · [기념일 마이그레이션](database.md#기념일-마이그레이션)
- 카테고리를 삭제하면 일정과 사용자가 직접 만든 항목은 미분류로 옮깁니다. 미분류에 같은 이름의 버튼이 있으면 하나만 남깁니다. 화면은 카테고리 변경 후 서버에서 일정 목록을 다시 읽습니다. [카테고리 저장](../../backend/src/main/java/com/zip/backend/calendar/CalendarRepository.java) · [일정 동기화](../../frontend/src/features/life/calendarSync.ts)

## 알림 생성과 읽음 상태

알림은 알릴 시각에서 90일(설정 `zip.cleanup.notification-days`)이 지나면 읽음 여부와 관계없이 서버가 6시간마다 지웁니다. 단 쓰레기 "배출 정보가 없어요" 안내는 (회원, 동네)마다 한 번만 보내는 기록이라 지우지 않습니다(2026-11-24). [오래된 데이터 정리](../../backend/src/main/java/com/zip/backend/maintenance/DataCleanupService.java)

| 종류 | 생성 시점과 표시 |
| --- | --- |
| 일정·기념일 | 알림 목록 조회 시 오늘부터 3일 뒤까지 갱신합니다. 일정이 바뀌거나 완료되면 관련 미확인 알림을 갱신하거나 정리합니다. 반복 기념일은 발생 날짜별로 구분합니다. [일정 알림](../../backend/src/main/java/com/zip/backend/notification/LifeNotificationService.java) |
| 월세·배출일 | [월세 알림](fixed-expenses.md#월세-알림) · [배출일 알림](trash-schedules.md#배출일-알림). 배출표 조회와 배출일 알림은 내 집 주소로 시·군·구를 먼저 찾고 회원 주소를 다음으로 확인합니다. 가입 시 주소 입력은 선택입니다. 두 주소 모두 시·군·구를 확인할 수 없으면 배출표 화면에 주소 안내를 표시합니다. [회원가입 주소 계약](../../frontend/API.md#회원가입) · [배출표 조회와 안내](trash-schedules.md) |
| 댓글·운영 | 댓글·답글, 관리 조치, 문의 답변, 공지 등 해당 동작에서 생성합니다. [커뮤니티와 운영](community-operations.md) · [알림 서비스](../../backend/src/main/java/com/zip/backend/notification/NotificationService.java) |

`GET /api/notifications`는 본인 알림을 `status`(`all`, `unread`, `read`)로 필터링하고 `{ items, unreadCount }`를 반환합니다. `PATCH /api/notifications/read`에 빈 `ids` 배열을 보내면 전체를 읽음 처리합니다. `DELETE /api/notifications`는 읽은 알림만 삭제합니다. 홈 위젯의 당일 숨김은 현재 브라우저에 보관되는 화면 설정입니다. [알림 API 계약](../../frontend/API.md#6-알림-) · [알림 컨트롤러](../../backend/src/main/java/com/zip/backend/notification/NotificationController.java)

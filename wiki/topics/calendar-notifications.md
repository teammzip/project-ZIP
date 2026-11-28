# 일정·기념일과 알림

2026-11-24 확인 · GitHub `dev` `250b8d9` · [PR 원자료](../raw/pull-requests.md) · [위키 색인](../index.md)

## 일정 저장과 반복 기념일

- 완료 표시는 일반 수정 `PATCH /api/events/{id}`의 `done`으로 저장합니다. 완료로 바뀔 때만 `done_at`을 적고, 해제하면 지웁니다. 화면이 쓰지 않던 완료 전용 `PATCH /api/events/{id}/done`은 2026-11-28에 지웠습니다. [일정 API](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) · [완료 표시 테스트](../../backend/src/test/java/com/zip/backend/calendar/CalendarIntegrationTests.java)

- 일정 화면에 할 일을 함께 표시합니다. 서버 모드에서는 일정·카테고리·항목 버튼을 각각 `/api/events`, `/api/event-categories`, `/api/event-presets`에서 회원별로 관리합니다. 일반 일정은 완료할 때 완료 시각을 저장하고, 완료를 해제하면 시각을 지웁니다. [일정 컨트롤러](../../backend/src/main/java/com/zip/backend/calendar/CalendarController.java) · [일정 서비스](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java)
- 기념일은 원본 한 행에 저장하고 시간·카테고리·완료를 적용하지 않습니다. 매년 반복은 기념일만 지원합니다. 조회한 원본을 화면에서 연도별로 표시하며, 2월 29일은 평년에 2월 28일로 표시합니다. [화면 계산](../../frontend/src/features/life/derive.ts) · [DB 저장 계약](../../db/README.md#일정과-카테고리) · [기념일 마이그레이션](database.md#기념일-마이그레이션)
- 2026-11-26 같은 [화면 계산](../../frontend/src/features/life/derive.ts) 파일의 동네 인증 판정만 고쳤고 기념일 · 일정 계산은 바뀌지 않았습니다. 프론트 테스트 207개가 통과했습니다. 동네 인증 규칙은 [커뮤니티 문서](community-operations.md#동네-글과-조회-집계)에 있습니다.
- 카테고리를 삭제하면 일정과 사용자가 직접 만든 항목은 미분류로 옮깁니다. 미분류에 같은 이름의 버튼이 있으면 하나만 남깁니다. 화면은 카테고리 변경 후 서버에서 일정 목록을 다시 읽습니다. [카테고리 저장](../../backend/src/main/java/com/zip/backend/calendar/CalendarRepository.java) · [일정 동기화](../../frontend/src/features/life/calendarSync.ts)

### 일정 응답 DTO

2026-11-28에 `5574d0a`를 기준으로 `CalendarEventResponse`를 적용했습니다. `GET /api/events`와 `GET /api/events/search`는 일정 배열을 반환합니다. `POST /api/events`는 `201`과 등록한 일정, `PATCH /api/events/{id}`는 `200`과 수정한 일정을 반환합니다. 네 응답은 OpenAPI의 `Event` 항목을 공유합니다. [일정 응답 DTO](../../backend/src/main/java/com/zip/backend/calendar/CalendarEventResponse.java) · [OpenAPI Event 스키마](../../backend/openapi.yaml#L2426) · [프론트 연동](../../frontend/src/features/life/calendarSync.ts)

응답은 `id`, `date`, `time`, `title`, `category`, `done`, `source`, `anniv`, `yearly`를 항상 포함합니다. ID는 문자열, 날짜는 `YYYY-MM-DD`, 시간은 `HH:MM`이고 종일이면 빈 문자열입니다. 분류를 지정하지 않은 일정은 `category`에 `null`을 보냅니다. 직접 입력과 월세 출처는 각각 `USER`와 `RENT`로 표시합니다. [일정 서비스](../../backend/src/main/java/com/zip/backend/calendar/CalendarService.java) · [응답 계약 통합 테스트](../../backend/src/test/java/com/zip/backend/calendar/CalendarIntegrationTests.java#L108)

## 알림 생성과 읽음 상태

- 2026-11-28부터 내 정보의 **알림 받기**를 서버(`PUT /api/me/settings`)에도 저장합니다. 그전에는 브라우저에만 저장해서, 알림을 꺼도 서버가 `noti_on`을 보고 만드는 월세 알림·공지 팝업이 계속 생성됐습니다. 저장할 때는 GET으로 받은 최신 월세·기간 값에 `notiOn`만 바꿔 보내고, 실패하면 화면을 되돌립니다. 앱을 열 때 내 집 정보 응답의 `settings.notiOn`으로 복원합니다. [알림 설정 저장](../../frontend/src/features/life/settingsApi.ts) · [알림 스위치](../../frontend/src/features/life/components/MyInfo.tsx) · [검증](../../frontend/tests/life-settings-noti.test.mjs)

알림은 알릴 시각에서 90일(설정 `zip.cleanup.notification-days`)이 지나면 읽음 여부와 관계없이 서버가 6시간마다 지웁니다. 2026-11-24부터 쓰레기 "배출 정보가 없어요" 안내는 지우지 않았지만, 2026-11-28 배출일 알림을 없애면서 이 예외도 없앴습니다([배출일 알림](trash-schedules.md#배출일-알림)). [오래된 데이터 정리](../../backend/src/main/java/com/zip/backend/maintenance/DataCleanupService.java)

| 종류 | 생성 시점과 표시 |
| --- | --- |
| 일정·기념일 | 알림 목록 조회 시 오늘부터 3일 뒤까지 갱신합니다. 일정이 바뀌거나 완료되면 관련 미확인 알림을 갱신하거나 정리합니다. 반복 기념일은 발생 날짜별로 구분합니다. [일정 알림](../../backend/src/main/java/com/zip/backend/notification/LifeNotificationService.java) |
| 월세·배출일 | [월세 알림](fixed-expenses.md#월세-알림). 배출일 알림은 2026-11-28에 없앴습니다([배출일 알림](trash-schedules.md#배출일-알림)). 배출표 조회는 내 집 주소로 시·군·구를 먼저 찾고 회원 주소를 다음으로 확인합니다. 가입 시 주소 입력은 선택입니다. 두 주소 모두 시·군·구를 확인할 수 없으면 배출표 화면에 주소 안내를 표시합니다. [회원가입 주소 계약](../../frontend/API.md#회원가입) · [회원 주소 변경 계약](../../frontend/API.md#회원-주소-변경) · [배출표 조회와 안내](trash-schedules.md) |
| 댓글·운영 | 댓글·답글, 관리 조치, 문의 답변, 공지 등 해당 동작에서 생성합니다. [커뮤니티와 운영](community-operations.md) · [알림 서비스](../../backend/src/main/java/com/zip/backend/notification/NotificationService.java) |

`GET /api/notifications`는 본인 알림을 `status`(`all`, `unread`, `read`)로 필터링하고 `{ items, unreadCount }`를 반환합니다. `PATCH /api/notifications/read`에 빈 `ids` 배열을 보내면 전체를 읽음 처리합니다. `DELETE /api/notifications`는 읽은 알림만 삭제합니다. 홈 알림 칸은 안 읽은 알림만 보여 주고(2026-11-28, 읽은 알림은 알림 전체 보기에서 확인), 홈 위젯의 당일 숨김은 현재 브라우저에 보관되는 화면 설정입니다. [홈 알림 칸](../../frontend/src/features/life/components/HomePhotoCard.tsx) [알림 API 계약](../../frontend/API.md#6-알림-) · [알림 컨트롤러](../../backend/src/main/java/com/zip/backend/notification/NotificationController.java)

### 알림 목록 응답 DTO 검토

2026-11-28에 `6c6079e`를 기준으로 `GET /api/notifications`의 `Map` 응답을 `NotificationListResponse`와 내부의 `Item` 레코드로 바꿨습니다. 프론트는 기존 `ServerNoti` 구조로 각 항목을 읽습니다. 읽음 처리 요청은 `ReadInput` 레코드를 사용하고 읽음·삭제는 `204`로 응답합니다. [목록 응답 DTO](../../backend/src/main/java/com/zip/backend/notification/NotificationListResponse.java) · [알림 컨트롤러](../../backend/src/main/java/com/zip/backend/notification/NotificationController.java) · [프론트 타입](../../frontend/src/features/life/notifications.ts#L14)

- 문자열 `id`와 `refId`, ISO 형식 `notifyAt`, `body`·`link`·`refId`의 명시적 `null`을 보존합니다. OpenAPI의 목록 스키마와 항목의 `nullable`을 실제 응답에 맞췄습니다. 배출일 알림 제거 전에 저장된 항목은 `TRASH`로 조회될 수 있습니다. [알림 스키마](../../backend/openapi.yaml#L2628) · [프론트 이동 규칙](../../frontend/src/features/life/notifications.ts#L30)
- `items`는 필터에 맞는 최신 100건까지, `unreadCount`는 필터 및 목록 상한과 무관하게 회원의 표시 가능한 미읽음 전체 건수를 반환합니다. 통합 테스트가 응답 필드 전체와 100건을 넘어도 유지되는 미읽음 수를 확인합니다. [목록·건수 조회](../../backend/src/main/java/com/zip/backend/notification/NotificationRepository.java#L37) · [응답 계약 통합 테스트](../../backend/src/test/java/com/zip/backend/notification/NotificationIntegrationTests.java#L71) · [기존 배출일 알림 테스트](../../backend/src/test/java/com/zip/backend/notification/LifeNotificationIntegrationTests.java#L113)

2026-11-28 확인: [OpenAPI](../../backend/openapi.yaml)와 [공용 API 문서](../../frontend/API.md)의 이번 변경(글 목록 `GET /api/posts`의 `regionId`, AI 대화 목록을 AI 화면으로 옮김, "다른 동네 둘러보기" 이름 변경)은 알림 목록·읽음·삭제 API와 응답 모양에 영향이 없습니다.

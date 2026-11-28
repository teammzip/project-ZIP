# 계약 고정 지출과 월세 알림

2026-11-24 확인 · [수집 기준](../raw/index.md#2026-11-24--작업과-검증-이력-보완) · [위키 색인](../index.md)

입주월과 계약 만료월이 모두 저장된 월세 계약은 두 달을 모두 포함합니다. 가계부에서 계약 기간의 과거 또는 현재 월을 열면 그 달에 빠진 월세와 별도 관리비를 저장된 계약 금액으로 등록합니다. 이 기간과 금액은 내 집 정보 API에서 저장한 계약 값으로 정합니다. 납부일이 내 집 정보 저장일보다 앞선 달에도 같은 규칙을 적용합니다. 월별 조회는 먼저 `POST /api/bills/monthly/auto-register`를 호출한 뒤 `GET /api/bills/monthly`를 읽습니다. [내 집 정보](home-info.md) · [내 집 정보 저장 API](../../frontend/API.md#내-집-정보-서버-연결-2026-11-15) · [프론트 요청](../../frontend/src/features/life/billsApi.ts) · [자동 등록과 계약 범위](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java)

- 신규 행은 미납으로 생성하며, 기존 월의 기록과 납부 상태·시각은 보존합니다. 화면에서 월세·계약 별도 관리비는 `미납` 또는 `납부 완료`로 표시합니다. 관리비 포함 계약은 관리비를 따로 만들지 않습니다. [월별 기록 처리](../../backend/src/main/java/com/zip/backend/bills/BillService.java) · [고정 지출 화면](../../frontend/src/features/life/components/MonthlyFixedExpense.tsx)
- 미래 월과 계약 밖 월에는 새 계약 비용을 자동 등록하지 않습니다. 이미 저장된 월별 기록의 조회는 별도입니다. 과거 계약월 보충은 양 끝 날짜가 있는 월세 계약에 적용하며, 전세 대출 이자와 날짜가 부족한 계약은 현재 월 규칙을 따릅니다. [자동 등록 조건](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java) · [전세 대출](home-info.md)

## 월세 알림

알림을 켠 월세 계약은 저장된 납부 시간대의 납부 3일 전부터 당일까지 미납 월세에 대해 서버 스케줄러가 월 1회 알립니다. 기존 날짜형 월세 링크도 같은 달의 가계부로 연결되며, 기존 알림이 있으면 신규 알림이 중복 생성되지 않습니다. [월세 알림 서비스](../../backend/src/main/java/com/zip/backend/notification/RentReminderService.java) · [중복 판정](../../backend/src/main/java/com/zip/backend/notification/NotificationRepository.java) · [화면 링크](../../frontend/src/features/life/notifications.ts)

2026-11-28부터 홈 알림 칸은 안 읽은 알림만 보여 주므로, 읽은 월세 알림은 알림 전체 보기에서만 보입니다. 같은 날 알림 종류에서 쓰레기 배출일(`TRASH`) 알림 생성이 없어졌지만, 월세 알림의 생성 규칙과 링크(`budget` · 납부 대상 연월)는 바뀌지 않았습니다. [홈 알림 칸](../../frontend/src/features/life/components/HomePhotoCard.tsx) · [알림 종류](../../frontend/src/features/life/notifications.ts) · [배출일 알림 제거](trash-schedules.md#배출일-알림)

## 일반 고정 지출의 납부와 해지

등록된 월별 항목은 납부 또는 납부 취소 처리가 가능합니다. 납부 완료 항목을 수정하거나 해당 월 기록을 지우려면 먼저 납부 취소가 필요합니다. 월별 삭제는 해당 월 기록을 삭제 표시하며, 해지는 입력한 적용일부터 미납·예정 기록의 집계에 적용합니다. 적용일 전 기록과 이미 납부한 기록은 보존합니다. 계약 항목의 종료 조건은 내 집 정보에서 관리합니다. [PR #111](https://github.com/teammzip/project-ZIP/pull/111) · [고정 지출 서비스](../../backend/src/main/java/com/zip/backend/bills/BillService.java) · [월별 등록·수정 요청](../../frontend/src/features/life/billsApi.ts) · [납부·해지 계약](../../frontend/API.md#고정-지출-납부--해지-2026-11-19)

월별 등록은 `MonthlyCreate`, 수정은 `MonthlyDetails`로 본문을 검증한 뒤 서비스에 전달합니다. 사진 고지서 확정도 같은 등록 검증을 사용합니다. 등록·수정은 `BillResponse`로 저장된 청구를, 조회는 `BillResponse.Monthly`로 일반 항목·주거 항목·계약 기간을 반환합니다. 미납 항목의 `paidAt`은 `null`이며 연결 메모가 없으면 `memoId`와 `memoTitle`을 생략합니다. [입력 DTO](../../backend/src/main/java/com/zip/backend/bills/BillInput.java) · [응답 DTO](../../backend/src/main/java/com/zip/backend/bills/BillResponse.java) · [사진 고지서](../../backend/src/main/java/com/zip/backend/bills/BillPhotoController.java) · [월별 등록 통합 테스트](../../backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java)

월별 목록(`GET /api/bills/monthly`)의 일반 항목에는 `homeManaged`가 붙습니다. 내 집 계약에서 생긴 항목이거나 내 집 정보가 관리하는 관리비면 `true`입니다. 다른 응답에서는 이 칸을 생략합니다. 2026-11-27에 [OpenAPI](../../backend/openapi.yaml)의 `Bill` 스키마에 이 칸을 추가해 `BillResponse`와 칸 이름을 맞췄습니다. [월별 목록 응답](../../backend/src/main/java/com/zip/backend/bills/BillService.java#L31) · [계약 고정 지출 자동 등록 응답 계약](../../frontend/API.md#계약-고정-지출-자동-등록)

## 월급 자동 등록

서버 연결 모드에서 월급 설정을 저장한 달부터, 선택한 시간대에서 수령일이 된 월급을 가계부 고정 수입에 등록하고 월별 수입 합계에 포함합니다. 설정 저장과 가계부 수입 조회 때 누락 기록을 채웁니다. 회원·월별 등록 기록으로 중복 생성과 삭제 후 재등록을 막습니다. 수입 정보 화면은 저장 후 가계부 조회를 갱신합니다. [월급 서비스](../../backend/src/main/java/com/zip/backend/ledger/SalaryService.java) · [가계부 수입 조회와 합계](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java) · [수입 정보 화면](../../frontend/src/features/life/components/SalaryInfo.tsx) · [월급 회귀 테스트](../../backend/src/test/java/com/zip/backend/SalaryIntegrationTests.java)

### 월급 설정 응답 DTO

첫 주거 설문은 `PENDING` 상태에서만 답변을 반영합니다. 수령일 없는 월급 답변은 금액과 수입 기준을 초안으로 보관합니다. 마이페이지의 수입 정보에서는 `GET /api/me/salary`로 설정 또는 초안을 읽고 `PUT /api/me/salary`로 금액·월/연 기준·수령일을 저장합니다. 저장이 성공하면 초안은 지워지고 이미 등록된 월급 기록은 보존됩니다. [첫 주거 설문](home-info.md#내-집-정보와-첫-주거-설문의-dto) · [월급 API](../../backend/src/main/java/com/zip/backend/ledger/SalaryController.java) · [수입 정보 화면](../../frontend/src/features/life/components/SalaryInfo.tsx)

월급 `GET`·`PUT`은 `SalarySettingsResponse`를 반환합니다. 수령일까지 설문에 입력했으면 수입 정보에서 확정 설정을 바로 조회합니다. 수령일이 없으면 조회 응답의 `draft`에 금액과 월·연 기준이 포함되며, 수입 정보에서 저장한 뒤에는 확정 설정만 돌아옵니다. 미설정 `startMonth: ""`, 초안이 없을 때의 `draft` 생략, 0원 자동 등록 중단을 유지합니다. 설문 완료는 계속 `UserResponse`를 반환합니다. [응답 DTO](../../backend/src/main/java/com/zip/backend/ledger/SalarySettingsResponse.java) · [응답 스키마](../../backend/openapi.yaml) · [프론트 응답 타입](../../frontend/src/features/life/salaryApi.ts) · [설문·수입 정보 통합 테스트](../../backend/src/test/java/com/zip/backend/HousingOnboardingTests.java)

## 검증 결과

PR #132의 격리 MySQL·WebKit 검증에서 계약월 월세·별도 관리비 합계, 납부 기록 보존, 월세 알림 중복 방지와 링크 이동을 확인했습니다. 서버 재기동과 시간대 경계를 한 번에 확인하는 배포 환경 시나리오는 [구현·검증 현황](project-status.md#검증해야-될-부분)에 남겨 두었습니다. [변경 기록](../../CHANGELOG.md#백엔드) · [계약 자동 등록 테스트](../../backend/src/test/java/com/zip/backend/ContractAutoRegisterTests.java) · [월세 알림 테스트](../../backend/src/test/java/com/zip/backend/notification/RentReminderTests.java)

2026-11-26 `dev` `6bdff48` 기준으로 [OpenAPI](../../backend/openapi.yaml)의 `SalarySettings` 스키마와 [월급 응답 DTO](../../backend/src/main/java/com/zip/backend/ledger/SalarySettingsResponse.java)를 대조했습니다. 칸 6개(`amount`·`incomePeriod`·`monthlyAmount`·`paymentDay`·`startMonth`·`draft`)가 같고, 초안이 없으면 `draft`를 생략하는 점도 일치합니다. 같은 날의 OpenAPI 변경(인증 메일·사진 업로드의 429 응답, 글 목록 설명)은 월급 경로에 영향이 없습니다.

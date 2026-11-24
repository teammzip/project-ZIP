# 계약 고정 지출과 월세 알림

2026-11-24 확인 · [수집 기준](../raw/index.md#2026-11-24--작업과-검증-이력-보완) · [위키 색인](../index.md)

입주월과 계약 만료월이 모두 저장된 월세 계약은 두 달을 모두 포함합니다. 가계부에서 계약 기간의 과거 또는 현재 월을 열면 그 달에 빠진 월세와 별도 관리비를 저장된 계약 금액으로 등록합니다. 납부일이 내 집 정보 저장일보다 앞선 달에도 같은 규칙을 적용합니다. 월별 조회는 먼저 `POST /api/bills/monthly/auto-register`를 호출한 뒤 `GET /api/bills/monthly`를 읽습니다. [내 집 정보](home-info.md) · [프론트 요청](../../frontend/src/features/life/billsApi.ts) · [자동 등록과 계약 범위](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java)

- 신규 행은 미납으로 생성하며, 기존 월의 기록과 납부 상태·시각은 보존합니다. 화면에서 월세·계약 별도 관리비는 `미납` 또는 `납부 완료`로 표시합니다. 관리비 포함 계약은 관리비를 따로 만들지 않습니다. [월별 기록 처리](../../backend/src/main/java/com/zip/backend/bills/BillService.java) · [고정 지출 화면](../../frontend/src/features/life/components/MonthlyFixedExpense.tsx)
- 미래 월과 계약 밖 월에는 새 계약 비용을 자동 등록하지 않습니다. 이미 저장된 월별 기록의 조회는 별도입니다. 과거 계약월 보충은 양 끝 날짜가 있는 월세 계약에 적용하며, 전세 대출 이자와 날짜가 부족한 계약은 현재 월 규칙을 따릅니다. [자동 등록 조건](../../backend/src/main/java/com/zip/backend/bills/BillRepository.java) · [전세 대출](home-info.md)

## 월세 알림

알림을 켠 월세 계약은 저장된 납부 시간대의 납부 3일 전부터 당일까지 미납 월세에 대해 서버 스케줄러가 월 1회 알립니다. 기존 날짜형 월세 링크도 같은 달의 가계부로 연결되며, 기존 알림이 있으면 신규 알림이 중복 생성되지 않습니다. [월세 알림 서비스](../../backend/src/main/java/com/zip/backend/notification/RentReminderService.java) · [중복 판정](../../backend/src/main/java/com/zip/backend/notification/NotificationRepository.java) · [화면 링크](../../frontend/src/features/life/notifications.ts)

## 일반 고정 지출의 납부와 해지

등록된 월별 항목은 납부 또는 납부 취소 처리가 가능합니다. 납부 완료 항목을 수정하거나 해당 월 기록을 지우려면 먼저 납부 취소가 필요합니다. 월별 삭제는 해당 월 기록을 삭제 표시하며, 해지는 입력한 적용일부터 미납·예정 기록의 집계에 적용합니다. 적용일 전 기록과 이미 납부한 기록은 보존합니다. 계약 항목의 종료 조건은 내 집 정보에서 관리합니다. [PR #111](https://github.com/teammzip/project-ZIP/pull/111) · [고정 지출 서비스](../../backend/src/main/java/com/zip/backend/bills/BillService.java) · [월별 등록·수정 요청](../../frontend/src/features/life/billsApi.ts) · [납부·해지 계약](../../frontend/API.md#고정-지출-납부--해지-2026-11-19)

## 월급 자동 등록

월급 자동 등록은 별도입니다. 등록을 시작한 월부터 지급일이 지난 누락 월을 채우며, 회원·월별 등록 기록으로 중복 생성과 삭제 후 재등록을 막습니다. [월급 서비스](../../backend/src/main/java/com/zip/backend/ledger/SalaryService.java) · [월급 회귀 테스트](../../backend/src/test/java/com/zip/backend/SalaryIntegrationTests.java)

## 검증 결과

PR #132의 격리 MySQL·WebKit 검증에서 계약월 월세·별도 관리비 합계, 납부 기록 보존, 월세 알림 중복 방지와 링크 이동을 확인했습니다. 서버 재기동과 시간대 경계를 한 번에 확인하는 배포 환경 시나리오는 [구현·검증 현황](project-status.md#검증해야-될-부분)에 남겨 두었습니다. [변경 기록](../../CHANGELOG.md#백엔드) · [계약 자동 등록 테스트](../../backend/src/test/java/com/zip/backend/ContractAutoRegisterTests.java) · [월세 알림 테스트](../../backend/src/test/java/com/zip/backend/notification/RentReminderTests.java)

# 가계부와 메모

2026-11-24 코드 확인 · [변경 기록 수집](../raw/index.md#2026-11-24--변경-기록-수집) · [위키 색인](../index.md)

수입·기타 지출·고정 지출에서 메모를 열면, 가계부 입력값과 돌아갈 주소를 현재 탭의 `sessionStorage`에 보관합니다. 초안 키와 회원 ID가 모두 맞을 때 해당 초안을 읽습니다. 이어쓰기를 선택하면 메모 편집이 끝나기 전에는 메모 화면으로, 메모를 저장한 뒤에는 원래 가계부 입력 화면으로 돌아갑니다. [임시 입력과 복귀 경로](../../frontend/src/features/life/ledgerMemoNavigation.ts) · [이어쓰기 화면](../../frontend/src/features/life/components/LedgerMemoResumeDialog.tsx)

서버 모드에서 메모 화면은 `POST /api/memos/ledger-draft`로 편집할 메모를 준비합니다. 저장을 누르면 공통 메모 동기화 코드가 최신 입력에 `complete: true`를 넣어 `PATCH /api/memos/{id}`를 보내고, 응답에서 `draft: false`를 확인합니다. 메모를 저장한 뒤 가계부 화면으로 돌아오면 메모를 연결한 상태로 기존 입력을 이어서 편집할 수 있습니다. 가계부 저장이 성공하면 임시 입력을 지웁니다. [메모 화면](../../frontend/src/pages/my/MemoPage.tsx) · [메모 확정](../../frontend/src/features/memo/sync.ts) · [수입·지출 저장](../../frontend/src/features/life/components/ServerMoneyLog.tsx) · [고정 지출 저장](../../frontend/src/features/life/components/MonthlyBillEditor.tsx)

모의 모드에서는 브라우저의 메모 저장소에서 초안을 만들고 확정합니다. [메모 화면](../../frontend/src/pages/my/MemoPage.tsx) · [메모 확정](../../frontend/src/features/memo/sync.ts) · [앱 실행 모드](application.md)

## 가계부 기록과 회원별 분류

수입·기타 지출은 `/api/ledger/{income|spend}`에서 회원·월별로 조회합니다. 수입은 고정과 기타로 나누고, 등록·수정·삭제 시 서버에서 소유권과 입력값을 확인합니다. 고정 지출은 납부 상태를 포함한 별도의 월별 API를 사용합니다. [수입·지출 처리](../../backend/src/main/java/com/zip/backend/ledger/LedgerController.java) · [계약 고정 지출](fixed-expenses.md)

분류의 표시 순서·사용자 추가·기본 분류 숨김은 회원별로 저장합니다. 분류 이름을 바꾸면 같은 회원과 분류 그룹의 기존 기록에도 반영합니다. 분류를 지우면 선택 목록에서 빠지며 기존 거래와 마지막 분류명은 보존합니다. 서버에 저장된 분류 설정이 없는 경우에만 기존 브라우저 설정을 가져옵니다. [회원별 분류 API](../../backend/src/main/java/com/zip/backend/ledger/LedgerCategoriesController.java) · [분류 계약](../../frontend/API.md#회원별-카테고리표시-순서)

## 폴더와 메모 동기화

서버 모드에서 폴더 목록은 회원·세션별로 조회합니다. 폴더를 삭제하면 메모는 유지되고 미분류로 이동합니다. 가계부 초안은 수입·기타 지출·고정 지출에 맞는 폴더에 연결합니다. 메모 본문은 포커스 복귀 때 다시 읽으며, 확정 저장은 진행 중인 자동 저장이 끝나기를 기다립니다. [폴더 조회](../../frontend/src/features/memo/folders.ts) · [폴더 마이그레이션](../../db/migrations/20261122_07_memo_folders.sql) · [메모 동기화](../../frontend/src/features/memo/sync.ts)

일반 메모의 본문·체크리스트·고정 여부를 서버에 저장할 수 있습니다. 홈 위젯은 회원이 지정한 본인 메모 최대 3개의 순서를 사용합니다. `ids: null`은 자동 선택, `ids: []`는 선택 항목 없음입니다. [메모 컨트롤러](../../backend/src/main/java/com/zip/backend/memo/MemoController.java) · [메모 처리](../../backend/src/main/java/com/zip/backend/memo/MemoService.java)

## 확인된 폴더 문제

- 열린 상태로 유지한 메모 화면은 다른 세션에서 폴더를 바꾼 뒤 포커스로 돌아와도 폴더 목록을 자동 재조회하지 않습니다. `2f8ba7f` 점검에서 캐시 동작을 확인했고, `250b8d9`에서도 공통 쿼리 설정과 폴더 조회 경로가 이 동작을 유지합니다. [공통 쿼리 설정](../../frontend/src/lib/queryClient.ts) · [폴더 조회](../../frontend/src/features/memo/folders.ts)
- 일반 생성은 폴더 100개에서 제한합니다. 필요한 분류 폴더가 없는 계정에서 가계부 초안을 만들면 101번째 폴더가 생기는 것을 `2f8ba7f`의 격리 API 검사에서 재현했습니다. 두 서버 경로는 `250b8d9`까지 동일합니다. [일반 생성](../../backend/src/main/java/com/zip/backend/memo/MemoService.java) · [가계부 초안](../../backend/src/main/java/com/zip/backend/memo/LedgerMemoController.java)

[초안 이어쓰기 검증 결과](project-status.md#검증된-부분) · [서버 모드에서 추가로 확인할 범위](project-status.md#검증해야-될-부분)

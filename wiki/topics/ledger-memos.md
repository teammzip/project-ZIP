# 가계부와 메모

2026-11-24 코드 확인 · [변경 기록 수집](../raw/index.md#2026-11-24--변경-기록-수집) · [위키 색인](../index.md)

수입·기타 지출·고정 지출에서 메모를 열면, 가계부 입력값과 돌아갈 주소를 현재 탭의 `sessionStorage`에 보관합니다. 초안 키와 회원 ID가 모두 맞을 때 해당 초안을 읽습니다. 이어쓰기를 선택하면 메모 편집이 끝나기 전에는 메모 화면으로, 메모를 저장한 뒤에는 원래 가계부 입력 화면으로 돌아갑니다. [임시 입력과 복귀 경로](../../frontend/src/features/life/ledgerMemoNavigation.ts) · [이어쓰기 화면](../../frontend/src/features/life/components/LedgerMemoResumeDialog.tsx)

서버 모드에서 메모 화면은 `POST /api/memos/ledger-draft`로 편집할 메모를 준비합니다. 같은 회원·가계부 종류·초안 키로 다시 열면 기존 메모를 사용합니다. 메모 화면에서 저장하면 공통 메모 동기화 코드가 최신 입력에 `complete: true`를 넣어 `PATCH /api/memos/{id}`를 보냅니다. 새 메모는 `draft:<키>`에서 `saved:<키>`로 전환되고 응답은 `draft: false`입니다. 이후 원래 가계부 화면에서 입력을 이어갈 수 있습니다. 가계부 저장이 성공하면 임시 입력을 지웁니다. [메모 화면](../../frontend/src/pages/my/MemoPage.tsx) · [초안 준비와 폐기](../../backend/src/main/java/com/zip/backend/memo/LedgerMemoController.java) · [메모 확정](../../frontend/src/features/memo/sync.ts) · [서버의 메모 상태 변경](../../backend/src/main/java/com/zip/backend/memo/MemoRepository.java) · [수입·지출 저장](../../frontend/src/features/life/components/ServerMoneyLog.tsx) · [고정 지출 저장](../../frontend/src/features/life/components/MonthlyBillEditor.tsx)

수입·기타 지출 저장 요청에 `memoId`가 있으면 `LedgerService`가 같은 회원과 가계부 종류의 메모를 찾아 임시 키를 거래 ID로 바꿉니다. 메모 ID·제목·본문을 보존하고 본문의 처음 100자를 거래에 미리보기로 저장합니다. 연결 실패 시 해당 요청에서 실행한 거래 쓰기와 연결 변경을 롤백합니다. 앞서 메모 화면에서 성공한 별도 저장은 유지됩니다. 초안 폐기는 본인의 `draft:<키>` 또는 `saved:<키>` 메모에만 적용됩니다. [가계부 저장](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java) · [메모 연결](../../backend/src/main/java/com/zip/backend/memo/LedgerMemoWriter.java) · [초안 폐기](../../backend/src/main/java/com/zip/backend/memo/LedgerMemoController.java) · [통합 테스트](../../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

모의 모드에서는 브라우저의 메모 저장소에서 초안을 만들고 확정합니다. [메모 화면](../../frontend/src/pages/my/MemoPage.tsx) · [메모 확정](../../frontend/src/features/memo/sync.ts) · [앱 실행 모드](application.md)

## 가계부 기록과 회원별 분류

수입·기타 지출은 `/api/ledger/{income|spend}`에서 회원·월별로 조회합니다. 수입은 고정과 기타로 나누고, 등록·수정·삭제 시 서버에서 소유권과 입력값을 확인합니다. 저장 본문에는 분류명 `cat`을 보내고 수입에는 `incomeType`도 필수입니다. 고정 지출은 납부 상태를 포함한 별도의 월별 API를 사용합니다. [수입·지출 처리](../../backend/src/main/java/com/zip/backend/ledger/LedgerController.java) · [가계부 API 계약](../../frontend/API.md#5-가계부-수입--기타-지출-) · [가계부 요청 타입](../../frontend/src/features/life/ledgerApi.ts) · [계약 고정 지출](fixed-expenses.md)

수입·기타 지출 목록은 연결 메모를 회원·기록 종류·문자열 기록 ID로 조인합니다. 수입은 같은 쿼리에서 자동 등록 월급 여부도 조회합니다. 메모가 없어도 거래를 반환하며, 이 경우 `memoId`와 `memoTitle`은 생략합니다. 수입 조회에 앞서 월급 자동 등록을 동기화하고, 고정 수입 목록의 월급 표시 이름도 조회합니다. 회원이나 기록 종류가 다른 메모와 숫자 표기가 비슷한 메모 키를 구분하는지 통합 테스트에서 확인합니다. [목록 SQL](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java) · [조인 키 제약](../../db/schema.sql) · [통합 테스트](../../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

분류의 표시 순서·사용자 추가·기본 분류 숨김은 회원별로 저장합니다. 분류 이름을 바꾸면 같은 회원과 분류 그룹의 기존 기록에도 반영합니다. 분류를 지우면 선택 목록에서 빠지며 기존 거래와 마지막 분류명은 보존합니다. 서버에 저장된 분류 설정이 없는 경우에만 기존 브라우저 설정을 가져옵니다. [회원별 분류 API](../../backend/src/main/java/com/zip/backend/ledger/LedgerCategoriesController.java) · [분류 계약](../../frontend/API.md#회원별-카테고리표시-순서)

### 가계부 저장 트랜잭션

`LedgerController`는 JWT에서 회원·세션 ID를 읽고 API 요청을 `LedgerService`에 전달합니다. 등록은 `201`, 수정·삭제는 `204`를 반환합니다. `LedgerService`의 공개 등록·수정·삭제 메서드에서 각각 트랜잭션을 시작합니다. 회원 행을 잠근 뒤 세션을 다시 확인하고 소유권과 저장 규칙을 적용합니다. 등록·수정 중 발생한 거래·분류·메모 변경과 첫 월급 설정·원본 연결은 같은 트랜잭션에 포함됩니다. [가계부 API](../../backend/src/main/java/com/zip/backend/ledger/LedgerController.java) · [가계부 서비스](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java) · [회원 잠금](../../backend/src/main/java/com/zip/backend/auth/AuthRepository.java)

`LedgerCategoryService`는 회원별 분류 설정과 월급 표시 이름을 읽고, 거래 저장 시 분류 ID를 찾아 반환합니다. 여러 회원이 같은 새 분류를 저장할 때는 분류 종류·이름의 유일 키와 삽입 후 잠금 조회를 사용합니다. 격리 MySQL 9.6의 `REPEATABLE READ`에서 기존 스냅샷에는 다른 트랜잭션이 생성한 분류가 보이지 않는 경우에도 잠금 조회는 해당 ID를 반환하는 것을 확인했습니다. [분류 서비스](../../backend/src/main/java/com/zip/backend/ledger/LedgerCategoryService.java) · [분류 유일 키](../../db/schema.sql)

가계부 통합 테스트는 메모 연결이 거부될 때 거래 등록·수정과 새 분류가 롤백되는 경우, 월급 원본 연결이 실패할 때 수입·메모·월급 설정이 롤백되는 경우를 검증합니다. 각기 다른 세션에서 동시에 올린 지출은 각각의 메모를 유지하고, 첫 월급 동시 등록은 한 건만 성공합니다. 서로 다른 회원이 같은 새 분류로 저장하는 경우도 검사합니다. `backend`에서 아래 명령을 실행하면 H2 MySQL 호환 모드에서 이 테스트들을 다시 실행할 수 있습니다. [가계부 통합 테스트](../../backend/src/test/java/com/zip/backend/LedgerIntegrationTests.java)

```powershell
.\gradlew.bat test --tests 'com.zip.backend.LedgerIntegrationTests'
```

## 폴더와 메모 동기화

서버 모드에서 폴더 목록은 회원·세션별로 조회합니다. 폴더를 삭제하면 메모는 유지되고 미분류로 이동합니다. 가계부 초안은 수입·기타 지출·고정 지출에 맞는 폴더에 연결합니다. 메모 본문은 포커스 복귀 때 다시 읽으며, 확정 저장은 진행 중인 자동 저장이 끝나기를 기다립니다. [폴더 조회](../../frontend/src/features/memo/folders.ts) · [폴더 마이그레이션](../../db/migrations/20261122_07_memo_folders.sql) · [메모 동기화](../../frontend/src/features/memo/sync.ts)

일반 메모의 본문·체크리스트·고정 여부를 서버에 저장할 수 있습니다. 홈 위젯은 회원이 지정한 본인 메모 최대 3개의 순서를 사용합니다. `ids: null`은 자동 선택, `ids: []`는 선택 항목 없음입니다. [메모 컨트롤러](../../backend/src/main/java/com/zip/backend/memo/MemoController.java) · [메모 처리](../../backend/src/main/java/com/zip/backend/memo/MemoService.java)

## 확인된 폴더 문제

2026-11-24 두 문제 모두 고쳤습니다. 지난 기록은 [작업 로그](../log.md)에 있습니다.

- **목록 다시 불러오기**: 메모 화면을 열어 둔 채 다른 세션에서 폴더를 바꾼 뒤 화면으로 돌아오면 폴더 목록을 다시 조회합니다. 공통 쿼리 설정은 포커스 복귀 때 다시 조회하지 않으므로 폴더 조회에만 `refetchOnWindowFocus: 'always'`를 지정했습니다. [폴더 조회](../../frontend/src/features/memo/folders.ts) · [공통 쿼리 설정](../../frontend/src/lib/queryClient.ts)
- **폴더 개수 제한**: 가계부 초안도 일반 생성과 같은 100개 제한을 지킵니다. 분류 폴더(고정 수입 · 기타 수입 · 고정 지출 · 기타 지출)가 없고 폴더가 이미 100개면 폴더를 새로 만들지 않고 초안을 미분류로 만듭니다(가계부 입력은 막지 않음). [가계부 초안](../../backend/src/main/java/com/zip/backend/memo/LedgerMemoController.java) · [일반 생성](../../backend/src/main/java/com/zip/backend/memo/MemoService.java) · 검증: `LedgerIntegrationTests.ledgerDraftKeepsFolderLimitAndFallsBackToUnclassified`

[초안 이어쓰기 검증 결과](project-status.md#검증된-부분) · [서버 모드에서 추가로 확인할 범위](project-status.md#검증해야-될-부분)

# 고정 지출 입력 화면·AI 대화 고지서 등록 검증

2026-11-18 최종 구현 기준입니다. 화면 이름은 '고정 지출'이며 월 선택 기능은 유지합니다.

## 구현 범위

- 왼쪽: ○월 고정 지출, 월 선택, 합계·납부 완료·미납/예정, 목록.
- 오른쪽: 고정 지출 기록하기. 금액, 분류 칩·카테고리 추가, 납부 기한, 선택 메모.
- 등록된 월 기록(snapshot=true)에만 수정 버튼을 제공합니다. 미등록 예정액에는 등록만 표시합니다. 서버에서도 미등록 월·타인 항목 수정은 404로 차단합니다.
- 수정은 선택한 월의 금액·납부 기한·메모에만 적용합니다. 다른 월, 항목 기본 금액, 납부 상태는 보존합니다. 미래 월 등록/조회는 차단합니다.
- 가계부에는 사진 업로드가 없습니다. AI 페이지와 홈 AI 대화의 '고지서 사진으로 물어보기' → 사진·질문 → '물어보고 자동 등록'으로 이용합니다.
- AI가 고지서 금액·납부 기한을 읽으면 현재 월 고정 지출에 자동 등록하고, 대화 답변과 가계부 연결 카드를 함께 저장합니다. 저장 중 하나라도 실패하면 함께 롤백합니다.
- AI 대화의 '고정 지출에서 확인'으로 이동하면 저장한 내역을 볼 수 있습니다. 홈 대화는 재조회 후에도 연결 카드가 유지됩니다.
- 시간대는 등록 주소 → 현재 위치 → 기기 설정 순서입니다. 납부 기한은 청구 월과 달라도 됩니다.
- 사진은 JPG/PNG 2MB 이하, 한 장에 고지서 하나를 사용합니다. 원화 금액·연도가 포함된 납부 날짜가 불명확하면 저장하지 않습니다. 동일 사진의 중복 등록을 차단합니다.
- 사진은 사용자가 자동 등록 버튼을 누를 때 Gemini에 전송하며 원본을 서버에 보관하지 않습니다. 중복 방지 SHA-256만 보관합니다. 기존 AI 일일 사용량을 공유하고 실패 시 사용량을 반환합니다.
- 실제 API 모드(VITE_USE_MOCK=false)에 연결했습니다. 기존 데모 모드의 로컬 고정 지출 화면은 별도입니다.

## 1. 테스트

프로젝트 루트에서:

```powershell
Push-Location backend
.\gradlew.bat test --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillIntegrationTests --tests com.zip.backend.AiChatTests
Pop-Location
Push-Location frontend
node --test tests/*.test.mjs
npm run build
npm run lint
Pop-Location
```

결과: 백엔드 37개, 프론트 98개 통과. 빌드·린트 통과. 신규 스키마 외래키·감사 스냅샷 검사 2개 통과.
AI 제공자는 테스트 대역입니다. 실제 고지서 인식 정확도와 제공자 계정의 모델·사용량은 실제 사진으로 별도 확인해야 합니다.

## 2. DB

기존 DB는 다음 순서로 한 번씩 적용합니다. 현재 연결된 로컬 MySQL에는 세 파일을 적용했습니다. 같은 DB에 ALTER를 재실행하지 마세요.

1. db/migrations/20261118_01_bill_monthly_registration.sql: 납부 기한·사진 중복 방지 테이블
2. db/migrations/20261118_02_bill_monthly_memo.sql: 월별 메모
3. db/migrations/20261118_03_bill_document_keys.sql: 고지서 식별 해시

신규 DB는 최신 db/schema.sql을 사용합니다. AI 답변 카드는 기존 LINK 타입을 사용하므로 새 ENUM 마이그레이션은 없습니다.

현재 로컬 DB의 재검증:

```powershell
Push-Location backend
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql
Pop-Location
```

다른 개발자의 DB에 누락된 스키마를 추가하며 검증하려면 마지막에 -PapplyMonthlyMigration을 붙입니다. DDL은 유지하고 임시 검증 회원·청구·사진 해시·AI 대화 데이터만 롤백합니다.
DB 연결은 backend/application-local.properties의 DB_URL·DB_USERNAME·DB_PASSWORD 또는 동명의 환경 변수를 사용합니다. 비밀 설정 파일은 Git에 올리지 않습니다.

실제 MySQL에서 등록→수정→재조회, 메모, 다른 월 금액 보존, 미등록 수정 차단, 사진 중복 방지, AI 답변·연결 카드 저장을 검증했습니다. 저장 직후 행이 미래 시각으로 반올림되어 목록에서 잠시 누락되지 않도록 초 단위 저장을 맞췄습니다.

```sql
SET @verify_user = 123; -- 실제 회원 ID로 변경
SET @verify_month = '2026-11'; -- 선택한 월로 변경
SELECT b.id,b.name,b.tag,b.default_amount,p.period_ym,p.amount,p.due_date,p.memo,p.paid_at
FROM bill_items b JOIN bill_payments p ON p.bill_item_id=b.id
WHERE b.user_id=@verify_user AND p.period_ym=@verify_month;
SELECT m.role,m.content,m.card_type,m.card_data
FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id
WHERE c.user_id=@verify_user ORDER BY m.id DESC LIMIT 10;
```

전체 DB 마이그레이션 체인의 감사는 이번 검증 범위가 아닙니다.

## 3. 프론트 직접 확인

백엔드를 재시작하고 프론트 개발 서버를 실행합니다. 현재 frontend/.env.local은 VITE_USE_MOCK=false입니다.
http://127.0.0.1:3000/my/budget/expense

1. 왼쪽 제목이 '○월 고정 지출', 오른쪽이 '고정 지출 기록하기'인지 확인합니다.
2. 가계부에 고지서 파일 입력이나 AI 자동 등록 버튼이 없어야 합니다.
3. 40,000원·공과금·납부 날짜·메모로 기록합니다. 목록과 DB에 유지되는지 확인합니다.
4. 수정으로 45,000원·변경 날짜·메모를 저장합니다. 다른 월과 납부 상태는 바뀌지 않아야 합니다.
5. 미등록 예정액은 등록만 가능하고, 등록 후 수정 버튼으로 바뀌어야 합니다.
6. AI 페이지 또는 홈 AI 대화에서 '고지서 사진으로 물어보기'를 엽니다. 선명한 고지서를 선택하고 '물어보고 자동 등록'을 누릅니다.
7. 답변의 금액·납부 기한을 원본과 비교하고 '고정 지출에서 확인'으로 이동해 목록·DB를 비교합니다.
8. 같은 사진 재업로드/흐린 사진/기한 없는 영수증은 중복 또는 실패 안내를 보여야 하며 청구 행이 늘지 않아야 합니다.

실제 AI 사용에는 서버의 기존 GEMINI_API_KEY 설정이 필요합니다. 실제 사진 수동 검증은 아직 별도입니다.

## API

- POST /api/bills/monthly?month=YYYY-MM&timeZone=IANA: {name?,tag,amount,dueDate,memo?}
- PATCH /api/bills/monthly/{id}?month=YYYY-MM&timeZone=IANA: {amount,dueDate,memo?}
- GET /api/bills/monthly: 기존 응답에 dueDate, memo 추가
- POST /api/ai/conversations/{id}/bill-photo?month=YYYY-MM&timeZone=IANA: multipart photo, question → {bill,reply}
- 기존 POST /api/bills/monthly/photo는 제거했습니다.

## 4. Git 공유

현재 브랜치를 유지합니다. 변경 파일을 확인한 뒤 필요한 파일을 추가합니다. 자동 커밋·push는 하지 않았습니다.

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/bills backend/src/main/java/com/zip/backend/ai/AiService.java backend/src/main/java/com/zip/backend/ai/GeminiClient.java backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java backend/src/test/resources/auth-fixture.sql backend/scripts/MonthlyBillsMysqlVerify.java backend/verify-monthly-mysql.init.gradle backend/README.md
git add db/schema.sql db/migrations/20261118_01_bill_monthly_registration.sql db/migrations/20261118_02_bill_monthly_memo.sql db/migrations/README.md db/tests/schema_expected.json db/tests/15_schema_audit.sql db/tests/20_migration_schema_audit.sql
git add frontend/src/features/life/billsApi.ts frontend/src/features/life/components/MonthlyBillEditor.tsx frontend/src/features/life/components/MonthlyFixedExpense.tsx frontend/src/features/life/components/life.module.css frontend/src/features/ai/api.ts frontend/src/features/ai/store.ts frontend/src/features/ai/components/AiAssistant.tsx frontend/src/features/ai/components/AiChat.tsx frontend/src/features/ai/components/ChatModal.tsx frontend/src/features/ai/components/BillPhotoQuestion.tsx frontend/src/features/ai/components/AiChat.module.css frontend/tests/ai-bill-photo.test.mjs frontend/tests/monthly-bill-editor.test.mjs frontend/tests/monthly-bills-view.test.mjs frontend/API.md MONTHLY_BILLS_VERIFICATION.md MONTHLY_BILLS_WRITE_VERIFICATION.md
git add backend/src/main/java/com/zip/backend/bills/BillDocumentIdentity.java db/migrations/20261118_03_bill_document_keys.sql
git diff --cached --stat
git commit -m "feat: 고정 지출 입력 화면 개편 및 AI 대화 고지서 등록 연결"
git push origin backend
```

PR 제목: feat: 고정 지출 입력 화면 개편 및 AI 대화 고지서 등록 연결

PR Description:

```text
고정 지출을 요약·목록과 기록 입력의 2단 양식으로 변경했습니다.
등록한 월 기록만 수정할 수 있도록 유지하고 월별 메모 저장을 추가했습니다.
고지서 사진 등록을 가계부에서 AI 대화로 옮겨 답변·연결 카드와 고정 지출을 함께 저장합니다.
사진 중복·인식 실패·대화 소유권·트랜잭션 롤백을 검사하고 저장 직후 조회 시각 정밀도를 보완했습니다.
검증: 백엔드 37개·프론트 98개 테스트, 빌드·린트, 실제 MySQL 저장/조회/AI 답변 카드 검증 통과.
팀원은 DB 마이그레이션 3개를 적용하고 서버를 재시작해야 합니다. 실제 고지서 인식 정확도는 별도 수동 확인이 필요합니다.
```

## 디자인 정리 추가

첨부에서 지정한 합계 3칸과 기록 입력 폼을 유지하고, 나머지를 기타 지출의 공통 스타일에 맞췄습니다. 월 선택, 원형 분류 그래프·범례, 날짜 배지·분류 칩·금액 목록, 빈 목록 안내에 반영했습니다. 시간대·기간·조회 시각·이번 달/새로고침은 하단 '조회 정보'를 펼쳐 확인합니다.
화면 표시 변경이므로 DB/백엔드 재검증은 생략했습니다. 프론트 빌드·린트와 기존 화면 검사 5개를 확인했습니다.

이번 디자인 변경만 따로 커밋하려면 이전 미커밋 작업과 같은 파일을 수정했으므로 git add -p로 디자인 변경 부분만 선택하고 git diff --cached로 확인하세요.

커밋 메시지: style: 고정 지출 화면을 기타 지출 디자인과 통일

PR Description: 고정 지출의 합계와 입력 폼은 유지하면서 월 선택·분류 그래프·기록 목록을 기타 지출의 공통 스타일로 통일했습니다. 조회 안내는 접을 수 있도록 정리했습니다. 프론트 빌드·린트와 관련 화면 검사 5개를 확인했습니다.

## 항목 이름 제거·고지서 중복·납부 기한 검증 추가

- 이름 입력칸을 제거했습니다. 직접 등록은 name 없이 보내고 서버가 분류명을 표시 이름으로 저장합니다. AI가 인식한 항목명과 기존 예정 항목명은 유지합니다.
- 같은 분류/금액/납부 기한이라는 이유만으로 중복을 차단하지 않습니다. 서로 다른 고지서는 같은 월·분류여도 등록할 수 있습니다.
- AI가 읽은 발행처·문서 식별번호·고지서의 청구 월을 정규화(NFKC, 대소문자·공백·하이픈 정리)한 SHA-256 해시가 동일한 경우 다른 사진이어도 409로 차단합니다. 식별 원문은 DB·대화 카드에 저장하지 않습니다.
- 식별 정보가 없으면 추측하지 않고 등록합니다. 이때 AI 답변에서 재촬영 사진 간 중복 여부를 확인하지 못했다는 안내를 표시합니다. 과거에 식별 해시 없이 등록한 사진에도 소급 비교할 수 없습니다. 동일 파일 재업로드는 계속 차단합니다.
- 기존 DB에 20261118_03_bill_document_keys.sql을 적용합니다. 현재 로컬 DB에는 적용했습니다.
- 신규 등록은 해당 시간대의 오늘 이전 납부 기한을 400으로 거부합니다. 오늘은 허용합니다. 날짜 선택기의 최소 날짜와 제출 시 검사도 적용합니다.
- 기존 미납 기록의 과거 기한을 그대로 유지하면서 금액·메모를 고치는 것은 허용합니다. 기한을 바꿀 때는 오늘 이전 날짜를 지정할 수 없습니다.
- 이번 추가 변경 검증: 관련 백엔드 31개·프론트 5개, 빌드·린트, 스키마 검사 2개 통과. 실제 MySQL에서 동일 문서 차단·다른 문서 허용·과거 기한 차단을 검증하고 임시 데이터를 롤백했습니다. 초기 전체 테스트 결과와 구분한 이번 변경의 실행 범위입니다.

직접 확인: 이름 입력칸이 없는지 확인 → 어제 기한 등록 차단 → 오늘 기한 등록 성공 → AI에서 같은 고지서를 다른 사진으로 업로드해 중복 안내 확인 → 다른 고지서번호의 문서는 같은 분류여도 등록되는지 확인합니다. 실제 이미지 인식 정확도는 Gemini 설정 후 원본과 비교해야 합니다.

이번 변경의 커밋 메시지: fix: 고지서 식별 기반 중복 차단 및 과거 납부 기한 등록 방지

PR Description: 고정 지출의 항목 이름 입력을 제거하고 분류명으로 자동 표시합니다. 분류 기준의 중복 제한을 해제하고 AI가 읽은 발행처·식별번호·청구 월 해시로 동일 고지서만 차단합니다. 신규 등록과 납부 기한 변경 시 해당 시간대의 오늘 이전 날짜를 거부합니다. 관련 테스트·빌드·린트 및 실제 MySQL 검증을 수행했습니다. 팀원은 20261118_03_bill_document_keys.sql을 추가 적용하고 서버를 재시작해야 합니다.

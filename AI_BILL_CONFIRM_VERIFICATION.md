# 고지서 사진·QR 확인 등록 검증

변경 흐름: AI 공과금·생활비 카드 선택 → 고지서 사진 또는 QR 이미지 업로드 → 금액·납부 기한 안내 및 등록 질문 → ‘가계부에 등록’ 클릭 → 고정 지출 저장.
‘등록 안 함’ 또는 인식 실패 시 가계부에 저장하지 않는다. 취소된 결과는 다시 등록할 수 없다. 인식 결과는 30분 후 만료된다. 화면을 벗어나 확인 버튼을 잃으면 사진을 다시 올린다. 인식 시 AI 사용량은 사용하며 확인·취소는 AI를 재호출하지 않는다.

## 1. 테스트 (사용자가 실행)
backend에서:
```powershell
.\gradlew.bat test --tests com.zip.backend.BillMonthlyWriteTests --tests com.zip.backend.BillQrReaderTests
```
frontend에서:
```powershell
node --test tests/ai-bill-photo.test.mjs
npm run build
npm run lint
```
자동 테스트 코드에는 동의 전 미저장, 동의 후 저장, 취소·만료·중복·다른 사용자 차단, 다른 분야 차단, QR 이미지 해독을 반영했다. 이번 작업에서 실행하지 않았다. 기존 고정 날짜 테스트는 날짜가 지나면 미래 납부 기한으로 조정해야 한다.

## 2. DB 적용 및 검증
실제 백엔드 연결 DB에 `db/migrations/20261118_06_bill_photo_drafts.sql` 전체를 실행한다. 기존 01~05 마이그레이션도 적용되어 있어야 한다. schema.sql 수정만으로 기존 DB는 바뀌지 않는다.

```sql
SELECT DATABASE();
SHOW TABLES LIKE 'bill_photo_drafts';
```
아래 123은 로그인한 사용자 ID로 바꾼다. 사진을 읽은 직후 PENDING이며 가계부 행 수는 증가하지 않아야 한다.
```sql
SELECT id, conversation_id, period_ym, state, expires_at
FROM bill_photo_drafts WHERE user_id=123;

SELECT p.* FROM bill_payments p
JOIN bill_items b ON b.id=p.bill_item_id WHERE b.user_id=123;
```
- 동의: REGISTERED, 가계부 기록 한 건 추가
- 취소: CANCELLED, 가계부 기록 추가 없음
- 같은 고지서 재등록: 409, 가계부 기록 추가 없음. 다른 사진은 발행처·고지서 식별번호·청구 월이 모두 인식된 경우 중복 식별 가능
- 인식 원본 사진·QR 원문은 DB에 저장하지 않는다. 추출 금액·납부 기한·분류와 중복 식별 해시를 저장한다.

## 3. 프론트 검증
새 의존성(ZXing)을 반영하도록 백엔드를 다시 실행한다. 실제 사진 인식에는 Gemini 설정이 필요하다.
1. 홈 AI 모달과 AI 대화 화면에서 일반 질문·다른 카드 선택 시 고지서 전용 버튼이 없는지 확인한다.
2. 공과금·생활비를 선택하면 ‘고지서 사진·QR로 물어보기’가 나타나야 한다.
3. 2MB 이하 JPG/PNG 고지서를 읽는다. POST 응답에는 draftId와 preview가 있으며 bill은 없다. 등록 질문을 읽고 금액·날짜를 원본과 비교한다.
4. ‘등록 안 함’을 선택해 가계부가 변하지 않는지 확인한다.
5. 사진을 다시 읽고 ‘가계부에 등록’을 선택한다. decision POST 응답의 registered=true와 가계부·홈 반영을 확인한다.
6. 같은 결과를 두 번 확인하거나 같은 고지서를 다시 등록해 중복되지 않는지 확인한다.
7. QR 이미지를 올려 인식한다. QR에 URL만 있고 사진에 금액·납부 기한이 없으면 인식 실패로 처리해야 한다. QR 주소를 방문해 청구 정보를 가져오는 기능과 실시간 카메라 스캔은 포함하지 않는다.
8. 납부 기한이 지난 고지서는 등록 단계에서 거부되어야 한다. 30분 지난 결과는 410이어야 한다.

### 모바일 촬영 확인
- 공과금·생활비 카드에서 ‘카메라로 촬영’을 선택한다. 후면 카메라 요청(`capture="environment"`)을 지원하는 모바일 브라우저에서 촬영 화면이 열리는지 확인한다. 브라우저에 따라 파일 선택 창으로 대체될 수 있다.
- 고지서 전체 또는 QR을 촬영한 뒤 선택한 파일 이름이 나타나는지 확인하고 ‘고지서 읽기’를 누른다. JPG/PNG, 2MB 이하 제한이 적용된다.
- 촬영 취소 시 기존에 선택한 사진이 유지되는지 확인한다. ‘저장된 사진 선택’으로 갤러리 사진도 사용할 수 있다.
- 인식만으로 DB 가계부 행이 추가되지 않고 ‘가계부에 등록’ 동의 후에만 추가되는지 확인한다.

QR 해독은 [ZXing 공식 릴리스](https://github.com/zxing/zxing/releases)의 Java 라이브러리 3.5.4를 사용한다.

## 검증 후 Git
기존 backend 브랜치에서 `git status --short`, `git diff`로 이번 작업과 이전 작업을 구분해 관련 파일을 stage한다. 커밋 후 `git push origin backend`를 실행한다. 테스트·DB·화면 검증 전에는 검증 완료로 기록하지 않는다.

커밋 메시지: `feat: 공과금 카드의 고지서 사진·QR 인식 및 동의 후 가계부 등록`

backend → dev 병합 설명:
- AI 공과금·생활비 카드에서만 고지서 첨부 기능 제공
- 사진·QR 분석과 실제 가계부 저장을 분리하고 사용자 확인·취소 추가
- 서버 임시 결과로만 등록하며 소유권·중복·만료·납부 기한 재검증
- 등록 성공 시 가계부 및 홈 지출 조회 갱신
- 배포 전 06 마이그레이션 적용 및 ZXing 의존성 반영 필요
- 검증 결과: 직접 실행한 테스트와 DB·화면 확인 결과 작성

# 프로필 등록 정보 조회 / 내 집 정보 명칭 변경

## 최신 검증 결과 (2026-11-15)

- 프론트 전체 테스트 62개 통과, 빌드·린트 통과.
- 개인 정보 편집 이벤트 테스트: 기존 표시 자리에서 입력, 저장·취소 구분, 취소 시 미전송, 이름·생년월일만 전송, 날짜 오류 차단, 저장 실패 시 입력 유지.
- 백엔드 전체 테스트 111개 실패 없음. 현재 소스에 대한 Gradle test는 UP-TO-DATE로 확인되어 재실행 없이 기존 통과 결과를 사용했다.
- 실제 MySQL 조회와 생년월일 저장·초기화 검증 성공. 검증용 데이터 변경은 롤백.
- 실제 브라우저에서 버튼 배치·글꼴을 눈으로 확인하는 수동 검증은 별도 진행해야 한다.

프로필 편집 창의 내 개인 정보에서 이름(닉네임)·생년월일·이메일·아이디만 조회한다.
실제 모드는 GET /api/me/profile-info로 DB의 본인 정보만 조회하며 주소·월세·계약 필드는 반환하지 않는다.
이름(닉네임)과 생년월일은 내 개인 정보 제목 옆 수정 버튼 → 개인 정보 저장으로 변경한다.
수정 버튼을 누르면 기존 이름·생년월일 표시 위치가 입력칸으로 전환된다. 별도의 입력 영역은 만들지 않는다. 취소하면 원래 표시로 돌아간다.
편집 중 버튼은 저장·취소로 표시한다. 저장은 강조색, 취소는 테두리 버튼으로 구분하며 개인 정보 영역 글꼴을 맑은 고딕 계열로 적용했다.
PATCH /api/me/profile-info는 nickname과 birth만 허용한다. 이메일·아이디 등 다른 필드가 포함되면 400이다.
이름은 users.nickname, 생년월일은 user_personal_info.birth_date에 저장한다. 기존 주거 설문은 변경하지 않는다.
개인 정보 행이 없는 회원은 조회 시 기존 housing_surveys.birth_date를 참고한다. 생년월일을 비우고 저장하면 NULL이 유지된다.
로그인·내 정보 API에도 저장한 개인 생년월일을 반영한다. 프로필 꾸미기 저장과 개인 정보 저장 버튼은 분리했다.
데모 모드는 로컬 정보이므로 실제 DB 검증은 VITE_USE_MOCK=false 환경에서 한다.
기존 생활 정보 메뉴·창과 고정 지출의 수정 창을 내 집 정보로 변경했다.

## 1. 테스트

frontend에서:
```powershell
node --test tests/profile-info.test.mjs
npm run build
npm run lint
```
backend에서:
```powershell
.\gradlew.bat test --tests com.zip.backend.ProfileInfoTests --tests com.zip.backend.ConsentAndProfileTests
```
표시·미등록·실패·회원 구분과 기존 프로필 동작을 검증한다. 백엔드 자동 테스트는 H2를 사용한다.

## 2. 실제 DB

2026-11-15: 설정된 MySQL에 20261115_user_personal_info.sql 적용. 생년월일 저장·초기화를 트랜잭션에서 확인하고 검증 데이터는 롤백했다.
다른 개발자는 db/migrations/20261115_user_personal_info.sql을 연결된 DB에서 먼저 실행하고 백엔드를 재시작한다.
검증용 로그인 계정의 ID를 지정해 다음 조회 결과와 화면을 비교한다.

```sql
SET @profile_user_id = NULL; -- 검증용 회원의 실제 ID로 바꾸기
SELECT u.id, u.nickname, u.login_id, u.email,
       CASE WHEN p.user_id IS NULL THEN h.birth_date ELSE p.birth_date END AS birth_date
FROM users u LEFT JOIN housing_surveys h ON h.user_id = u.id
LEFT JOIN user_personal_info p ON p.user_id = u.id
WHERE u.id = @profile_user_id;
```

생년월일이 로컬 설문에만 저장된 경우 서버 응답은 미등록이다. DB로의 설문 저장·이관은 후속 작업이다.
등록 주소(users.address)는 내 집 상세주소(user_settings.home_address)와 구분한다.

## 3. 프론트

백엔드를 재시작해 새 API를 반영하고 frontend에서 npm run dev 실행.
http://127.0.0.1:3000/my/settings → 로그인 → 프로필 편집 → 내 개인 정보 확인.

- Network에서 GET /api/me/profile-info가 200이고 응답이 SQL 조회와 같은지 확인.
- 설문 없는 계정은 생년월일 미등록, 소셜 계정은 아이디 대신 소셜 로그인 계정 표시.
- 서버 연결 실패는 오류·다시 시도 표시. 미등록으로 오인하지 않도록 처리.
- 다른 계정으로 로그인하면 이전 회원 정보가 표시되지 않아야 함.
- 계정·설정의 내 집 정보 클릭 → 창 제목 확인. 가계부의 계약 수정 창도 내 집 정보 수정 표시.
- 프로필 사진·닉네임 저장은 기존대로 유지.
- 프로필에 주소·월세·관리비·계약 관련 표시가 없는지 확인. 해당 정보는 별도의 내 집 정보에서 확인.
- 개인 정보 수정 → 이름·생년월일 변경 → 개인 정보 저장 → SQL 조회·재로그인으로 유지 확인.
- 생년월일 삭제 → 저장 → 재조회 시 미등록 확인. 미래 날짜·잘못된 날짜는 저장 차단.
- 이메일·아이디에는 수정 입력칸이 없어야 한다. API에 해당 필드를 보내도 400이어야 한다.

## 4. Git 공유 (현재 브랜치 유지)

루트에서 이번 변경만 확인·스테이징한다. 기존 생활정보 입력 검증 변경은 별도 확인 후 커밋한다.

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/settings/ProfileInfoController.java backend/src/test/java/com/zip/backend/ProfileInfoTests.java backend/src/test/resources/profile-info-fixture.sql frontend/src/features/profile/components/ProfilePersonalInfo.tsx frontend/src/features/profile/components/ProfileEditor.tsx frontend/src/features/profile/components/Profile.module.css frontend/src/pages/my/SettingsPage.tsx frontend/src/features/life/components/FixedExpense.tsx frontend/src/features/ai/topics.ts frontend/tests/profile-info.test.mjs PROFILE_INFO_VERIFICATION.md
git diff --cached
git commit -m "feat: 프로필 등록 정보 조회와 내 집 정보 표시"
git push
```

팀 공유 요약: 프로필 편집에서 DB의 본인 이름(닉네임)·생년월일·이메일·아이디만 조회하도록 분리.
생활 정보 명칭을 내 집 정보로 변경. 이름·생년월일 수정은 구현했으며 주거 설문 서버 저장은 후속 범위.

### 개인 정보 수정 기능 공유 (현재 브랜치)

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/settings/ProfileInfoController.java backend/src/main/java/com/zip/backend/auth/AuthRepository.java backend/src/main/java/com/zip/backend/auth/AuthService.java backend/src/test/java/com/zip/backend/ProfileInfoTests.java backend/src/test/resources/auth-fixture.sql frontend/src/features/auth/types.ts frontend/src/features/profile/components/ProfilePersonalInfo.tsx frontend/src/features/profile/components/ProfileEditor.tsx frontend/src/features/profile/components/Profile.module.css frontend/src/pages/my/SettingsPage.tsx frontend/tests/profile-info.test.mjs db/schema.sql db/migrations/20261115_user_personal_info.sql PROFILE_INFO_VERIFICATION.md
git diff --cached
git commit -m "feat: 개인 정보 이름 및 생년월일 수정"
git push origin backend
```

팀 공유: user_personal_info 마이그레이션 먼저 적용 → 백엔드 재시작. 개인 정보는 이름·생년월일만 수정하며 이메일·아이디 변경은 API에서도 거부한다.

### 개인 정보 분리 수정만 공유하기 (현재 브랜치 유지)

```powershell
git diff --check
git add backend/src/main/java/com/zip/backend/settings/ProfileInfoController.java backend/src/test/java/com/zip/backend/ProfileInfoTests.java frontend/src/features/profile/components/ProfilePersonalInfo.tsx frontend/tests/profile-info.test.mjs PROFILE_INFO_VERIFICATION.md
git diff --cached
git commit -m "fix: 프로필 개인 정보와 내 집 정보 분리"
git push origin backend
```

# 프로필 등록 정보 조회 / 내 집 정보 명칭 변경

프로필 편집 창에 생년월일·등록 주소·이메일·아이디의 조회 영역을 추가했다.
실제 모드는 GET /api/me/profile-info로 DB의 본인 정보만 조회한다. 생년월일은 housing_surveys.birth_date,
나머지는 users에서 가져온다. 값이 없으면 미등록으로 표시한다. 개인정보 수정 기능은 이번 범위에 포함하지 않는다.
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

2026-11-15: 설정된 MySQL에서 users와 housing_surveys의 JOIN 조회 성공. 스키마 변경 없음.
검증용 로그인 계정의 ID를 지정해 다음 조회 결과와 화면을 비교한다.

```sql
SET @profile_user_id = NULL; -- 검증용 회원의 실제 ID로 바꾸기
SELECT u.id, u.login_id, u.email, u.address, h.birth_date
FROM users u LEFT JOIN housing_surveys h ON h.user_id = u.id
WHERE u.id = @profile_user_id;
```

생년월일이 로컬 설문에만 저장된 경우 서버 응답은 미등록이다. DB로의 설문 저장·이관은 후속 작업이다.
등록 주소(users.address)는 내 집 상세주소(user_settings.home_address)와 구분한다.

## 3. 프론트

백엔드를 재시작해 새 API를 반영하고 frontend에서 npm run dev 실행.
http://127.0.0.1:3000/my/settings → 로그인 → 프로필 편집 → 내 등록 정보 확인.

- Network에서 GET /api/me/profile-info가 200이고 응답이 SQL 조회와 같은지 확인.
- 설문 없는 계정은 생년월일 미등록, 소셜 계정은 아이디 대신 소셜 로그인 계정 표시.
- 서버 연결 실패는 오류·다시 시도 표시. 미등록으로 오인하지 않도록 처리.
- 다른 계정으로 로그인하면 이전 회원 정보가 표시되지 않아야 함.
- 계정·설정의 내 집 정보 클릭 → 창 제목 확인. 가계부의 계약 수정 창도 내 집 정보 수정 표시.
- 프로필 사진·닉네임 저장은 기존대로 유지.

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

팀 공유 요약: 프로필 편집에서 DB의 본인 생년월일·등록 주소·이메일·아이디를 조회하도록 추가.
생활 정보 명칭을 내 집 정보로 변경. 개인정보 편집과 주거 설문 서버 저장은 후속 범위.

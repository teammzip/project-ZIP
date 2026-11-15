# 민감정보·코드 점검 및 최적화 (2026-11-15)

## 범위와 결과

현재 Git 추적 파일과 Git에 추가될 수 있는 미추적 파일을 대상으로 키/토큰/개인키/자격증명 URL/설정 파일 패턴을 검사했다.
초기 468개 파일 중 텍스트 459개를 검사했고 수정 후에도 다시 검사했다. 비밀값은 출력하지 않았다.
현재 검사 범위에서 실사용 비밀키 패턴은 발견하지 못했다. 이것은 전체 Git 이력·바이너리·모든 종류의 개인정보가 없다는 보증은 아니다.

- 자동 탐지 5건은 카카오·네이버·구글 테스트용 문자열과 테스트 전용 JWT 키다.
- backend/application-local.properties와 frontend/.env.local은 Git 제외 대상이며 현재 추적되지 않는다.
- secrets/ 경로도 제외 규칙이 적용된다. 현재 프로젝트 루트에는 해당 디렉터리가 없다.
- 위 민감 설정 경로의 이름으로 Git 이력을 조회했을 때 기록은 나오지 않았다. 과거 모든 파일 내용에 대한 전체 이력 스캔은 별도다.
- 기존 TEAM_HANDOFF_20261115.md는 이번 점검 전부터 있던 미추적 문서로 보존했다.

## 발견 후 수정한 사항

### 의존성 보안

`npm audit`에서 follow-redirects 1.16.1의 High 취약점 1건이 발견됐다.
간접 의존성 하나만 1.16.3으로 업데이트했다. package.json의 주요 라이브러리 버전은 변경하지 않았다.
업데이트 시 npm 보안 검사 결과는 취약점 0건이다.
안내: https://github.com/advisories/GHSA-mrwp-f3q8-3g9p

### 소셜 로그인 토큰 전달

이전 콜백은 /oauth/callback?token=... 형태여서 HTTP 요청 URL을 기록하는 서버·프록시에 토큰이 남을 수 있었다.
새 서버는 #token=... fragment로 전달한다. 프론트는 읽은 직후 history.replaceState로 URL에서 제거한다.
백엔드에는 Cache-Control: no-store와 Referrer-Policy: no-referrer를 적용했다.
소셜 로그인 완료 전에 이전 회원 상태를 비우며, 응답 중 세션이 바뀌면 오래된 로그인 결과를 적용하지 않는다.

구버전 서버 query 형식도 전환 기간에 읽을 수 있으므로 프론트를 먼저 반영하고 백엔드를 반영한다.
실제 구글·카카오·네이버 제공자와의 브라우저 로그인은 재시작 후 별도 확인한다. 자동 테스트는 가짜 제공자 프로필로 검증했다.

### 성능 최적화

- 내 집 정보: 동일 세션의 동시 GET 요청을 진행 중인 Promise 하나로 합친다. 완료 후 요청은 새로 조회하며, 저장·계정 전환 후 오래된 응답 차단을 유지한다.
- 관리비: 전체 고정 지출 목록을 조회한 뒤 하나를 찾던 처리를 회원·항목 ID로 제한한 단건 JOIN 조회로 변경했다.
- 대출 이자: 같은 조건의 월 이자 계산을 반복문 밖으로 옮기고 누락 월을 JDBC batchUpdate로 저장한다. 기존 월 스냅샷과 트랜잭션은 유지한다.

동시 요청 2개가 실제 API 호출 1개로 합쳐지는 것은 테스트로 확인했다. 전체 응답 시간/부하의 개선 비율은 별도로 측정하지 않았다.

## 아직 남은 코드·환경 확인 사항

1. 현재 로컬 DB에는 kakao_place_favorites, email_verifications, place_lists, place_list_items가 없다. 해당 최신 dev 기능의 실제 동작 검증에는 적용 이력 확인과 마이그레이션이 필요하다. 이메일 전환 SQL은 ALTER/DROP을 포함하므로 이번 점검에서는 자동 적용하지 않았다.
2. 이메일 인증·회원가입·계정 찾기 요청은 프론트에 있지만 대응 백엔드 API는 미구현이다. 실제 모드의 해당 사용자 흐름은 미완료다.
3. db/tests/schema_expected.json은 최소 user_personal_info·home_contracts를 포함하지 않는다. 스키마 감사 기준을 최신 테이블·컬럼·키·FK와 맞추는 작업이 필요하다. 기존 감사 스냅샷만으로 최신 전체 DB가 일치한다고 판단하면 안 된다.
4. 일반 가계부/납부 체크·일정·알림의 서버화와 과거 금액 집계는 기존 후속 작업이다. 이번 보안·성능 수정 범위에서 동작을 확장하지 않았다.

## 검증

- 프론트 전체 테스트: 74개 통과. 토큰 fragment/구버전 query 처리, URL 제거와 이전 계정 초기화 순서, 늦은 응답 무시, 동시 내 집 정보 요청 합치기 검증 포함.
- 백엔드 전체 테스트: 122개 통과. 구글·카카오·네이버 콜백 fragment와 실제 발급 토큰의 인증 가능 여부 확인.
- 프론트 빌드·린트 통과.
- 실제 MySQL: 내 집 정보 저장·조회, 금액 단위, 날짜 초기화, 관리비·이자 중복 방지 확인. 임시 검증 계정과 데이터는 롤백.
- 실제 브라우저에서 제공자 소셜 로그인과 화면 배치 확인은 별도 수동 검증 대상.

루트에서 재검증:

```powershell
Push-Location frontend
npm ci
npm audit
node --test tests/*.test.mjs
npm run build
npm run lint
Pop-Location
Push-Location backend
.\gradlew.bat test
Pop-Location
```

## Git 공유 (현재 브랜치)

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/auth/OAuthLoginHandler.java backend/src/main/java/com/zip/backend/bills/BillRepository.java backend/src/main/java/com/zip/backend/bills/BillService.java backend/src/main/java/com/zip/backend/settings/HomeInfoService.java backend/src/test/java/com/zip/backend/GoogleLoginIntegrationTests.java backend/src/test/java/com/zip/backend/KakaoLoginIntegrationTests.java backend/src/test/java/com/zip/backend/NaverLoginIntegrationTests.java frontend/API.md frontend/package-lock.json frontend/src/features/auth/api/realAuthApi.ts frontend/src/features/auth/oauthCallback.ts frontend/src/features/life/homeApi.ts frontend/src/pages/auth/OAuthCallbackPage.tsx frontend/tests/home-api.test.mjs frontend/tests/oauth-callback.test.mjs SECURITY_CODE_REVIEW_20261115.md
git diff --cached
git commit -m "fix: 소셜 토큰 노출 보완 및 생활정보 조회 최적화"
git push origin backend
```

현재 변경은 아직 커밋·푸시하지 않았다. 다른 팀원은 npm ci로 잠금 파일의 보안 패치를 반영하고 프론트·백엔드를 함께 재시작한다.

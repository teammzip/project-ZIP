# ZIP 프론트엔드 (React)

React 19 · TypeScript · Vite로 만든 ZIP 앱이에요.
모든 화면이 동작해요. (예전 HTML 시안은 정리했고, git 기록에 남아 있어요.)

## 실행

```bash
npm install      # 처음 한 번만
npm run dev      # → http://localhost:3000
npm run build    # 타입 검사 + 배포용 빌드
npm run lint     # 코드 검사
```

- **데모 계정:** `zipdemo`(또는 `demo@zip.com`) / `zip12345`
- **관리자 데모:** `zipadmin` / `admin1234!` → 로그인하면 관리자 화면(`/admin`)만 보여요 (앱 화면으로는 못 들어감)
- **모의 API 모드:** 서버 없이 화면을 개발하거나 데모를 확인할 때 사용해요. 로그인·가입·찾기는 모의 API로 동작하고, 이메일 인증은 아무 6자리면 통과해요.
- **찾기 체험:** 닉네임 `지기` · 아이디 `zipdemo` · 이메일 `demo@zip.com`
- **실제 서버에 붙일 때:** `.env.example`을 `.env.local`로 복사하고 `VITE_USE_MOCK=false`로 바꿔요.

## 운영 빌드

```bash
npm ci           # package-lock.json 그대로 설치
npm run build    # 타입 검사 + dist/ 생성
```

- `dist/`의 파일을 정적 파일로 내보내요. 배포 방식(서버 · 클라우드)과 상관없어요.
- **항상 실제 서버 API를 써요.** [Vite 설정](vite.config.ts)이 빌드 때 `VITE_USE_MOCK=false`로 고정해요. `.env.local`이 `true`여도 같고, 데모용 모의 빌드는 `VITE_USE_MOCK=true npm run build`처럼 명령에서 직접 줄 때만 만들어져요. 확인: `dist/assets`에서 데모 계정 이름(`zipdemo`)이 검색되지 않아야 해요.
- **화면과 API를 같은 도메인에서** 내보내요. `VITE_API_BASE_URL`은 기본값 `/api` 그대로 두고, 같은 도메인의 `/api/**`와 `/login/oauth2/code/**`를 백엔드로 넘겨요. 다른 도메인 주소를 넣으면 로그인 유지(refresh 쿠키)가 동작하지 않아요. 백엔드 쪽 설정은 [운영 배포 설정](../backend/README.md#운영-배포-설정)에 있어요.
- **없는 주소도 `index.html`로** 돌려줘요. 화면 주소를 브라우저가 직접 바꾸는 방식(`createBrowserRouter`)이라, 서버가 `/my/calendar` 같은 주소를 모르면 새로고침할 때 404가 나요. 파일이 없는 주소는 `index.html`을 주도록 정적 서버를 설정해요(`/api/**` · `/login/oauth2/code/**` 제외).
- `VITE_`로 시작하는 값은 **빌드할 때 코드에 박혀요.** 바꾸면 다시 빌드해야 하고, 누구나 볼 수 있으니 비밀값을 넣지 마세요.

| 빌드 환경변수 (기본값) | 뜻 |
|---|---|
| `VITE_USE_MOCK` (빌드는 `false`) | 모의 API 모드. 운영 빌드에는 넣지 않아요 |
| `VITE_API_BASE_URL` (`/api`) | API 주소. 같은 도메인 구성이면 그대로 |
| `VITE_WEATHER_FORECAST_URL` (Open-Meteo) · `VITE_WEATHER_GEOCODING_URL` (Nominatim) | 홈 날씨 카드가 쓰는 주소. Open-Meteo 공개 API는 비상업용이라 상업 운영 때는 서버 프록시 주소로 바꿀 수 있어요. 주소 검색 · 동네 인증 · 납부 시간대 확인은 이 값과 상관없이 공개 Nominatim · Open-Meteo를 직접 써요 |
| `VITE_PROXY_TARGET` (`http://localhost:8080`) | 개발 서버(`npm run dev`) 전용. 빌드에는 쓰이지 않아요 |

## 변경 검증

`frontend/`에서 실행해요. 린트는 [Oxlint 설정](.oxlintrc.json)을 사용하고, `--deny-warnings`를 붙이면 경고가 있을 때 실패해요.

```bash
npm run lint -- --deny-warnings
node --test tests/*.test.mjs
npm run build
```

메모·일정 초안 복구는 [Playwright 시나리오](e2e/save-recovery.spec.ts)로 확인해요. 실제 프론트 화면을 실행하고 로그인·저장 응답은 테스트용 HTTP 응답으로 돌려줘요. Chromium을 설치한 뒤 브라우저 테스트를 실행할 수 있어요. PR에서도 같은 시나리오를 실행합니다.

```bash
npx playwright install chromium
npm run test:e2e
```

## 화면 주소

| 주소 | 화면 |
|---|---|
| `/start` | 시작 화면 (PC: 브랜드 소개 / 모바일: 로봇 인트로) + 로그인 창 |
| `/signup` · `/find#id` · `/find#pw` | 회원가입 · 아이디 찾기 · 비밀번호 찾기 |
| `/terms` · `/privacy` | 이용약관 · 개인정보 처리방침 |
| `/` | 홈 |
| `/ai` · `/map` · `/community` | AI(사진 첨부 상담 포함) · 동네 · 커뮤니티. `/photo` 는 `/ai` 로 이동 |
| `/my/calendar` · `/my/budget` · `/my/memo` · `/my/noti` · `/my/settings` | 마이페이지: 일정(할 일 · 기념일 포함) · 가계부(수입 · 고정 지출 · 기타 지출) · 메모장 · 알림 · 내 정보(프로필 · 로그인 방식 · 설정) |
| `/my/settings/support` | 고객센터: 자주 묻는 질문 · 1대1 문의하기 · 내 문의 내역 (관리자는 `/admin`에서 답변) |
| `/admin` | 관리자 화면: 회원 정지·경고, 게시글 관리 (관리자 계정만) |
| `/suspended` | 이용 정지 안내 (정지된 계정은 앱 대신 이 화면만). `?demo` 를 붙이면 예시 |
| 아무 화면 + `?demo=warn` | 경고 안내 창 예시 (실제로는 확인 안 한 경고가 있을 때 한 번 뜸) |

로그인 전에 앱 화면으로 가면 `/start`로 보내지고, 로그인하면 원래 가려던 곳으로 돌아와요.

## 폴더 구조

```
src/
├─ app/          router.tsx(★ 화면 주소 목록), 로그인 가드
├─ pages/        주소 하나 = 파일 하나. 부품을 조립만 해요
├─ features/     기능별 묶음
│   ├─ onboarding/ 우리 집 설문
│   ├─ loan/       전세 대출 이자 기록
│   ├─ support/    고객센터 문의
│   ├─ weather/    동네 날씨
│   ├─ auth/       로그인 · 가입 · 찾기 · 탈퇴
│   ├─ life/       일정(할 일 포함) · 가계부 · 알림 · 설정 · 오른쪽 패널
│   ├─ ai/         AI 도우미 · 대화 모달
│   ├─ community/  커뮤니티 (글·댓글 수정/삭제, 첨부)
│   ├─ moderation/ 이용 정지 · 경고 기록
│   ├─ memo/       메모장 · 홈 메모 위젯
│   ├─ profile/    프로필 사진 · 캐릭터 · 한 줄 소개
│   ├─ admin/      관리자 화면
│   ├─ map/        동네 지도
│   ├─ legal/      약관 · 처리방침 문구(★ content.ts)
│   └─ brand/      시작 화면 (문구는 ★ content.ts)
├─ components/   ui(버튼 · 카드 · 모달 등 공용 부품), layout(메뉴 · 틀)
├─ lib/          공용 도구 (apiClient, 날짜 · 금액 표시 등)
└─ styles/       tokens.css(★ 색 · 간격), 공통 스타일
```

## 지켜 주세요

1. **부품 위치:** 여러 곳에서 쓰면 `components/ui`, 한 기능에서만 쓰면 `features/<기능>/components`, 화면은 `pages/`.
2. **가져오기:** 기능 폴더 밖에서는 `@/features/<기능>`(index.ts)으로만 가져와요.
3. **서버 요청:** `features/<기능>/api`에만 써요. 화면은 훅(`useXxx`)만 불러요.
4. **스타일:** 컴포넌트 옆 `Xxx.module.css`에 쓰고, 색은 `styles/tokens.css` 변수만 써요.

## 백엔드와 맞출 것

### 모의 API 사용 범위

- **서버 없는 개발·데모**에서는 `VITE_USE_MOCK=true`를 사용해요. 설정을 생략해도 모의 모드로 실행되고, 데모 계정과 이 브라우저에서 만든 테스트 기록을 쓸 수 있어요.
- **백엔드 연동 검증**에서는 개발 서버를 실행하기 전에 `.env.local`에 `VITE_USE_MOCK=false`를 명시해요. 개발 서버는 `/api` 요청을 `VITE_PROXY_TARGET`으로 넘겨요(기본 `http://localhost:8080`).
- **운영 빌드**(`npm run build`)는 항상 실제 서버 API를 써요. 자세한 내용은 위 [운영 빌드](#운영-빌드)를 봐요.

**실서버 모드에서는 모의 API용 브라우저 저장소를 데이터 원본으로 사용하지 마세요.** 서버가 관리하는 기록은 서버 API를 기준으로 삼고, 브라우저에는 서버와 동기화되는 캐시나 기기별 화면 상태·임시 입력을 둘 수 있어요.

기능별 API와 브라우저 저장 키는 [API.md](API.md)에 정리되어 있어요.

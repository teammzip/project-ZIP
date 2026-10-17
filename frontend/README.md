# ZIP 프론트엔드 (React)

React 19 + TypeScript + Vite 로 만든 ZIP 프론트엔드입니다.
기존 HTML 시안(`../variants`, `../login`, `../compare.html`)은 **참고용으로 그대로 두고**, 화면을 하나씩 이 폴더로 옮겨 옵니다.

## 실행

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # 타입 검사 + 배포용 빌드
npm run lint
```

백엔드가 없어도 **가짜 API(mock)** 로 회원가입 → 로그인 → 로그아웃까지 동작합니다. 가입한 계정은 그 브라우저에만 저장돼요.
로그인 후 화면을 바로 보려면 **데모 계정 `demo@zip.com` / `zip12345`** 로 로그인하세요. (가짜 API 모드에서만 있음)
실제 백엔드에 붙일 때는 `.env.example` 을 복사해 `.env.local` 을 만들고 `VITE_USE_MOCK=false` 로 바꾸세요.

## 사용 라이브러리

| 라이브러리 | 하는 일 |
|---|---|
| `react-router-dom` | 화면 주소(라우팅), 로그인 안 한 사람 막기 |
| `@tanstack/react-query` | 서버 데이터 불러오기·저장(로딩/에러 상태, 캐시) |
| `zustand` | 로그인 상태처럼 앱 전체가 같이 쓰는 값 |
| `react-hook-form` + `zod` | 폼 입력 관리와 입력 검사 규칙 |
| `axios` | 서버 요청 (`lib/apiClient.ts` 하나로만) |
| `motion` | 스크롤·등장 애니메이션 (브랜드 스토리, `Reveal`) |

## 폴더 구조

```
src/
├─ main.tsx                 시작점
├─ app/                     앱 전체 설정
│   ├─ App.tsx              Provider(react-query, router) 묶음
│   ├─ router.tsx           ★ 화면 주소 목록 — 새 화면은 여기에 추가
│   ├─ guards.tsx           ProtectedRoute(로그인 필요) / GuestRoute(비로그인 전용)
│   ├─ useRedirectAfterAuth.ts  로그인 후 원래 가려던 곳으로 보내기
│   └─ setupApi.ts          apiClient 에 토큰·401 처리 연결
├─ pages/                   주소 하나 = 페이지 하나. 조립만 하고 로직은 features 에
│   ├─ start/               시작 화면 (로그인·회원가입 모달)
│   ├─ auth/                /login, /signup, /oauth/callback
│   ├─ home/ photo/ ai/ map/ community/
│   └─ my/                  마이페이지 (MyLayout 탭 + 할 일·일정·가계부·알림·내 정보)
├─ features/                기능별 묶음 (API·상태·훅·기능 전용 컴포넌트)
│   ├─ auth/
│   │   ├─ index.ts         ★ 바깥에서는 여기서만 import
│   │   ├─ types.ts         요청/응답 타입 (백엔드와 맞출 기준)
│   │   ├─ schema.ts        입력 검사 규칙 (zod)
│   │   ├─ api/             realAuthApi(실제) · mockAuthApi(가짜) · index(둘 중 선택)
│   │   ├─ store/           로그인 상태 (zustand)
│   │   ├─ hooks/           useLogin · useSignup · useLogout · useSocialLogin
│   │   └─ components/      LoginForm · SignupForm · SocialLoginButtons · AuthModal
│   └─ brand/               시작 화면 = 브랜드 스토리
│       ├─ content.ts       ★ 문구·카드 내용 (문구는 여기만 고치기)
│       └─ components/      Hero · Intro · Values · Showcase · Stories · Cta 섹션, 헤더, 푸터
├─ components/
│   ├─ ui/                  공용 부품: Button, TextField, PasswordField, Checkbox, Modal, TabNav, Reveal
│   ├─ layout/              AppLayout(사이드바·하단 메뉴·헤더), AuthLayout, navItems(메뉴 목록)
│   └─ common/              PagePlaceholder (아직 안 옮긴 화면 자리)
├─ lib/                     어디서나 쓰는 도구: apiClient, storage, cx
├─ styles/                  tokens.css(색·간격 변수), global.css
└─ assets/images/           화면에서 쓰는 그림 (../images 에서 복사)
```

## 화면 주소

| 주소 | 화면 | 접근 |
|---|---|---|
| `/start` | 브랜드 스토리 + 로그인·회원가입 모달 | 비로그인만 |
| `/login`, `/signup` | 로그인, 회원가입 | 비로그인만 |
| `/oauth/callback?token=` | 소셜 로그인 마무리 | 누구나 |
| `/` | 홈 | 로그인 필요 |
| `/photo`, `/ai`, `/map`, `/community` | 사진, AI, 동네, 커뮤니티 | 로그인 필요 |
| `/my/todo`, `/my/calendar`, `/my/budget`, `/my/noti`, `/my/settings` | 마이페이지 탭들 | 로그인 필요 |

로그인하지 않고 `/my/calendar` 에 들어가면 `/start` 로 보내지고, 로그인하면 `/my/calendar` 로 돌아옵니다.

## 컴포넌트 규칙

1. **어디에 둘까?**
   - 여러 기능이 같이 쓰고, 화면 문구·API 를 모르는 부품 → `components/ui`
   - 한 기능 안에서만 쓰는 것 → `features/<기능>/components`
   - 주소 하나에 해당하는 화면 → `pages/` (features 의 부품을 **조립만** 함)
2. **기능 폴더 밖에서는 `features/<기능>/index.ts` 로만 가져옵니다.** (`@/features/auth` O, `@/features/auth/store/authStore` X)
3. **서버 요청은 `features/<기능>/api` 에만** 씁니다. 컴포넌트는 훅(useXxx)만 부릅니다.
4. 폼 컴포넌트는 성공 후 할 일을 `onSuccess` prop 으로 받습니다. 그래서 `LoginForm` 하나를 `/login` 페이지와 시작 화면 모달에서 같이 씁니다.
5. 스타일은 컴포넌트 옆 `Xxx.module.css` (CSS Modules). 색·모서리는 `styles/tokens.css` 변수만 씁니다.
6. 경로는 `@/` (= `src/`) 로 시작합니다.

### 새 기능(예: 일정)을 옮길 때 순서

1. `features/calendar/` 만들기: `types.ts` → `api/` (mock 먼저) → `hooks/` (useQuery/useMutation) → `components/`
2. `pages/my/CalendarPage.tsx` 에서 `PagePlaceholder` 를 지우고 컴포넌트를 조립
3. 기존 시안 파일(`variants/app/js/views/calendar.js`, `css/views/calendar.css`)을 보면서 화면·동작을 맞추기

## 백엔드와 맞춰야 할 것 (인증)

현재 프론트가 기대하는 API 입니다. 바뀌면 `features/auth/api/realAuthApi.ts` 와 `types.ts` 만 고치면 됩니다.

| 메서드 | 주소 | 보내는 값 | 받는 값 |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password, nickname, address, agreeTerms }` | `{ accessToken, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ accessToken, user }` |
| GET | `/api/auth/me` | (헤더 `Authorization: Bearer <토큰>`) | `user` |
| POST | `/api/auth/logout` | — | — |
| GET | `/api/oauth2/authorization/{kakao\|google\|naver}` | 소셜 로그인 시작 | 끝나면 `/oauth/callback?token=...` 으로 이동 |

- `user` 모양: `{ id, email, nickname, address, provider }`
- 실패 응답은 `{ "message": "이미 가입된 이메일이에요." }` 처럼 주면 그 문장이 화면에 그대로 보입니다.
- 토큰이 만료되면 **401** 로 응답 → 프론트가 자동으로 로그아웃시킵니다.
- 입력 규칙(`features/auth/schema.ts`): 비밀번호 8자 이상 + 영문·숫자 포함, 닉네임 2~12자.
- 프론트 개발 서버는 `http://localhost:3000` 이고, `/api` 요청은 Vite 가 `http://localhost:8080`(백엔드)으로 넘깁니다(`VITE_PROXY_TARGET` 으로 변경). 백엔드는 3000 이 아닌 다른 포트를 써 주세요.

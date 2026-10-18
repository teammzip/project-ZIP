# ZIP 프론트엔드 (React)

React 19 · TypeScript · Vite로 만든 ZIP 앱이에요.
HTML 시안(`../variants`)을 옮겨 왔고, 모든 화면이 동작해요.

## 실행

```bash
npm install      # 처음 한 번만
npm run dev      # → http://localhost:3000
npm run build    # 타입 검사 + 배포용 빌드
npm run lint     # 코드 검사
```

- **데모 계정:** `zipdemo`(또는 `demo@zip.com`) / `zip12345`
- **서버 없이 동작해요.** 로그인·가입·찾기는 가짜 API, 그 밖의 기록은 브라우저(localStorage)에 저장돼요. 휴대전화 인증은 아무 6자리면 통과해요.
- **찾기 체험:** 닉네임 `지기` · 아이디 `zipdemo` · 휴대전화 `010-1234-5678`
- **실제 서버에 붙일 때:** `.env.example`을 `.env.local`로 복사하고 `VITE_USE_MOCK=false`로 바꿔요.

## 화면 주소

| 주소 | 화면 |
|---|---|
| `/start` | 시작 화면 (PC: 브랜드 소개 / 모바일: 로봇 인트로) + 로그인 창 |
| `/signup` · `/find#id` · `/find#pw` | 회원가입 · 아이디 찾기 · 비밀번호 찾기 |
| `/terms` · `/privacy` | 이용약관 · 개인정보 처리방침 |
| `/` | 홈 |
| `/photo` · `/ai` · `/map` · `/community` | 사진 · AI · 동네 · 커뮤니티 |
| `/my/todo` · `/my/calendar` · `/my/budget` · `/my/noti` · `/my/settings` | 마이페이지: 할 일 · 일정 · 가계부 · 알림 · 내 정보 |

로그인 전에 앱 화면으로 가면 `/start`로 보내지고, 로그인하면 원래 가려던 곳으로 돌아와요.

## 폴더 구조

```
src/
├─ app/          router.tsx(★ 화면 주소 목록), 로그인 가드
├─ pages/        주소 하나 = 파일 하나. 부품을 조립만 해요
├─ features/     기능별 묶음
│   ├─ auth/       로그인 · 가입 · 찾기 · 탈퇴
│   ├─ life/       할 일 · 일정 · 가계부 · 알림 · 설정 · 오른쪽 패널
│   ├─ ai/         AI 도우미 · 대화 모달
│   ├─ community/  커뮤니티
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

API 주소 · 요청 · 응답 모양은 **[API.md](API.md)** 에 정리해 두었어요.

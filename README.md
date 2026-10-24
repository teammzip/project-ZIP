# ZIP – 자취생 생활 도우미

혼자 사는 사람을 위한 생활 관리 웹 서비스예요.
일정 · 할 일 · 월세 · 공과금 · 쓰레기 배출 · 가계부를 한곳에서 관리하고, 동네 지도 · 커뮤니티 · AI 도우미를 제공해요.

> **지금 단계:** 화면은 다 만들었고 **서버·DB는 아직 없어요.** 입력한 데이터는 브라우저에만 저장되고, AI 답변·장소·배출 요일은 예시예요.

---

## 바로 실행하기

**실제 앱 (React)**: 앞으로 계속 만들어 갈 쪽이에요.

준비물: **Node.js 22** (20.19 이상이면 돼요). 터미널에서 `node -v`로 확인하고, 낮으면 [nodejs.org](https://nodejs.org)에서 LTS를 설치하세요.

```bash
git clone https://github.com/teammzip/project-ZIP.git   # 처음 한 번만 (이미 받았으면 git pull)
cd project-ZIP/frontend
npm install      # 처음 받았을 때, package.json 이 바뀌었을 때
npm run dev      # → 브라우저에서 http://localhost:3000
```
- 끌 때는 터미널에서 `Ctrl + C`
- 데모 계정 `zipdemo` / `zip12345` 로 바로 둘러볼 수 있어요. 서버·DB 없이 동작해요.
- 자세한 내용은 [frontend/README.md](frontend/README.md)를 보세요.

**HTML 시안 (참고용)**: VS Code의 `Live Server`(Go Live)로 `compare.html`을 열면 위쪽 버튼으로 화면을 골라 볼 수 있어요.
파일을 더블클릭해서 열면 동작하지 않아요.

---

## 폴더 한눈에 보기

```
frontend/      ★ 실제 앱 (React + TypeScript)
variants/      HTML 시안: app(메인 앱) · start-pc · start-mobile · account(회원가입·찾기) · admin(관리자: 회원·게시글 관리)
login/         시작 화면의 로그인 창 공통 코드 (약관 문구는 variants/account/terms.js)
shared/        시안 공통: 모바일 스크롤 · 계정(zip-password.js) · 이용 정지 기록(zip-ban.js)
db/            DB 설계: 구조 그림(ERD) 5장 + 표 만드는 SQL(schema.sql) + 한글 설명서(README.md)
images/        로고 · 아이콘 · 로봇 · 집 그림
compare.html   시안을 버튼으로 골라 보는 미리보기 (개발용)
```

---

## 지금 상태

| ✅ 된 것 | ⏳ 남은 것 |
|---|---|
| 모든 화면 (홈 · 사진 · AI · 동네 · 커뮤니티 · 마이페이지) | 서버 · DB 연결 |
| 회원가입 · 로그인 · 아이디/비밀번호 찾기 · 탈퇴 (화면 동작) | 실제 인증 (지금은 가짜 API) |
| PC · 모바일 화면, 모바일 인트로 | 실제 AI 연동 |
| 이용약관 · 개인정보 처리방침 (초안) | 약관 법률 검토, `[ ]` 칸 채우기 |
| DB 설계 (표 35개 + 집계 VIEW 2개, MySQL 8, `db/`) · API 약속 (`frontend/API.md`, DB 기준으로 전 영역 정리) | 백엔드 API 만들기, DB 남은 차이 정리 (`events` 완료 칸, 탈퇴 후 재가입 막기) |
| 관리자 화면 · 이용 정지 (React `/admin`, 시안 `variants/admin`) | 관리자 기능을 서버로 옮기기 |

---

## 협업 규칙

브랜치는 **`main` ← `dev` ← 담당 브랜치** 순서로 합쳐요.

```
main          최종 결과물
 └─ dev       모두의 작업을 모으는 곳 (기본 브랜치)
     ├─ test      팀장 — HTML 시안 (variants · login · compare.html)
     ├─ front     프론트엔드 — React 앱 (frontend/)
     └─ backend   백엔드 — 서버 API · DB
```

| 브랜치 | 담당 | 하는 일 |
|---|---|---|
| `main` | 팀 전체 | 최종 제출 · 배포용. 마지막에 `dev`에서 한 번만 머지 |
| `dev` | 팀 전체 | 작업을 모으는 곳. **PR로만** 머지 |
| `test` | 팀장 | 화면 시안(HTML) 작업 |
| `front` | 프론트엔드 | React 앱(`frontend/`) 작업 |
| `backend` | 백엔드 | 서버 · DB 작업. 프론트와 맞출 API는 [frontend/API.md](frontend/API.md) |

**작업 순서**
```bash
git checkout <내 브랜치>
git pull origin dev              # 1. 최신 dev 받기
git add . && git commit -m "작업 내용"
git push origin <내 브랜치>       # 2. 내 브랜치에 올리기
```
3. GitHub에서 **`<내 브랜치>` → `dev`** 로 Pull Request를 만들어요.

**지켜 주세요**
- `main`, `dev`에는 직접 push하지 않아요.
- PR 전에 `git pull origin dev`로 충돌을 내 브랜치에서 먼저 해결해요.
- 다른 사람 담당 파일을 고칠 땐 먼저 알려 주세요.

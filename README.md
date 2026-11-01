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

---

## 폴더 한눈에 보기

```
frontend/      ★ 실제 앱 (React + TypeScript)
db/            DB 설계: 표 만드는 SQL(schema.sql) + 한글 설명서(README.md)
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
| 관리자 화면 · 이용 정지 (React `/admin`) | 관리자 기능을 서버로 옮기기 |

---

## 협업 규칙

브랜치는 **`main` ← `dev` ← 담당 브랜치** 순서로 합쳐요.

```
main          최종 결과물
 └─ dev       모두의 작업을 모으는 곳 (기본 브랜치)
     ├─ test      팀장 — 화면 디자인 · 기획
     ├─ front     프론트엔드 — React 앱 (frontend/)
     └─ backend   백엔드 — 서버 API · DB
```

| 브랜치 | 담당 | 하는 일 |
|---|---|---|
| `main` | 팀 전체 | 최종 제출 · 배포용. 마지막에 `dev`에서 한 번만 머지 |
| `dev` | 팀 전체 | 작업을 모으는 곳. **PR로만** 머지 |
| `test` | 팀장 | 화면 디자인 · 기획 |
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

---

## 비밀 정보는 깃에 올리지 않아요 (.gitignore)

API 키 · 비밀번호 · DB 백업처럼 **남에게 보이면 안 되는 파일**은 `.gitignore`에 적어 두면 `git add`에서 빠져서 GitHub에 올라가지 않아요. 파일 이름도, 내용도 올라가지 않아요.

**이미 막혀 있는 것** (루트 [.gitignore](.gitignore))

| 종류 | 예시 |
|---|---|
| 키 · 접속 정보 | `.env`, `.env.*`, `*.key`, `*.pem`, `.my.cnf` |
| DB 백업 · 덤프 | `*.dump`, `*.bak`, `dump.sql`, `*.sqlite`, `/db/backups/` |
| 개인 메모 | `비밀메모.txt`, `secrets/` |
| 맥 자동 생성 파일 | `.DS_Store` |

- `.env.example`처럼 **값 없이 이름만 적은 견본**은 올라가요. 실제 키는 각자 `.env`에만 적어요.
- 키 값은 팀 채팅 같은 **깃 밖**에서 따로 공유해요.

**쓰는 법**
1. 올리고 싶지 않은 파일 이름을 `.gitignore`에 한 줄씩 적어요. 폴더는 `secrets/`처럼 끝에 `/`를 붙여요.
2. 확인은 아래 명령으로 해요. 규칙이 나오면 무시되는 거예요.
   ```bash
   git check-ignore -v 파일이름
   ```

**꼭 기억하세요**
- `.gitignore`는 **먼저** 적고 파일을 **나중에** 만드세요. 이미 커밋된 파일은 적어도 계속 올라가요. 추적만 끊으려면 `git rm --cached 파일`을 써요.
- 한 번 올라간 키는 지워도 깃 기록에 남아요. 그때는 해당 서비스에서 **키를 재발급**하세요.
- `.gitignore`는 팀 전체에 적용돼요. 필요한 줄만 **추가**하고 기존 줄은 지우지 마세요.
- `.gitignore` 안에는 파일 **이름만** 적고, 키 값은 절대 적지 마세요.
- 프론트의 `VITE_`로 시작하는 환경변수는 브라우저에서 누구나 볼 수 있어요. 비밀 키는 **백엔드 `.env`에만** 두세요.

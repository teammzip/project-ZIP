# ZIP – 자취생 생활 도우미

혼자 사는 사람을 위한 생활 관리 웹 서비스예요.
일정 · 할 일 · 월세 · 공과금 · 쓰레기 배출 · 가계부를 한곳에서 관리하고, 동네 지도 · 커뮤니티 · AI 도우미를 제공해요.

> **지금 단계:** 화면과 백엔드 API가 거의 다 만들어져 서로 연결돼 있어요. 프론트는 기본이 가짜 API(브라우저 저장)이고 `VITE_USE_MOCK=false`일 때 실제 서버를 써요. 무엇이 되고 무엇이 남았는지는 아래 [지금 상태](#지금-상태)를 보세요.

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
- 데모 계정 `zipdemo` / `zip12345` 로 바로 둘러볼 수 있어요. 기본 설정에서는 서버·DB 없이 동작해요.
- 실제 백엔드와 붙여 보려면 아래 "백엔드 실행"을 보세요.
- 자세한 내용은 [frontend/README.md](frontend/README.md)를 보세요.

---

## 백엔드 실행 (선택)

준비물: Java 17, MySQL 8, `db/schema.sql`로 만든 DB.

1. `backend/application-local.properties.example`을 참고해 `backend/application-local.properties`를 만들고 `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` · `JWT_SECRET`(Base64, 32바이트 이상)을 채워요. MySQL 포트와 DB 이름은 각자 환경에 맞게 `DB_URL`에 적어요. 메일 인증은 `MAIL_*`, 지도 · 동네 인증은 `KAKAO_REST_KEY` 값이 필요해요(example 참고). 이 파일은 깃에 올라가지 않아요.
   - 이미 쓰던 DB는 새로 받은 코드에 맞게 [db/migrations](db/migrations/README.md)의 새 파일을 적용해요. 새 DB는 `db/schema.sql`만 실행하면 돼요.
2. (선택) 소셜 로그인: 키가 있는 공급자만 켜져요. 값은 `backend/application-local.properties`나 아래 파일에 넣어요(깃에 올라가지 않아요).

   | 공급자 | 파일 | 키 이름 | 콘솔에 등록할 리디렉션 URI |
   |---|---|---|---|
   | 구글 | `secrets/google.properties` | `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/google` |
   | 네이버 | `secrets/naver.properties` | `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/naver` |
   | 카카오 | `secrets/kakao.properties` | `KAKAO_LOGIN_CLIENT_ID` · `KAKAO_LOGIN_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/kakao` |

   AI 답변(Gemini)은 `secrets/gemini.properties`에 `GEMINI_API_KEY=키`를 넣어요. 키가 없으면 AI 화면은 기존 데모 답변을 써요.
3. `cd backend && ./gradlew bootRun` (또는 IntelliJ에서 `BackendApplication` 실행).
4. 프론트에서 `frontend/.env.local`에 `VITE_USE_MOCK=false`를 넣으면 실제 서버를 써요.
5. 테스트: `./gradlew test` (Windows에서 한글 깨짐으로 실패하면 `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8`을 붙여요).

---

## 폴더 한눈에 보기

```
frontend/      ★ 실제 앱 (React + TypeScript)
backend/       서버 API (Spring Boot, Gradle)
db/            DB 설계: 표 만드는 SQL(schema.sql) + 마이그레이션 + 검증 SQL + 한글 설명서(README.md)
secrets/       (선택) 로컬 비밀값(구글 키 등). 깃에 올리지 않아요
```

**백엔드 기술 스택**: Java 17 · Spring Boot 4.1.2 · **Gradle**(빌드 도구, Maven 은 쓰지 않음) · Spring Data JPA 의존성 + JdbcTemplate 방식 · MySQL · Spring Security + JWT · OAuth2 클라이언트(구글 로그인).

---

## 지금 상태

**서버까지 연결된 기능**: 회원가입 · 로그인(구글 · 네이버 · 카카오) · 이메일 인증 · 아이디/비밀번호 찾기 · 탈퇴, 프로필 · 설정 · 동네 인증 · 주거 설문 · 내 집 정보, 일정 · 기념일, 메모, 가계부(수입 · 지출 · 월급) · 고정 지출 · 고지서 사진 인식(AI), 알림(댓글 · 답글 · 경고 · 문의 답변 · 일정 · 쓰레기 배출 · 월세), 공지사항, 커뮤니티(글 · 댓글 · 공감 · 첨부 · 신고 · 인기 글), 지도(장소 · 저장 리스트 · AI 검색), AI 대화, 고객센터, 관리자(회원 · 경고 · 정지 · 신고 · 게시글 · 문의 · 공지).

**남은 것**
- 쓰레기 배출 요일: 서버 API는 있는데 화면은 아직 고정표
- 약관: 법률 검토 후 `[ ]` 칸 채우기
- 토큰 재발급

**문서 안내**
| 보고 싶은 것 | 문서 |
|---|---|
| 프론트 · 백엔드 · DB 에서 누가 언제 무엇을 했는지 (PR 마다 한 줄씩 추가) | [CHANGELOG.md](CHANGELOG.md) |
| 프론트 ↔ 서버 API 전체와 기능별 상태 | [frontend/API.md](frontend/API.md) |
| 프론트 폴더 · 실행 | [frontend/README.md](frontend/README.md) |
| 백엔드 실행 · 기능별 구현 설명 | [backend/README.md](backend/README.md) · [backend/IMPLEMENTATION.md](backend/IMPLEMENTATION.md) |
| DB 표 설명 · 기존 DB 바꾸기 · DB 검증 | [db/README.md](db/README.md) · [db/migrations/README.md](db/migrations/README.md) · [db/tests/README.md](db/tests/README.md) |

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

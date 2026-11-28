# ZIP – 자취생 생활 도우미

혼자 사는 사람을 위한 생활 관리 웹 서비스예요.
일정 · 할 일 · 월세 · 공과금 · 쓰레기 배출 · 가계부를 한곳에서 관리하고, 동네 지도 · 커뮤니티 · AI 도우미를 제공해요.

> **지금 단계:** 화면과 백엔드 API가 다 만들어져 서로 연결돼 있고, 배포 전 마무리(문서 · 운영 설정 · 통합 테스트) 중이에요. 개발 서버(`npm run dev`)는 기본이 가짜 API(브라우저 저장)이고 `VITE_USE_MOCK=false`일 때 실제 서버를 써요. 배포용 빌드(`npm run build`)는 항상 실제 서버를 써요. 무엇이 되고 무엇이 남았는지는 아래 [지금 상태](#지금-상태)를 보세요.

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
   - 새 DB는 [db/schema.sql](db/schema.sql)로 구조를 만들어요. 전국 배출표와 주변 동네 기능을 사용하려면 [신규 DB용 데이터 적용 순서](db/migrations/README.md)를 따라 지역·배출표·이웃 관계를 넣어요.
   - 이미 쓰던 DB는 [기존 DB 마이그레이션 안내](db/migrations/README.md)에 따라 새 파일을 적용해요.
2. (선택) 소셜 로그인: 키가 있는 공급자만 켜져요. 값은 `backend/application-local.properties`나 아래 파일에 넣어요(깃에 올라가지 않아요).

   | 공급자 | 파일 | 키 이름 | 콘솔에 등록할 리디렉션 URI |
   |---|---|---|---|
   | 구글 | `secrets/google.properties` | `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/google` |
   | 네이버 | `secrets/naver.properties` | `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/naver` |
   | 카카오 | `secrets/kakao.properties` | `KAKAO_LOGIN_CLIENT_ID` · `KAKAO_LOGIN_CLIENT_SECRET` | `http://localhost:8080/login/oauth2/code/kakao` |

   AI 답변(Gemini)은 `secrets/gemini.properties`에 `GEMINI_API_KEY=키`를 넣어요. 키가 없으면 서버가 503(`AI_DISABLED`)으로 답해서 자유 질문에는 "AI를 쓸 수 없어요" 안내가 떠요. 데모 답변은 모의 API 모드에서만 나와요.
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

**서버까지 연결된 기능**: 회원가입 · 로그인(구글 · 네이버 · 카카오) · 이메일 인증 · 아이디/비밀번호 찾기 · 탈퇴, 프로필 · 설정 · 동네 인증 · 주거 설문 · 내 집 정보, 일정 · 기념일, 메모, 가계부(수입 · 지출 · 월급) · 고정 지출 · 고지서 사진 인식(AI), 알림(댓글 · 답글 · 경고 · 문의 답변 · 일정 · 월세), 우리 동네 쓰레기 배출표(일정 화면, 전국 공공데이터), 공지사항, 커뮤니티(글 · 댓글 · 공감 · 첨부 · 신고 · 인기 글), 지도(장소 · 저장 리스트 · AI 검색), AI 대화, 고객센터, 관리자(회원 · 경고 · 정지 · 신고 · 게시글 · 문의 · 공지).

서버 모드에서는 로그인 후 일정 화면의 ‘우리 동네 쓰레기 배출표’를 펼치면 주소에 해당하는 정보를 조회해요. 배출일 알림은 2026-11-28 에 없앴어요. [배출표 조회](wiki/topics/trash-schedules.md)

**남은 것**
- 로컬 통합 테스트: 실제 서버로 화면부터 DB까지 기능별 확인 (팀 공동)
- 배포 방식(서버 · 클라우드) 결정 후: 서버 · HTTPS · 같은 도메인 구성 · 소셜 로그인 운영 주소 등록 — 필요한 설정은 [운영 배포 설정](backend/README.md#운영-배포-설정)
- 약관: 클라우드 업체 · 보관 국가와 운영 메일 업체 확정 후 처리방침 5번 마무리, 처리방침 1번 수집 항목에 동네 인증 위치(GPS) 넣을지 결정, 출시 전 법률 검토. 외부 전송(카카오 · OpenStreetMap · Open-Meteo · Gmail)은 2026-11-27에 반영
- 화면에서 쓰지 않는 백엔드 API: 예전 일반 고정 지출 5개 · 일정 완료 전용 1개는 2026-11-28에 지움. 관리자 일괄 제재 · 일정 검색 · 홈 꿀팁 3개 · 생활 설정 2개는 팀 협의 후 결정, 지역 목록은 유지

**문서 안내**
| 보고 싶은 것 | 문서 |
|---|---|
| 프론트 · 백엔드 · DB 에서 누가 언제 무엇을 했는지 (PR 마다 한 줄씩 추가) | [CHANGELOG.md](CHANGELOG.md) |
| 기능별 동작, 결정 이유, 검증 결과 | [Second Brain](wiki/index.md) |
| 프론트 ↔ 서버 API 전체와 기능별 상태 | [frontend/API.md](frontend/API.md) · OpenAPI 명세 [backend/openapi.yaml](backend/openapi.yaml) |
| 시스템 구성도 (화면 · 백엔드 · DB · 외부 연동) | [앱 구조와 실행 모드](wiki/topics/application.md#시스템-구성) |
| 프론트 폴더 · 실행 · 운영 빌드 | [frontend/README.md](frontend/README.md) · [운영 빌드](frontend/README.md#운영-빌드) |
| 백엔드 실행 · 기능별 구현 설명 · 운영 환경변수 | [backend/README.md](backend/README.md) · [운영 배포 설정](backend/README.md#운영-배포-설정) · [backend/IMPLEMENTATION.md](backend/IMPLEMENTATION.md) |
| DB 표 설명 · 관계도(ERD) · 기존 DB 바꾸기 · DB 검증 | [db/README.md](db/README.md) · [관계도](db/README.md#관계도-erd) · [db/migrations/README.md](db/migrations/README.md) · [db/tests/README.md](db/tests/README.md) |
| 운영 · QA 용 새 DB 만들기 · 첫 관리자 계정 | [운영 DB 새로 만들기](db/README.md#운영-db-새로-만들기-첫-배포--qa용-새-db) |

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

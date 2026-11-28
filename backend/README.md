# ZIP backend

Java 17 · Spring Boot 4 · JdbcTemplate · MySQL · Spring Security + JWT(DB 세션) 서버예요. 상위 project-ZIP 저장소에서 같이 관리해요.

- 어떤 API 가 있는지: [frontend/API.md](../frontend/API.md) (프론트와의 약속 · 기능별 상태)
- 기능별 서버 규칙 · Postman 확인 방법: [IMPLEMENTATION.md](IMPLEMENTATION.md)
- DB 표 · 기존 DB 바꾸기: [db/README.md](../db/README.md) · [db/migrations/README.md](../db/migrations/README.md)

## 처음 설정

1. MySQL 을 켜고 DB 를 준비해요. 새 DB 는 `db/schema.sql`(이 파일은 `zip` DB 를 만들어 선택해요), 이미 쓰던 DB 는 [마이그레이션 안내](../db/migrations/README.md)대로 새 파일만 적용해요.
2. 이 폴더의 `application-local.properties.example` 을 `application-local.properties` 로 복사하고 값을 채워요. 이 파일은 Git 에 올라가지 않아요(`.example` 에는 실제 값을 넣지 마세요).

   | 키 | 필요할 때 |
   |---|---|
   | `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` | 항상. MySQL 포트 · DB 이름은 각자 환경대로 (`jdbc:mysql://localhost:3306/zip?...`) |
   | `JWT_SECRET` | 항상. Base64, 32바이트 이상 |
   | `MAIL_HOST` · `MAIL_PORT` · `MAIL_USERNAME` · `MAIL_PASSWORD` | 이메일 인증(가입 · 계정 찾기). 개발 중 실제로 안 보내려면 `MAIL_LOG_ONLY=true` |
   | `KAKAO_REST_KEY` | 지도 장소 검색 · 동네 인증 |
   | `GEMINI_API_KEY` | AI 대화 · 고지서 사진 인식 |
   | `GOOGLE_*` · `NAVER_*` · `KAKAO_LOGIN_*` | 소셜 로그인 (키가 있는 공급자만 켜짐, 루트 [README](../README.md#백엔드-실행-선택) 참고) |

   IntelliJ 실행 구성의 환경변수로 넣어도 되고, 환경변수가 이 파일보다 우선해요. `.env` 파일은 읽지 않아요.

   남용 방지 제한은 기본값으로 돌아가고, 바꿀 때만 환경변수를 넣어요(Spring 이 `ZIP_MAIL_IP_PER_WINDOW` → `zip.mail.ip-per-window` 처럼 자동으로 읽음).

   | 환경변수 (기본값) | 뜻 |
   |---|---|
   | `ZIP_MAIL_IP_WINDOW_MINUTES`(10) · `ZIP_MAIL_IP_PER_WINDOW`(5) · `ZIP_MAIL_IP_PER_DAY`(20) | 인증 메일: 같은 IP 에서 10분에 5통 · 하루 20통. 프록시 뒤에서도 아래 `SERVER_FORWARD_HEADERS_STRATEGY` 기본값으로 실제 IP 마다 나뉨 |
   | `SERVER_FORWARD_HEADERS_STRATEGY`(`native`) | 프록시(nginx · Render · 로드밸런서) 뒤에서 `X-Forwarded-For` · `X-Forwarded-Proto` 로 실제 IP 와 https 를 읽음. 메일 IP 제한 · refresh 쿠키 Secure · 소셜 로그인 돌아올 주소에 쓰임. 바로 연결한 곳이 내부 주소(127.x · 10.x · 172.16~31.x · 192.168.x 등)일 때만 믿어서 프록시 없이 띄워도 IP 를 속일 수 없음. 프록시가 공인 IP 면 `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES` 로 지정, 끄려면 `none` |
   | `ZIP_MAIL_GLOBAL_PER_HOUR`(100) · `ZIP_MAIL_GLOBAL_PER_DAY`(400) | 인증 메일: 서버 전체 시간당 · 하루 상한. 메일 계정 발송 한도(Gmail 하루 약 500통)보다 낮게 |
   | `ZIP_FILES_DAILY_LIMIT`(50) · `ZIP_FILES_PENDING_LIMIT`(20) | 사진: 회원 한 명이 24시간에 올릴 수 있는 장수 · 아직 글 · 프로필 · 리뷰에 안 붙인 사진 장수 |
3. IntelliJ 에서 JDK 17 을 고르고 Gradle 을 새로고침해요.

DB 구조는 `db/` 의 SQL 로만 관리해요(Hibernate 자동 생성 · Spring SQL 자동 실행은 꺼져 있음). DB 에 접속하지 못하면 서버가 켜지지 않아요.

## 실행

IntelliJ 에서 `BackendApplication` 을 실행해요(작업 폴더는 `backend` 또는 저장소 최상위). 기본 포트는 8080 이고, 프론트 개발 서버(3000)가 `/api` 요청을 여기로 넘겨요.

터미널에서는 `backend` 폴더에서:

```powershell
.\gradlew.bat bootRun
```

## 운영 배포 설정

배포 방식(서버 · 클라우드)과 상관없이 똑같이 필요한 설정이에요. 운영 DB 만들기와 첫 관리자 계정은 [운영 DB 새로 만들기](../db/README.md#운영-db-새로-만들기-첫-배포--qa용-새-db)를 따라요.

**빌드와 실행**: `backend` 폴더에서 `./gradlew bootJar` 를 실행하면 `build/libs/backend-0.0.1-SNAPSHOT.jar` 하나가 만들어져요. 서버에서는 JDK 17 로 `java -jar backend-0.0.1-SNAPSHOT.jar` 를 실행해요. 설정은 **서버의 환경변수**로 넣는 걸 권장해요. 파일로 넣으려면 실행하는 폴더에 `application-local.properties` 를 두면 읽어요(Git · 배포 묶음에 넣지 말고 읽기 권한을 서버 계정만으로 제한).

**운영 전제 두 가지**
- **화면과 API 는 같은 도메인**이어야 해요. 서버에 CORS 설정이 없고, 로그인 유지(refresh) 쿠키가 같은 출처에서만 동작해요. 프록시나 플랫폼 설정으로 `https://도메인/` 의 화면, `/api/**`(소셜 로그인 시작 `/api/oauth2/authorization/**` 포함), 소셜 로그인 콜백 `/login/oauth2/code/**` 를 한 도메인에서 내보내요.
- **백엔드는 한 대만** 띄워요. 예약 작업 3개(계약 자동 등록 · 월세 알림 · 오래된 데이터 정리), 남용 방지 횟수, 소셜 로그인 진행 상태가 서버 메모리에 있어서 여러 대면 중복 알림이 생기거나 제한이 대수만큼 늘어나요.

**운영에서 꼭 넣을 값** (⚠️ = 기본값이 개발용이라 그대로 두면 운영에서 문제가 됨)

| 환경변수 | 운영 값 | 빠뜨리거나 기본값이면 |
|---|---|---|
| `DB_URL` | 운영 DB 주소. 뒤의 `?connectionTimeZone=Asia/Seoul&characterEncoding=UTF-8` 은 유지 | ⚠️ 기본값은 `localhost:3306/zip` |
| `DB_USERNAME` · `DB_PASSWORD` | 앱 전용 DB 계정(root 금지) | 서버가 켜지지 않음 |
| `JWT_SECRET` | **새로 만든 값**. 개발용 값을 다시 쓰지 않아요. 예: `openssl rand -base64 48` | 서버가 켜지지 않음 (Base64 · 32바이트 이상 검사) |
| `ZIP_AUTH_COOKIE_SECURE` | `true` | ⚠️ 기본 `false`. 프록시가 `X-Forwarded-Proto: https` 를 넘기면 자동으로 Secure 가 붙지만, 운영은 명시해 두기 |
| `FRONTEND_URL` | `https://도메인` (화면 주소, 끝에 `/` 없이) | ⚠️ 기본 `http://localhost:3000`. 소셜 로그인을 마친 사람이 localhost 로 보내짐 |
| `ZIP_UPLOAD_DIR` | 저장소 밖 **절대 경로**, 재배포해도 남는 디스크. 백업 대상 | ⚠️ 기본 `./var/uploads`(실행 폴더 기준). 재배포 · 재시작 때 프로필 · 글 · 리뷰 사진이 사라질 수 있음 |
| `MAIL_HOST` · `MAIL_PORT` · `MAIL_USERNAME` · `MAIL_PASSWORD` | 운영 메일 계정 (Gmail 은 앱 비밀번호). STARTTLS 필수 | 가입 · 아이디 찾기 · 비밀번호 재설정 메일이 503 |
| `MAIL_LOG_ONLY` | `false` (기본값 그대로) | ⚠️ `true` 면 메일을 보내지 않고 인증번호를 서버 로그에 남김 (개발 전용) |
| `KAKAO_REST_KEY` | 카카오 로컬 REST 키 | 지도 검색은 DB 장소만 보이고, 동네 인증은 503 |
| `GEMINI_API_KEY` | Gemini API 키 | AI 대화 · 고지서 인식은 503 ("AI 를 쓸 수 없어요" 안내) |
| `GOOGLE_*` · `NAVER_*` · `KAKAO_LOGIN_*` | 공급자별 클라이언트 id · secret. 각 개발자 콘솔에 `https://도메인/login/oauth2/code/google`(`naver` · `kakao`)를 돌아올 주소로 등록 | 키가 없는 공급자의 소셜 로그인은 꺼짐 |
| `SERVER_FORWARD_HEADERS_STRATEGY` | `native` (기본값 그대로) | 프록시 뒤에서 실제 IP · https 를 못 읽음 (위 표 참고) |

**기본값 그대로 써도 되는 값** (바꿀 때만 넣어요)

| 환경변수 (기본값) | 뜻 |
|---|---|
| `KAKAO_PER_USER_PER_MINUTE`(30) · `KAKAO_DAILY_LIMIT`(30000) | 카카오 무료 한도 보호: 한 사람 1분 · 서버 하루 호출 수 (한국 시간) |
| `AI_DAILY_LIMIT`(30) · `GEMINI_MODEL`(`gemini-3.1-flash-lite`) | 한 사람 하루 AI 질문 수 · 쓰는 모델 |
| `DATA_CLEANUP_ENABLED`(true) · `NOTIFICATION_KEEP_DAYS`(90) | 6시간마다 만료 세션 · 인증번호 정리, 알림 보관 일수 |
| 인증 메일 · 사진 남용 방지 | 위 [처음 설정](#처음-설정)의 두 번째 표 |

## 테스트

```powershell
$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'   # Windows 한글 깨짐 방지
.\gradlew.bat test                               # H2(MySQL 호환 모드) — 실제 DB 를 건드리지 않음
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql   # 고정 지출을 실제 MySQL 로 재검증 (임시 데이터는 롤백)
```

Postman 컬렉션: [생활 설정](postman/life-settings.postman_collection.json)

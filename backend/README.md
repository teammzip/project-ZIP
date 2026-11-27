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

## 테스트

```powershell
$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'   # Windows 한글 깨짐 방지
.\gradlew.bat test                               # H2(MySQL 호환 모드) — 실제 DB 를 건드리지 않음
.\gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql   # 고정 지출을 실제 MySQL 로 재검증 (임시 데이터는 롤백)
```

Postman 컬렉션: [생활 설정](postman/life-settings.postman_collection.json) · [고정 지출](postman/fixed-bills.postman_collection.json)

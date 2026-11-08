# ZIP backend

Spring Boot + Spring Web MVC + JPA + MySQL 프로젝트입니다. 상위 project-ZIP Git 저장소에서 함께 관리합니다.

로그인·JWT/DB 세션·내 정보 조회·비밀번호 변경·로그아웃·약관 조회가 구현돼 있습니다. 문자 인증 및 회원가입은 아직 연결 대기 상태입니다. 실행 설정, 테스트 계정 준비, 지원 API와 약관 점검 결과는 [인증 기반 API 연결](IMPLEMENTATION.md)을 참고하세요. DB 설정 외에 `JWT_SECRET`도 필요합니다.

## 로컬 DB 연결

1. MySQL을 실행하고 사용할 DB 이름을 확인합니다. 예시 주소는 `zip_test`입니다. 이미 준비된 테스트 DB를 사용할 수 있습니다. 새 DB 준비 및 기존 DB 변경은 [DB 안내](../db/README.md)를 따릅니다. `db/schema.sql`은 `zip` DB를 생성·선택하므로 테스트 DB에 그대로 실행하지 않습니다.
2. 이 폴더의 `application-local.properties.example`을 `application-local.properties`로 복사합니다.
3. 복사한 파일에 `DB_USERNAME`, `DB_PASSWORD`를 입력합니다. 접속 주소가 다르면 `DB_URL`도 수정합니다. 실제 설정 파일은 Git에서 제외됩니다.
4. IntelliJ에서 `BackendApplication`을 실행합니다. 실행 작업 디렉터리는 `backend` 또는 프로젝트 최상위 폴더로 지정합니다. 기본 서버 포트는 8080입니다.

설정 파일 대신 IntelliJ 실행 구성의 환경변수에 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 지정해도 됩니다. 환경변수가 로컬 파일보다 우선합니다. `.env` 파일은 자동으로 읽지 않습니다.

실제 계정·비밀번호는 `application-local.properties`에만 입력하고, Git으로 공유하는 `.example` 파일의 계정·비밀번호는 비워 둡니다.

프로젝트 Java Toolchain은 17입니다. IntelliJ에서 JDK 17을 사용할 수 있도록 설정한 뒤 Gradle을 새로고침하세요.

Hibernate의 테이블 자동 생성·변경과 Spring SQL 자동 실행은 꺼져 있습니다. DB 구조는 `db/`의 SQL로 관리합니다. DB 접속 정보가 없거나 MySQL이 실행되지 않으면 서버 기동이 실패할 수 있습니다.

## 터미널 실행 (PowerShell)

`backend` 폴더에서 실행합니다.

```powershell
# 최초 설정 시에만 복사합니다. 기존 접속 설정 파일은 덮어쓰지 마세요.
if (-not (Test-Path application-local.properties)) {
    Copy-Item application-local.properties.example application-local.properties
}
# 복사한 파일에 실제 접속 정보를 입력한 뒤 실행
.\gradlew.bat bootRun
```

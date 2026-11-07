# ZIP backend

Spring Boot + Spring Web MVC + JPA + MySQL 프로젝트입니다. 상위 project-ZIP Git 저장소에서 함께 관리합니다.

## 로컬 DB 연결

1. MySQL을 실행하고 기존 [DB 안내](../db/README.md)에 따라 `zip` 데이터베이스와 테이블을 준비합니다. 새 DB에만 `db/schema.sql`을 적용하고, 기존 DB는 해당 안내의 마이그레이션 순서를 따릅니다.
2. 이 폴더의 `application-local.properties.example`을 `application-local.properties`로 복사합니다.
3. 복사한 파일에 `DB_USERNAME`, `DB_PASSWORD`를 입력합니다. 접속 주소가 다르면 `DB_URL`도 수정합니다. 실제 설정 파일은 Git에서 제외됩니다.
4. IntelliJ에서 `BackendApplication`을 실행합니다. 실행 작업 디렉터리는 `backend` 또는 프로젝트 최상위 폴더로 지정합니다. 기본 서버 포트는 8080입니다.

설정 파일 대신 IntelliJ 실행 구성의 환경변수에 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 지정해도 됩니다. 환경변수가 로컬 파일보다 우선합니다. `.env` 파일은 자동으로 읽지 않습니다.

프로젝트 Java Toolchain은 17입니다. IntelliJ에서 JDK 17을 사용할 수 있도록 설정한 뒤 Gradle을 새로고침하세요.

Hibernate의 테이블 자동 생성·변경과 Spring SQL 자동 실행은 꺼져 있습니다. DB 구조는 `db/`의 SQL로 관리합니다. DB 접속 정보가 없거나 MySQL이 실행되지 않으면 서버 기동이 실패할 수 있습니다.

## 터미널 실행 (PowerShell)

`backend` 폴더에서 실행합니다.

```powershell
Copy-Item application-local.properties.example application-local.properties
# 복사한 파일에 실제 접속 정보를 입력한 뒤 실행
.\gradlew.bat bootRun
```

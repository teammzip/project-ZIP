# ZIP backend

고정 지출 지역별 월 조회 GET `/api/bills/monthly`를 추가했습니다. 요청 month와 timeZone으로 현재 월/과거 월 범위를 계산하며 실제 모드의 고정 지출 조회 화면에 연결했습니다. 등록·납부 변경의 서버 화면 연결은 후속 단계입니다. 상세 검증은 루트 MONTHLY_BILLS_VERIFICATION.md를 참고하세요.

내 집 정보 GET/PUT `/api/me/home-info`가 구현되어 있습니다. 계약·설정·관리비·대출을 함께 저장하고 프론트 내 집 정보 폼에 연결했습니다. 기존 DB는 `db/migrations/20261115_home_contracts.sql`을 적용한 뒤 재시작하세요. 검증과 후속 범위는 프로젝트 루트 `HOME_INFO_VERIFICATION.md`를 참고하세요.

Spring Boot + Spring Web MVC + JPA + MySQL 프로젝트입니다. 상위 project-ZIP Git 저장소에서 함께 관리합니다.

로그인·JWT/DB 세션·내 정보 조회·닉네임/프로필 꾸미기·프로필 사진 업로드·비밀번호 변경·로그아웃·약관 조회가 구현돼 있습니다. 문자 인증 및 회원가입은 아직 연결 대기 상태입니다. 실행 설정, 테스트 계정 준비, 사진 저장 폴더와 지원 API는 [인증 기반 API 연결](IMPLEMENTATION.md)을 참고하세요. DB 설정 외에 `JWT_SECRET`도 필요합니다.

생활 설정 GET/PUT `/api/me/settings`도 구현돼 있습니다. [Postman 컬렉션](postman/life-settings.postman_collection.json)을 Import해 검증할 수 있습니다. 프론트 생활 설정의 서버 연결은 다음 단계입니다.

고정 지출 조회·추가·수정·월별 납부·해지도 구현돼 있습니다. [고정 지출 Postman 컬렉션](postman/fixed-bills.postman_collection.json)과 [월별 금액 정책](IMPLEMENTATION.md#고정-지출-api-확인)을 참고하세요. 프론트 고정 지출 화면과 설문·대출은 별도 연결 대상입니다.

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
# 월별 고정 지출 등록·수정 / 고지서 사진 (2026-11-18)

최신 수정: 사진 API는 POST `/api/ai/conversations/{id}/bill-photo`로 이동했습니다. AI 대화 답변과 가계부 등록을 함께 저장합니다. 가계부 화면에는 수동 기록·수정만 표시합니다. 메모 저장용 `20261118_02_bill_monthly_memo.sql`도 적용해야 합니다(현재 로컬 DB 적용 완료). 아래 초기 사진 API 경로는 사용하지 않습니다.

기존 DB에 `db/migrations/20261118_01_bill_monthly_registration.sql`을 한 번 적용한 후 서버를 재시작합니다. `bill_payments.due_date`와 `bill_photo_imports`가 필요합니다.
직접 등록/수정은 POST `/api/bills/monthly`, PATCH `/api/bills/monthly/{id}`이며 공통으로 month/timeZone을 받습니다. 수정은 존재하는 월 기록만 허용합니다.
사진 자동 등록은 POST `/api/bills/monthly/photo` multipart photo(JPG/PNG 2MB)입니다. 기존 서버 `GEMINI_API_KEY`/`GEMINI_MODEL` 설정을 사용합니다. 금액·납부 기한이 불명확하면 저장하지 않으며 동일 사진 중복 등록을 차단합니다.
테스트 → 실제 MySQL → 프론트 수동 확인과 Git 가이드는 루트 `MONTHLY_BILLS_WRITE_VERIFICATION.md`를 참고하세요.
실제 MySQL 재검증: `./gradlew.bat -I verify-monthly-mysql.init.gradle verifyMonthlyMysql` (backend에서 실행; 임시 데이터 롤백).

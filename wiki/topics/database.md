# 데이터베이스와 검증

2026-11-24 확인 · [초기 수집 기준](../raw/index.md) · [위키 색인](../index.md)

| 상황 | 확인할 자료 |
| --- | --- |
| 신규 DB 생성 | [schema.sql](../../db/schema.sql)을 적용한 뒤 자료용 마이그레이션 세 개(`20261122_01_regions_nationwide`·`20261122_02_trash_schedules_nationwide`·`20261122_04_region_neighbors_nationwide`)를 실행합니다. [신규 DB 절차](../../db/migrations/README.md) · 운영·QA용 새 DB는 앱 전용 DB 계정과 첫 관리자 계정까지 [운영 DB 새로 만들기](../../db/README.md#운영-db-새로-만들기-첫-배포--qa용-새-db) 순서를 따릅니다. 관리자 계정은 가입 화면으로 만들 수 없어 `hashPassword`로 만든 해시를 `role='ADMIN'`으로 직접 넣습니다. |
| 기존 DB 갱신 | [마이그레이션 안내](../../db/migrations/README.md)의 순서와 사전 조건에 따라 대상 DB의 이미 적용된 컬럼·키를 확인하고, 백업 후 미적용 파일을 실행합니다. MySQL DDL이 중간에 실패하면 적용된 범위를 먼저 확인합니다. |
| 백엔드 자동 테스트 | [백엔드 안내](../../backend/README.md)의 기본 Gradle 테스트는 MySQL 호환 모드의 H2를 사용합니다. |
| MySQL 검증 | 실제 MySQL의 스키마·데이터 검증 방법은 [DB 검증 안내](../../db/tests/README.md)를 참고합니다. 고정 지출 검증 작업은 [백엔드 안내](../../backend/README.md)에 있습니다. |

## 백엔드 데이터 접근 방식 검토

2026-11-25 · `c3ed411` 기준 정적 검토. 백엔드 런타임 소스에서 `JdbcTemplate`을 참조하는 Java 파일 37개를 확인했습니다. Gradle에 Spring Data JPA 스타터가 있고 `ddl-auto`는 `none`으로 설정돼 있습니다. 백엔드 소스에서 JPA 엔티티나 `JpaRepository` 구현, MyBatis·QueryDSL 사용은 확인되지 않았습니다. [백엔드 빌드](../../backend/build.gradle) · [서버 설정](../../backend/src/main/resources/application.properties) · [스키마](../../db/schema.sql)

**검토 의견은 `JdbcTemplate` 유지입니다.** 로그인은 `FOR UPDATE`와 로그인 실패 예외의 롤백 제외 설정으로 실패 횟수를 보존합니다. 2026-11-26 확인: 로그인 조회는 회원 행과 함께 `LEFT JOIN`한 동네(`regions`) 행도 잠그고, 이 트랜잭션 안에서 비밀번호를 대조하므로 같은 구 회원의 로그인이 잠시 서로 기다릴 수 있습니다(미수정, MySQL은 `FOR UPDATE OF u`로 회원 행만 잠글 수 있지만 H2 테스트와의 호환을 확인해야 함). 회원 응답의 동네 전체 이름(`fullName`)은 이 잠금을 넓히지 않도록 잠그지 않는 별도 조회로 가져옵니다. 월별 납부 처리는 회원 잠금, 세션 확인, `COALESCE`를 통한 최초 납부 시각 보존을 한 트랜잭션에서 처리합니다. 지도 즐겨찾기는 `INSERT IGNORE`를 사용합니다. 가계부 월별 목록은 이미 조인으로 분류·연결 메모를 함께 조회합니다. 이 경로들을 일괄 전환하면 기존 잠금·롤백·중복 처리·조회 계약을 다시 확인해야 합니다. [인증 저장소](../../backend/src/main/java/com/zip/backend/auth/AuthRepository.java) · [로그인 서비스](../../backend/src/main/java/com/zip/backend/auth/AuthService.java) · [납부 처리](../../backend/src/main/java/com/zip/backend/bills/BillSettlementService.java) · [지도 저장소](../../backend/src/main/java/com/zip/backend/map/MapRepository.java) · [가계부 목록](../../backend/src/main/java/com/zip/backend/ledger/LedgerService.java)

- SQL 파라미터와 행 매핑의 반복이 주된 문제라면 기존 JDBC에서 이름 있는 파라미터와 타입이 있는 조회 결과를 적용할 수 있습니다. [Spring JDBC](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)
- 신규 기능에서 단순 저장·수정이 반복되면 Spring Data JPA를 소규모로 검토합니다. 기존 기능으로 학습용 비교가 필요하면 공지 목록·상세 조회가 후보입니다. 고정·최신순 정렬, 작성자 `LEFT JOIN`, 행 제한을 대조할 수 있습니다. 공지 생성의 다수 회원 알림은 `INSERT … SELECT`를 사용하므로 실험 범위는 조회로 잡습니다. [공지 저장소](../../backend/src/main/java/com/zip/backend/notice/NoticeRepository.java) · [공지 통합 테스트](../../backend/src/test/java/com/zip/backend/notice/NoticeIntegrationTests.java)
- SQL을 그대로 제어하면서 동적 필터와 결과 매핑을 여러 조회에서 반복하게 되면 MyBatis가 후보입니다. 커뮤니티 글 목록은 현재 동네·카테고리·제목과 본문 검색 조건을 조합하므로 조건이 늘어날 때 비교할 수 있습니다. QueryDSL JPA는 엔티티 기반 검색의 조건 조합이 많아질 때 검토합니다. 도입 검토에는 Spring Data JPA의 `Specification`과의 비교, Gradle의 Jakarta Q 타입 생성 설정 확인을 포함합니다. [커뮤니티 저장소](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [MyBatis 동적 SQL](https://mybatis.org/mybatis-3/dynamic-sql.html) · [JPA Specification](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html) · [Spring Data의 QueryDSL 연동](https://docs.spring.io/spring-data/jpa/reference/repositories/core-extensions.html)

도입 여부를 정할 때는 같은 입력과 데이터로 API 결과, SQL 실행 횟수·실행 계획·응답 시간을 비교합니다. 쓰기 경로까지 전환한다면 대상 MySQL에서 회원별 접근 범위, 동시 요청, 롤백 및 중복 처리를 확인합니다. 정적 검토에서 실제 MySQL의 전환 전후 성능이나 회귀 테스트는 실행하지 않았습니다. [프로젝트 검증 현황](project-status.md#검증해야-될-부분) · [백엔드 검증 방법](../../backend/README.md)

### 데이터 접근 방식 병행

`c3ed411`에서 검토한 적용안은 기능별로 저장 경로를 정하고, 기존 JDBC 쿼리와 별도로 단순 CRUD가 반복되는 기능에 Spring Data JPA를 사용하는 것입니다. 기존 코드에서 첫 실험은 공지 목록·팝업 조회로 시작할 수 있습니다. 상세 조회 `get`은 현재 생성·수정 트랜잭션의 응답을 만드는 데도 호출되므로, 이를 JPA로 옮기는 시점에는 JDBC 쓰기 직후 조회까지 검증합니다. [공지 서비스](../../backend/src/main/java/com/zip/backend/notice/NoticeService.java) · [공지 통합 테스트](../../backend/src/test/java/com/zip/backend/notice/NoticeIntegrationTests.java)

하나의 쓰기 작업에서 JPA와 JDBC를 호출할 경우 같은 `DataSource`와 `JpaTransactionManager` 아래 서비스의 `@Transactional`에서 실행합니다. Hibernate가 JDBC 커넥션을 노출하는 이 구성에서는 두 호출을 함께 롤백할 수 있습니다. JDBC가 JPA의 변경된 행을 즉시 사용해야 하면 JDBC 호출 전에 `flush()`로 SQL을 실행합니다. JDBC가 이미 로드된 엔티티의 행을 수정해야 하면 JPA에서 변경을 다시 읽는 시점을 관리합니다. 같은 행의 쓰기 경로를 하나로 두면 이 순서 관리가 줄어듭니다. 공지 저장을 JPA로 옮길 경우 알림용 `INSERT … SELECT`는 JDBC로 두고, 알림 삽입 실패 시 공지와 알림이 함께 롤백되는지 대상 MySQL에서 확인할 수 있습니다. [Spring의 JPA 트랜잭션](https://docs.spring.io/spring-framework/reference/data-access/orm/jpa.html#orm-jpa-tx) · [Hibernate flush](https://docs.hibernate.org/orm/7.0/introduction/html_single/Hibernate_Introduction.html#session-flush) · [공지 알림 삽입](../../backend/src/main/java/com/zip/backend/notice/NoticeRepository.java)

기존 JDBC와 MyBatis를 병행하려면 동적 SQL·매핑의 반복이 큰 조회 영역을 골라 매퍼로 옮깁니다. 이후 단순 CRUD를 JPA로 쓰는 팀이라면 해당 SQL 영역과 JPA를 병행할 수 있습니다. QueryDSL JPA는 JPA 엔티티 기반의 복합 검색이 반복될 때 같은 JPA 계층의 조회 방식으로 추가합니다. JPA 없이 테이블 기준의 타입 안전한 SQL 조합이 필요하면 QueryDSL SQL도 후보이며, MyBatis와 역할이 겹치는 조회는 한 방식으로 작성합니다. 이 조합들은 검토 의견이며 실제 트랜잭션을 실행해 확인하지 않았습니다. [MyBatis의 Spring 트랜잭션 연동](https://mybatis.org/spring/transactions.html) · [Spring Data의 QueryDSL 연동](https://docs.spring.io/spring-data/jpa/reference/repositories/core-extensions.html) · [QueryDSL 지원 모듈](https://openfeign.github.io/querydsl/)

### 성능 비교 기준

같은 SQL과 파라미터가 동일한 실행 계획으로 처리되면 MySQL 내부 작업량은 비슷할 것으로 예상합니다. 요청 전체에서는 SQL 실행 횟수, 읽어 오는 행과 컬럼, 애플리케이션의 결과 매핑과 JPA 엔티티 관리 비용을 비교합니다. JPA 전환에서는 연관 행별 추가 조회와 페이지 전체 건수를 세는 쿼리를 확인합니다. MyBatis에서 중첩 조회를 사용해도 행별 SQL이 생길 수 있습니다. [Hibernate 연관관계 조회](https://docs.hibernate.org/stable/orm/introduction/html_single/#association-fetching) · [Spring Data 페이지 조회](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html) · [MyBatis 결과 매핑](https://mybatis.org/mybatis-3/sqlmap-xml.html)

- 가계부 수입은 월별 목록 SQL과 월급 동기화의 비용을 함께 측정합니다. 동기화는 회원 행을 잠그고, 월급이 설정돼 있으면 설정 시작월부터 납부일이 지난 달마다 등록 여부를 조회합니다. [가계부 기록과 회원별 분류](ledger-memos.md#가계부-기록과-회원별-분류) · [월급 동기화](../../backend/src/main/java/com/zip/backend/ledger/SalaryService.java)
- 공지 목록은 JSON에서 본문을 생략하며, 현재 공통 SQL은 `n.body`를 읽습니다. 목록에서 본문 컬럼을 제외하는 비교는 JDBC에서도 가능합니다. 다수 회원에게 공지 알림을 보내는 경로는 현재 한 번의 `INSERT … SELECT`를 실행합니다. 커뮤니티는 페이지 크기보다 한 행을 더 조회해 다음 페이지 유무를 확인하므로 전체 건수 조회가 추가되는지 비교합니다. [공지 저장소](../../backend/src/main/java/com/zip/backend/notice/NoticeRepository.java) · [공지 응답](../../backend/src/main/java/com/zip/backend/notice/NoticeService.java) · [커뮤니티 목록](../../backend/src/main/java/com/zip/backend/community/CommunityService.java)
- 같은 MySQL 버전·데이터·동시 요청 조건에서 API 응답 중앙값과 p95, 요청당 SQL 횟수, 주요 조회의 `EXPLAIN ANALYZE` 결과를 비교합니다. `c3ed411`의 경로를 정적으로 확인했으며 전환 전후 응답 시간과 실행 계획은 측정하지 않았습니다. [MySQL 실행 계획 안내](https://dev.mysql.com/doc/refman/8.4/en/explain.html)

### 도입을 판단하는 기준

실제로 예정된 필드 추가나 검색 조건 변경 하나를 기준으로, 현재 방식과 후보 방식에서 수정할 SQL·매핑·호출 지점을 비교합니다. 함께 바뀌어야 하는 중복, 파라미터 순서나 컬럼 이름의 실수 가능성, 새로 관리할 설정과 테스트를 확인합니다.

- **Spring Data JPA**는 단순한 저장·수정·삭제 기능이 여러 곳에서 반복되고, 필드를 추가할 때 같은 컬럼을 등록·수정 SQL, 파라미터, `RowMapper`에 각각 반영해야 할 때 검토합니다. 공지의 생성 키 처리와 갱신은 이 비용을 비교할 표본입니다. 공지 알림 일괄 삽입과 메모 폴더의 회원 잠금·최대 개수·중복 이름 처리처럼 기존 기능의 동작 조건은 별도로 대조합니다. [공지 저장소](../../backend/src/main/java/com/zip/backend/notice/NoticeRepository.java) · [메모 폴더 서비스](../../backend/src/main/java/com/zip/backend/memo/MemoService.java) · [Spring Data JPA 저장](https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html)
- **MyBatis**는 정확한 SQL을 직접 관리하는 조회에서 여러 쿼리가 같은 조인·조건과 결과 매핑을 반복할 때 검토합니다. 공통 SQL 조각과 결과 매핑 선언으로 함께 바뀌어야 할 곳을 줄일 수 있는지 봅니다. 파라미터 순서나 행 매핑의 반복만 문제라면 이름 있는 파라미터와 공통 `RowMapper`로 줄일 수 있는지도 비교합니다. 커뮤니티 회원·관리자 목록은 각각 `searchPosts`와 `adminPosts`에서 검색어를 준비한 뒤 공통 `posts` 쿼리를 사용합니다. 회원 검색에만 적용하는 공백 비교와 정렬은 [검색 규칙](community-operations.md#검색-정렬과-관련도)에 있습니다. 대표 게시글 조회도 `POST_SQL`과 행 매핑을 재사용합니다. [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [커뮤니티 저장소](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [Spring JDBC](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html) · [MyBatis 결과 매핑](https://mybatis.org/mybatis-3/sqlmap-xml.html)
- **QueryDSL JPA**는 JPA 엔티티를 기반으로 여러 검색에 적용되는 필터·정렬 조건을 조합하며, 엔티티 속성 이름과 타입을 빌드에서 확인할 필요가 있을 때 검토합니다. 필터 개수와 함께 검색마다 조인과 반환 필드가 달라지는지, 조건을 재사용할 곳이 있는지 봅니다. 조건 재사용이 중심이면 JPA `Specification`도 비교합니다. 현재 커뮤니티 동네·카테고리·키워드는 한 메서드에서 조합합니다. [커뮤니티 검색](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [JPA Specification](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html) · [Spring Data의 QueryDSL 연동](https://docs.spring.io/spring-data/jpa/reference/repositories/core-extensions.html)

한 기능을 비교하는 경우 다음 변경의 수정 지점이 줄어드는지 확인하고, 회원별 접근 범위와 API 결과·정렬을 대조합니다. 검토 기준은 `c3ed411`이며 후보 구현을 만들어 비교하지 않았습니다.

### project-ZIP 현재 도입 의견

`c3ed411` 기준 운영 코드의 기본 방식은 `JdbcTemplate` 유지 의견입니다. **JPA는 신규 단순 CRUD 한 기능의 시험 후보**, **MyBatis와 QueryDSL은 도입 보류**로 봅니다. 아래 판단은 코드 확인에 근거하며 전환 비용이나 운영 성능을 측정한 결과는 없습니다.

- **JPA**의 구체적인 이점은 생성 키 처리와 필드 바인딩을 줄이는 것입니다. 현재 `GeneratedKeyHolder`를 직접 생성하는 Java 파일은 13개이며, 공지와 문의 저장에서도 이 패턴이 보입니다. 반면 로그인 실패 횟수 보존과 월별 납부의 잠금·반복 요청 동작은 전환 시 별도 검증이 필요합니다. 신규 단순 CRUD에서 이점을 확인하는 범위가 적합합니다. [공지 저장소](../../backend/src/main/java/com/zip/backend/notice/NoticeRepository.java) · [문의 저장소](../../backend/src/main/java/com/zip/backend/support/SupportRepository.java) · [로그인 트랜잭션](../../backend/src/main/java/com/zip/backend/auth/AuthService.java) · [월별 납부](../../backend/src/main/java/com/zip/backend/bills/BillSettlementService.java)
- **MyBatis**의 비교 후보는 제재 집계와 검색·정렬을 합치는 관리자 회원 조회입니다. 현재 회원 목록·상세가 `MEMBER_SQL`과 행 매핑을 공유하며, 일반·관리자 게시글 목록도 같은 메서드를 사용합니다. 관리자 회원 조회의 같은 시각 파라미터를 여러 번 바인딩하는 부분은 이름 있는 JDBC 파라미터로 먼저 비교할 수 있습니다. [관리자 회원 조회](../../backend/src/main/java/com/zip/backend/moderation/ModerationRepository.java) · [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java)
- **QueryDSL JPA**를 적용하려면 엔티티 매핑부터 추가해야 합니다. 확인한 게시글·지도·일정 조회는 각각 다른 결과와 필터를 사용하며, 같은 엔티티의 검색 조건을 여러 조회에서 반복 조합해야 할 필요는 현재 코드에서 뚜렷하게 확인되지 않았습니다. [게시글 검색](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java) · [지도 검색](../../backend/src/main/java/com/zip/backend/map/MapRepository.java) · [일정 조회](../../backend/src/main/java/com/zip/backend/calendar/CalendarRepository.java)

### 신규 기능에 적용할 계획

2026-11-25 사용자 요청. 다음에 DB에 저장하거나 조회하는 신규 기능을 구현할 때, 그 기능의 저장소 한 곳에 Spring Data JPA를 적용해 봅니다. 신규 기능에서 필요한 API 동작과 회원별 접근 범위, 쓰기 트랜잭션, 실제 SQL 실행 횟수를 확인해 적용 결과를 기록합니다. [도입 판단 기준](#도입을-판단하는-기준) · [성능 비교 기준](#성능-비교-기준)

추후 MyBatis와 QueryDSL을 모두 사용할 필요가 생기면, MyBatis는 직접 관리할 조인·집계 SQL에, QueryDSL은 타입이 있는 동적 검색에 배치하는 안을 실제 기능에 맞춰 비교합니다. JPA 엔티티를 쓰는 검색은 QueryDSL JPA를, 테이블 기준 검색은 QueryDSL SQL을 후보로 봅니다. 한 서비스 작업에서 두 방식을 함께 호출하는 경우 같은 `DataSource`와 Spring 트랜잭션에서 필요한 조회 일관성과 롤백 동작을 검증합니다. [데이터 접근 방식 병행](#데이터-접근-방식-병행)

## 전국 데이터

전국 배출표와 이웃 지역 데이터는 별도 데이터 마이그레이션으로 들어갑니다. 로컬 DB에 어떤 데이터가 있는지는 적용 이력으로 확인합니다. [DB 안내](../../db/README.md) · [배출표 조회](trash-schedules.md) · [앱 실행 모드](application.md)

[배출표 마이그레이션](../../db/migrations/20261122_02_trash_schedules_nationwide.sql)과 [이웃 지역 마이그레이션](../../db/migrations/20261122_04_region_neighbors_nationwide.sql)은 각각 기존 배출표·이웃 목록을 교체합니다. 문서 기준 자료는 지역 249건, 배출표 6,218건, 방향별 이웃 관계 1,286건입니다. 개별 배포 환경의 적용 여부는 별도 확인이 필요합니다. 동네 목록의 기준은 프론트 [regions.ts](../../frontend/src/features/auth/data/regions.ts) 하나이고, [이웃 변환 스크립트](../../db/tools/region_neighbors_import.py)가 이웃 마이그레이션과 프론트 이웃 목록을 같은 데이터로 만듭니다. 셋이 어긋나면 [동기화 테스트](../../frontend/tests/region-data-sync.test.mjs)가 실패합니다(2026-11-24). [전국 자료 적용 결과](../../db/README.md#전국-지역--쓰레기-배출표--주변-동네) · [변경 기록](../../CHANGELOG.md#db)

## 마이그레이션 정합성 점검

로그인 잠금 마이그레이션 `20261121_04_login_lockout.sql`을 검사 목록에 추가하고, 신규 스키마와 업그레이드 결과를 비교하는 자료를 재생성했습니다. SQL 파일명 전체로 적용 순서를 확인합니다. 같은 날짜·번호가 붙은 게시글 인덱스 파일도 검사 목록에 있습니다. 메모 폴더의 적용 파일은 `20261122_07_memo_folders.sql`입니다. 약관 본문만 바꾸는 `20261127_01_terms_privacy_transfers.sql`도 같은 순서 목록과 업그레이드 묶음 끝에 있습니다. 표 구조는 바꾸지 않습니다. 2026-11-27에 격리 MySQL 8.0에서 새 `schema.sql` DB와, 이전 `schema.sql`에 이 파일을 적용한 DB의 약관 3종 본문이 같은 것을 확인했습니다. [약관 동기화 도구](../../db/tools/terms-sync.cjs) [정합성 수정 커밋](https://github.com/teammzip/project-ZIP/commit/4f0db63) · [적용 순서](../../db/tests/migration-path.cjs) · [스키마 비교 자료](../../db/tests/schema_expected.json) · [검사 및 재생성 절차](../../db/tests/README.md)

## 기념일 마이그레이션

11월 24일 변경으로 기존 DB의 기념일 컬럼 정리가 `20261031_02_event_anniversaries.sql`에 통합됐습니다. 구형 `20261101_event_anniversary.sql`은 폐기됐습니다. 최신 `schema.sql`로 만든 신규 DB에는 정식 컬럼이 이미 있습니다. [변경 기록](../../CHANGELOG.md#db) · [마이그레이션 안내](../../db/migrations/README.md#구형-기념일-컬럼-정리)

통합 SQL은 구형 컬럼(`is_anniv`, `is_yearly`)만 있으면 값을 보존하며 `is_anniversary`, `repeat_yearly`로 이름을 바꿉니다. 두 쌍이 모두 있으면 모든 행의 값이 일치할 때만 구형 컬럼을 제거합니다. 값이 다르거나 컬럼 쌍이 불완전하면 사전 검사에서 중단됩니다. 신규 설치·구형 DB 전환·재실행 검증 결과는 변경 기록에 남아 있습니다. [통합 SQL](../../db/migrations/20261031_02_event_anniversaries.sql) · [격리 검증 코드](../../db/tests/run-isolated-mysql.cjs)

## DB 검증 결과

2026-11-24에 개발용 실제 DB를 새 `schema.sql` DB와 `information_schema`로 비교해 남은 차이 두 개를 맞췄습니다. `bill_photo_drafts`의 대화 외래 키 인덱스 이름을 `bill_photo_drafts_ibfk_2`로 바꾸고, `loan_interest_charges.paid_at` 설명을 `schema.sql` 문구로 통일했습니다. 앞으로 업그레이드하는 DB도 같은 설명이 되도록 [이자 납부 시각 마이그레이션](../../db/migrations/20261118_07_contract_payment_changes.sql)의 문구도 맞췄습니다. 마이그레이션으로 추가된 칸은 표 끝에 붙어 칸 순서만 다를 수 있습니다. [마이그레이션 안내](../../db/migrations/README.md)의 끝에 붙어 있던 옛 안내문 중복도 정리했습니다.

`250b8d9`에서 DB 정적 검사 7개와 격리 MySQL 9.6의 72단계·265개 검사를 통과했습니다. 신규 설치, 전체·증분 업그레이드, 기존 데이터와 구조 비교를 확인했습니다. 기념일은 구형 값 보존, 잘못된 값·상충 값 차단, 값이 일치할 때 구형 컬럼 제거와 재실행을 확인했습니다. 팀 배포 DB의 데이터와 적용 상태는 [검증해야 될 부분](project-status.md#검증해야-될-부분)에 기록했습니다. [검증 근거](../raw/index.md#2026-11-24--작업과-검증-이력-보완)

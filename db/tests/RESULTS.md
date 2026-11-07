## 사용자 최신 zip_test 적용 보고 (2026-11-07 대화 기준)

사용자가 20261107 마이그레이션 오류 없음, M01~M07 모두 PASS, 추가 객체·컬럼 없음, X01~X05 모두 PASS, Y01 3819/ck_settings_ledger_object, Y99 PASS로 보고했습니다. 사용자 보고를 대조한 결과이며 에이전트가 이 사용자 DB에 직접 접속해 재실행한 결과는 아닙니다. 현재 기준은 44/358/71/62/15/2입니다.

# 2026-11-07 최신 설계 재검증

HEAD `1a41a75` 변경을 반영한 DB 파일을 별도 MySQL 9.6.0 서버에서 검증했습니다. 정상 111건, 의도한 제약 오류 95건과 정리 절차 모두 통과했습니다. X01~X05는 주소 분리·개인 분류/순서·월별 납부 해제 독립성·24자 분류/색·탈퇴 CASCADE를 검증했고, Y01은 설정 배열 거부(3819)를 확인했습니다. 신규 생성·35테이블부터 전체 이전·이전 44테이블부터 증분 이전 후 M01~M07 모두 통과했습니다. 정적 검사 5개도 통과했습니다. 자세한 실행 결과는 [VALIDATION_20261107.json](VALIDATION_20261107.json)에 있습니다.

사용자의 기존 zip_test 적용·백엔드 API 검증은 이번 실행에 포함하지 않았습니다. 직접 적용 순서는 [LIFE_CATEGORIES.md](../LIFE_CATEGORIES.md)를 참고하세요. 아래는 이전 검증 이력입니다.

# DB 검증 기록 — 사용자 실행·격리 자동 실행

사용자가 Workbench에서 실행해 전달한 결과를 기록합니다. 담당 에이전트가 실제 DB에 접속해 독립 실행한 결과와 구분합니다. 전체 구조 대조에 사용한 MySQL 버전은 **9.6.0**으로 보고됐으며 과거 개별 실행의 버전은 미확인입니다. 전체 44개 테이블의 모든 동작 검증 완료를 의미하지 않습니다.

| 단계 | 결과 | 근거 |
|---|---|---|
| 주거·대출 P01~P10 | 통과(사용자 보고) | 모두 PASS 전달 |
| 주거·대출 N01~N08 | 오류 발생 보고, 정확한 키 확인 미완료 | 각 예상 오류 번호·키 전체 미제공 |
| 주거·대출 N99 | 통과(사용자 보고) | PASS 전달 |
| 회원·인증 A01~A13 | 완료 보고 | 개별 결과표 미제공 |
| 회원·인증 B03·B05~B10 | 통과(전달 메시지 대조) | 1062 중복/1451 삭제 제한과 키 일치 |
| 회원·인증 B01·B02·B04·B99 | 완료 보고 | 개별 오류·결과표 미제공 |
| 생활 C01~C17 | 통과(사용자 보고) | 모두 PASS 전달 |
| 생활 D01~D09 | 통과(전달 메시지 대조) | 아래 오류 번호·키 일치 |
| 생활 D99 | 통과(사용자 보고) | PASS 전달 |
| 가계부 E01~E14 | 통과(사용자 보고) | 타입 수정 후 모두 PASS 전달 |
| 가계부 F01~F09 | 통과(전달 메시지 대조) | 아래 오류 번호·키 일치 |
| 가계부 F99 | 통과(사용자 보고) | PASS 전달 |
| 커뮤니티 G01~G13 | 통과(사용자 보고) | 모두 PASS 전달 |
| 커뮤니티 H01~H09 | 통과(전달 메시지 대조) | 1062 중복·1452 참조·1451 삭제 제한·1048 저장 주소 NULL 모두 예상과 일치 |
| 커뮤니티 H99 | 통과(사용자 보고) | PASS 전달 |
| 신고·제재·고객센터 I01~I14 | 통과(사용자 보고) | 모두 PASS 전달 |
| 신고·제재·고객센터 J01~J07 | 통과(전달 메시지 대조) | 1062 차단 키 중복, 1452 각 외래키, 1048 content NULL 모두 예상과 일치 |
| 신고·제재·고객센터 J99 | 통과(사용자 보고) | PASS 전달 |
| 동네·지도·AI K01~K16 | 통과(사용자 보고) | 모두 PASS 전달 |
| 동네·지도·AI L01~L13 | 통과(전달 메시지 대조) | 아래 오류 번호·키 일치 |
| 동네·지도·AI L99 | 통과(사용자 보고) | PASS 전달 |
| 전체 구조 M01·M03~M07 | 통과(사용자 결과 대조) | 44개 표·70개 PK/UNIQUE·62개 FK·7개 CHECK·2개 VIEW·InnoDB 모두 예상 개수와 일치 |
| 전체 구조 M02 | 통과(수정 후 사용자 결과 대조) | 348개 컬럼 모두 PASS, failed_count=0 |
| 보완 제약 S01~S12 | 통과(전달 메시지 대조) | 1062 중복·3819 CHECK·3105 생성컬럼 모두 예상 번호/키와 일치 |
| 보완 제약 S99 | 통과(사용자 보고) | PASS 전달 |
| 마이그레이션 U00~U13 | 통과(사용자 보고) | 모두 PASS, restored_safe_update_mode=0 보고 |
| 마이그레이션 DB 구조 M01~M07 | 통과(사용자 결과 대조) | 44개 표·348개 컬럼·70개 키·62개 FK·7개 CHECK·2개 VIEW·InnoDB 모두 PASS |
| 마이그레이션 DB 추가 객체·컬럼 | 예상과 일치 | todos_legacy_20261031 하나, 추가 컬럼 없음 |
| 추가 객체·컬럼 | 없음(사용자 보고) | 두 목록 모두 빈 결과 |

M02는 처음에 bill_items.default_amount, bill_payments.amount, expenses.amount, rent_payments.amount, user_settings.rent_amount 5개 불일치가 있었으며, 이후 재검사에서 모두 통과했습니다. M01·M03~M07은 앞선 실행의 PASS이고 M02는 후속 실행 결과입니다. 전체 최신 구조의 주요 비교 항목을 통과한 것으로 기록하되, DEFAULT·수식 등 감사 범위 밖 속성과 모든 경계 동작까지 검증된 것은 아닙니다.

## 전체 범위 재확인 (2026-11-02)

### 최신 요구사항 보완 후 상태

위쪽 기존 PASS 표는 변경 전 348개 컬럼·70개 키·CHECK 7개 버전의 실행 이력입니다. 이후 7bb1c90 요구사항을 반영해 schema.sql은 **44개 표·356개 컬럼·71개 기본키/UNIQUE·62개 FK·CHECK 14개·VIEW 2개**가 됐습니다. 최신 버전의 실행 결과는 다음과 같이 별도 기록합니다.

| 최신 단계 | 상태 |
|---|---|
| SQL 자산 정적 검사 5개 | 통과 — FK 호환성, 전체 마이그레이션과 신규 설계의 컬럼/키/제약 일치, 감사 스냅샷, 이전 fixture 동기화, 새 테스트 정의 |
| Q01 사전 조회·최신 변경 DDL | 격리 MySQL 9.6.0 및 사용자 zip_test에서 통과 — Q01 전부 0, Q02 오류 없음 보고 |
| V01~V09 정상·W01~W17 예외·W99 | 격리 환경 및 사용자 zip_test에서 통과 — W 오류 번호·제약조건 전체 대조 |
| 최신 M01~M07 | 격리 새 DB·전체 이전 DB·증분 적용 DB 및 사용자 zip_test 모두 통과 |
| 최신 전체 35→44 이전 재검증·회귀 | 격리 MySQL 9.6.0에서 통과 |
| API01~API15 | 백엔드 미구현으로 미실행 |

신고 중복 UNIQUE/스냅샷과 위치 출처·설문 좌표의 저장 칸을 보완했습니다. 이 작업으로 해당 API까지 구현되거나 과거 PASS가 새 버전 PASS로 자동 전환되는 것은 아닙니다. 상세 계약과 예외 시나리오는 db/LATEST_REQUIREMENTS.md를 따릅니다.

### 사용자 zip_test 최신 적용 확인

사용자가 직접 실행해 전달한 결과를 대조했습니다. Q01 위반 0, Q02 오류 없음, V01~V09 및 W99 PASS입니다. W01~W02는 1062/uk_reports_reporter_target, W03~W04는 3819/ck_survey_address_point, W05~W08은 3819/ck_settings_region_location, W09~W12는 3819/ck_settings_json_arrays, W13~W14는 3819/ck_users_home_point, W15는 3819/ck_places_point, W16은 3819/ck_place_review_rating, W17은 3819/ck_trash_weekday로 모두 일치합니다. W02의 기각 UPDATE 1행 성공 후 재신고 1062도 의도대로입니다.

M01~M07의 checked_count는 44/356/71/62/14/2/44, failed_count는 모두 0이며 추가 객체·컬럼도 없었습니다. 따라서 사용자 zip_test의 최신 적용·선택한 정상/예외·주요 구조 대조를 완료로 기록합니다. 최신 DDL 아래 이전 전체 회귀/마이그레이션 재검증은 격리 자동 실행의 결과이며, 사용자의 기존 zip_migration_test까지 추가 변경했다는 뜻은 아닙니다.

### 에이전트 독립 실행 결과

설치된 MySQL 9.6.0 바이너리로 새 임시 데이터 디렉터리와 고유 named pipe를 사용했습니다. TCP를 비활성화했고 기존 사용자 서버/zip/zip_test에는 연결하지 않았습니다. 완료 후 임시 서버를 종료했습니다. 초기 연결 권한 문제 및 검사 코드의 CRLF 비교 문제를 해결한 뒤 최종 실행은 exit code 0으로 완료했습니다.

- 정상 SQL 검증 106개: 기존 01/03/05/07/09/11/13번과 신규 22번 모두 PASS.
- 예상 거부 SQL 94개: 기존 02/04/06/08/10/12/14/17번과 신규 23번 모두 오류 번호·키 이름 일치, 각 정리 PASS.
- 전체 이전 U00~U13: PASS. 최신 마이그레이션 4개 경로와 원본 데이터 보존 확인.
- 새 DB·전체 이전 DB·증분 적용 DB 구조 감사: 각각 M01~M07 PASS.
- 사전 조회 8개 규칙 위반 없음 확인. 이전 44개 표에서 최신 변경 증분 적용 PASS.
- 중복 신고 fixture: 사전 중복 그룹 1개, UNIQUE 생성 1062로 거부, 기존 신고 2개 보존, 실패한 ALTER의 새 컬럼도 남지 않음 확인.

기계 판독용 결과는 VALIDATION_20261102.json, 재현 명령은 `node db/tests/run-isolated-mysql.cjs`입니다. Windows named pipe 권한이 필요할 수 있습니다. 실행기는 별도 임시 서버만 만들며 완료 후 종료하고 진단 로그는 Git 제외 경로 db/private에 남깁니다. 운영 서버 설정·계정은 변경하지 않습니다.

### 범위와 남은 항목

- 현재 db/schema.sql은 44개 테이블·2개 VIEW입니다. 44개 표 모두 대표 데이터 테스트 대상에 포함되며, 최신 CHECK 14개 모두 이름을 명시한 거부 테스트를 실제 격리 실행했습니다. 테이블별 모든 입력/동작을 검증했다는 뜻은 아닙니다.
- 사용자 제공 결과 기준 주요 저장·수정·조회·삭제, 선택된 제약조건, 이전 35개 테이블의 가상 데이터 마이그레이션과 최종 구조 대조는 완료했습니다. 초기 일부 테스트는 완료 보고만 있고 개별 오류/결과표가 미제공된 상태를 유지합니다.
- restored_safe_update_mode=0 자체는 실패가 아닙니다. 이 값은 스크립트 시작 당시 세션 설정으로 복구되며 시작값이 0이었다면 정상입니다. 현재 값만으로 시작값까지 독립 확인하지는 못했습니다.
- 보완 전 발견한 중복 신고 격차는 reports UNIQUE와 정상/예외 테스트로 해결했습니다. API의 409 응답 변환·권한·대상 검사는 여전히 백엔드 구현 대상입니다.
- 보완 전 발견한 addressPoint/regionLocation 격차는 저장 칸·매핑 문서·좌표/출처/보존 테스트로 해결했습니다. 실제 인증 진위와 주소 정규화·동시 변경은 API 인수 대상입니다.
- DEFAULT/ON UPDATE·일반 인덱스·수식 전체 비교, 모든 FK 동작 조합·NULL/ENUM/길이 경계, 운영 규모 성능·백업 실제 복구, API 인증·권한·동시성은 미완료입니다. 최신 프로젝트 전체 요구사항 검증 완료 또는 운영 준비 완료로 표현하지 않습니다.

생활 오류 검증에서 확인한 결과:

- D01: 1062 / uk_event_categories_user_name
- D02: 1062 / uk_event_categories_user_system
- D03: 1062 / uk_event_presets_category_title
- D04: 1452 / fk_events_category_id
- D05~D06: 3819 / ck_events_anniversary_flags
- D07: 3819 / ck_memos_items_array
- D08: 3140 / memos.items의 Invalid JSON text
- D09: 1048 / body cannot be null

가계부 오류 검증에서 확인한 결과:

- F01: 1062 / uk_ledger_categories_kind_name
- F02: 1452 / fk_incomes_category_id
- F03: 1452 / fk_expenses_category_id
- F04: 1062 / uk_bill_payments_bill_item_id_period_ym
- F05: 1062 / uk_rent_payments_user_id_period_ym
- F06: 1451 / fk_incomes_category_id
- F07: 1451 / fk_expenses_category_id
- F08: 1452 / fk_bill_payments_bill_item_id
- F09: 1048 / amount cannot be null

동네·지도·AI 오류 검증에서 확인한 결과:

- L01: 1062 / uk_regions_parent_id_name
- L02: 1062 / region_neighbors.PRIMARY
- L03: 1062 / uk_trash_schedules_region_weekday_type
- L04: 1062 / uk_place_categories_name
- L05: 1062 / place_favorites.PRIMARY
- L06: 1062 / uk_place_reviews_place_id_user_id
- L07: 1062 / ai_usage_daily.PRIMARY
- L08: 1062 / uk_ai_topics_code
- L09: 1451 / fk_places_category_id
- L10: 1451 / fk_regions_parent_id
- L11: 1452 / fk_ai_messages_conversation_id
- L12: 3140 / ai_messages.card_data의 Invalid JSON text
- L13: 1451 / fk_places_region_id

대표 기능·구조·선택한 예외·전체/증분 이전 검증을 완료했으며, 남은 전체 경계 조합·운영 복구·성능 및 API 정책/권한/동시성은 별도 검증합니다.

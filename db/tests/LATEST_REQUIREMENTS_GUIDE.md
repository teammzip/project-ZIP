> 이 문서의 Q/V/W는 **20261102 단계**입니다. 최신 단계는 [20261107 생활 기능 가이드](../LIFE_CATEGORIES.md)의 추가 DDL·X/Y 테스트입니다. 이미 적용한 DDL은 재실행하지 않습니다. 초기 구조 수치는 당시 이력입니다.

# 최신 요구사항·예외 테스트 실행 순서

대상은 2026-11-02, HEAD 7bb1c90입니다. 표 44개, 컬럼 356개, 기본키/UNIQUE 71개, FK 62개, CHECK 14개, VIEW 2개입니다. 이전 348개 컬럼·70개 키·CHECK 7개의 PASS는 당시 버전의 이력으로 보존합니다.

## 1. 기존 zip_test 변경

새 연결에서 21_latest_requirements_upgrade.sql을 열고 **전체 실행하지 않습니다.**

1. Q00을 실행해 진행 중 테스트를 ROLLBACK하고 대상이 zip_test인지 확인합니다.
2. Q01 SELECT를 실행합니다. 8개 규칙의 violations가 모두 0이어야 합니다. 위반이 있으면 멈추고 해당 행부터 확인합니다. 자동 삭제/임의 수정은 하지 않습니다.
3. SHOW CREATE TABLE reports/user_settings/housing_surveys로 새 키·컬럼이 아직 없는지 확인합니다. 이미 적용했다면 Q02를 재실행하지 않습니다.
4. 기존 자료가 있으면 백업한 뒤 Q02의 마이그레이션 전체를 한 번 선택 실행합니다. ALTER는 ROLLBACK으로 취소할 수 없습니다. 오류 이후 실행을 계속하지 않습니다.

새 DB는 최신 schema.sql 사본에서 DB명을 zip_test로 바꿔 생성하면 됩니다. 이 경우 21번 변경 SQL을 실행하지 않습니다. 기존 중복 신고가 있으면 UNIQUE가 실패합니다. 이력 보존 방안을 정하기 전에 신고를 삭제하지 않습니다. 실패 시 실제 부분 적용 상태를 확인한 뒤 복구합니다.

## 2. 정상 테스트

22_latest_requirements_positive.sql 전체 실행 → V01~V09 모두 PASS 예상. 마지막에 ROLLBACK합니다.

| ID | 확인 내용 |
|---|---|
| V01 | 설문 좌표·현재 동네 출처 저장 |
| V02 | 현재 위치 변경 후 설문·집 좌표 보존 |
| V03 | 수동 주소·좌표 생략·인증 초기화 절차 재현 |
| V04~V05 | 미설정 위치·빈 배열·홈 메모 세 개 허용 |
| V06 | 서로 다른 회원의 같은 대상 신고 허용 |
| V07 | 대상 삭제 후 신고 스냅샷·처리 상태 보존 |
| V08 | 작성자 삭제 후 타인의 신고 자체 보존 |
| V09 | 가상 데이터 정리 |

V03은 API 자동 동작이 아니라 SQL 트랜잭션의 수동 재현입니다. V08 통과가 탈퇴 후 스냅샷 개인정보 무기한 보관을 허용한다는 뜻은 아닙니다. 운영 마스킹/보관 정책은 별도입니다. 오류가 나면 같은 연결에서 ROLLBACK하고 최초 오류를 확인합니다.

## 3. 예외 테스트

23_latest_requirements_negative.sql은 전체 실행하지 않습니다. W00을 SAVEPOINT 다음 SELECT까지 한 번 실행하고 ID를 확인합니다. W01~W17을 각각 선택 실행합니다. W02만 UPDATE와 INSERT 두 문장이 한 블록입니다.

| ID | 오류 | 제약조건 |
|---|---|---|
| W01~W02 | 1062 | uk_reports_reporter_target |
| W03~W04 | 3819 | ck_survey_address_point |
| W05~W08 | 3819 | ck_settings_region_location |
| W09~W12 | 3819 | ck_settings_json_arrays |
| W13~W14 | 3819 | ck_users_home_point |
| W15 | 3819 | ck_places_point |
| W16 | 3819 | ck_place_review_rating |
| W17 | 3819 | ck_trash_weekday |

예상 밖 성공은 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT latest_negative_fixture;`로 복구합니다. 다른 오류는 미확인입니다. 마지막 W99는 PASS여야 합니다.

## 4. 구조·회귀 확인

15_schema_audit.sql 전체 실행 후 M01~M07 모두 PASS, 현재 감사 파일의 checked_count는 **44 / 358 / 71 / 62 / 15 / 2 / 44** (20261107까지 적용한 DB 기준), failed_count는 모두 0이 예상값입니다. 추가 객체/컬럼은 없음이 기본 기대입니다.

기존 01~14 및 17번은 새 제약 아래 다시 실행할 수 있습니다. 정상/블록별 실행 규칙을 지켜 전체 회귀를 실행하고 해당 버전 결과를 남깁니다. 모든 FK 조합·입력 경계가 완전히 커버되는 것은 아닙니다.

18/19/20번은 20261107까지 다섯 마이그레이션을 포함하도록 갱신했습니다. 이미 사용한 zip_migration_test에 18/19를 다시 실행하지 않습니다. 전체 경로 재검증은 18~20번 사본에서 실행 DB명을 새 미사용 이름으로 모두 바꾸고 MIGRATION_GUIDE.md 순서로 진행합니다. U00~U13 모두 PASS, 구조 감사는 최신 개수, 추가 객체는 todos_legacy_20261031 하나가 예상됩니다.

기존 zip_migration_test에 20261102 변경만 확인하려면 21번 사본의 **두 USE 구문 모두** zip_migration_test로 바꿔 사전 검사부터 진행합니다. 이 경로를 이전 35개부터의 전체 재검증으로 기록하지 않습니다.

## 결과 전달

```text
Q01: 8개 규칙 violations 모두 0인지
V01~V09: 각 PASS / FAIL / 미실행
W01~W17: 각 오류 번호 + 제약조건
W99: PASS / FAIL
M01~M07: result / checked_count / failed_count
기존 회귀 재실행 범위:
새 DB 전체 이전 U00~U13 및 최종 구조(실행 시):
최초 오류:
```

## 자동 검사와 한계

프로젝트 루트에서 실행합니다.

```powershell
node db/tests/generate-schema-audit.cjs
node --test db/tests/schema-assets.test.cjs
```

정적 검사 5개와 격리 MySQL 9.6.0 실행을 완료했습니다. 정상 SQL 검증 106개·예상 오류 94개, 전체/증분 마이그레이션, 구조 감사와 중복 신고 이관 실패 시 데이터 보존이 통과했습니다. 기계 판독 결과는 VALIDATION_20261102.json을 참고하세요. 이 수치는 20261102 당시 이력입니다. 현재 전체 격리 실행은 VALIDATION_20261107.json(정상 111·예상 거부 95)을 참고하세요. 사용자 DB 적용 결과와는 구분합니다.

Windows에 MySQL Server 9.6이 기본 경로로 설치된 환경에서는 다음 명령으로 격리 실행을 재현할 수 있습니다. 고유 임시 데이터 디렉터리·named pipe만 사용하고 TCP는 비활성화합니다. Windows 파이프 접근 권한이 필요할 수 있으며 실패 시 로그를 확인합니다. 실행기는 종료 시 임시 서버를 내리고 Git 제외 경로 db/private에 진단 파일을 남깁니다.

```powershell
node db/tests/run-isolated-mysql.cjs
```

db/LATEST_REQUIREMENTS.md의 API01~API15는 백엔드 구현 후의 인수 기준이며 현재 PASS가 아닙니다. 모든 FK 동작 조합·입력 경계를 완전히 검증한 것은 아니며 인증·권한·동시성·개인정보 삭제·실제 파일/AI 처리를 SQL 검사만으로 완료 처리하지 않습니다.

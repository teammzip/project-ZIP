# 미검증 제약조건 보완

주요 구조 감사 M01~M07 통과 이후 실행합니다. 이전 대표 테스트에서 다루지 않은 전화번호·인증 토큰 UNIQUE, 회원별 PK, 주거 설문 CHECK 3개와 대출 경계값·생성컬럼을 확인합니다. 모든 FK와 모든 입력 조합을 완전히 검사하는 파일은 아닙니다.

## 실행

zip_test의 기존 미완료 트랜잭션이 없는 새 연결에서 17_supplemental_negative.sql을 엽니다. **전체 실행하지 않습니다.**

1. S00 준비 블록을 USE부터 SAVEPOINT 뒤 SELECT까지 한 번 실행합니다. member_id/verification_id는 숫자, loan_id는 UUID인지 확인합니다.
2. S01~S12를 문장 하나씩 선택 실행합니다. 아래 오류 번호와 키/컬럼 이름을 비교합니다.
3. 예상 밖 성공은 FAIL로 기록하고 `ROLLBACK TO SAVEPOINT supplemental_fixture;`로 준비 상태를 되돌립니다. 다른 오류는 해당 항목 미확인입니다.
4. S99 정리 블록을 실행하고 PASS를 확인합니다. 중간에 중단해도 같은 연결에서 ROLLBACK으로 정리합니다.

| ID | 예상 오류 | 키·컬럼 |
|---|---|---|
| S01 | 1062 | uk_users_phone |
| S02 | 1062 | uk_phone_verifications_verified_token_hash |
| S03 | 1062 | user_settings.PRIMARY |
| S04 | 1062 | housing_surveys.PRIMARY |
| S05 | 3819 | ck_survey_flags |
| S06 | 3819 | ck_survey_loan_rate |
| S07 | 3819 | ck_survey_loan_day |
| S08~S09 | 3819 | ck_housing_loan_terms |
| S10~S11 | 3819 | ck_loan_interest_snapshot |
| S12 | 3105 | period_ym 생성컬럼 직접 대입 불가 |

S12의 실패는 올바른 월을 넣어도 생성컬럼에 직접 값을 지정할 수 없기 때문입니다. 정상 INSERT는 period_ym을 생략해야 합니다. 이전 대출 테스트 P02에서는 날짜에서 월이 자동 생성되는 정상 동작을 확인했습니다.

현재 스키마는 존재하지 않는 생일·전화번호 서비스 규칙, 계약 유형별 입력 조합, 주소 소유권 등을 자동 검증하지 않습니다. 가상 000 접두사 전화번호 저장 성공을 실제 휴대전화 검증으로 기록하지 않습니다. 인증 토큰은 가상 문자열로 만든 테스트 해시이며 실서비스 키/개인정보를 쓰지 않습니다.

## 결과

```text
S01~S12: 각각 오류 번호 + 키·컬럼
S99: PASS / FAIL
최초 예상 밖 오류:
```

격리 MySQL 9.6.0 실행 결과는 RESULTS.md와 VALIDATION_20261107.json에 기록했으며 새 환경의 결과는 별도로 확인합니다. 다음 단계는 이전 버전의 가상 DB를 따로 만드는 마이그레이션 검증입니다. 현재 최신 zip_test에 이전 버전용 마이그레이션을 다시 실행하지 않습니다. 운영 백업/복구·성능·API 권한·동시성은 이후 별도 작업입니다.

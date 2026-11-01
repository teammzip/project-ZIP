# 신고·제재·재가입 차단·고객센터 DB 검증

## 준비와 범위

reports, user_sanctions, banned_identities, support_inquiries를 검증합니다. users, regions, posts는 가상 대상 생성용입니다. 앞선 검증 종료 후 zip_test의 새 연결에서 시작합니다. 기존 트랜잭션이 없어야 하며 테스트 중 COMMIT·DDL·다른 START TRANSACTION을 실행하지 않습니다. 실제 계정·신고·운영자의 데이터는 사용하지 않습니다.

```sql
USE zip_test;
SHOW CREATE TABLE reports;
SHOW CREATE TABLE user_sanctions;
SHOW CREATE TABLE banned_identities;
SHOW CREATE TABLE support_inquiries;
```

user_sanctions에 seen_at/revoked_at/revoked_by/revoke_reason, support_inquiries에 answer_content/answered_by/answered_at이 있어야 합니다.

## 정상 테스트

11_moderation_positive.sql을 전체 실행하고 I01~I14 모두 PASS인지 확인합니다. 마지막에 ROLLBACK합니다. 중간 오류로 멈추면 같은 연결에서 ROLLBACK하고 첫 오류를 확인합니다.

| ID | 검증 내용 |
|---|---|
| I01~I02 | 신고 기본값·실제 가상 글 연결·처리 상태·글 숨김 수동 반영 |
| I03 | 경고 확인 시각 저장 |
| I04 | 기간·영구 정지 조건 조회, 경고·만료 제외 |
| I05 | 차단 식별값 3종과 키 버전 저장 |
| I06 | 기간 정지·관련 차단 해제, 원래 ends_at 보존 |
| I07 | 문의 기본 유형·답변 대기 |
| I08~I10 | 조건부 최초 답변 1행, 재답변 0행, 원래 내용 보존 |
| I11 | 관리자 삭제 시 관리자 FK만 NULL, 처리·답변 내용 보존 |
| I12 | 신고자 삭제 시 신고 CASCADE, 관련 제재의 report_id SET NULL |
| I13 | 대상 회원 삭제 시 제재·문의 삭제, 재가입 차단 해시 보존 |
| I14 | 최종 테스트 데이터 제거 |

I04/I06은 SQL의 조회 조건을 검증하며 실제 로그인을 막는 기능이 아닙니다. 한 회원에게 여러 조치를 넣는 경계 fixture이므로 영구 정지는 기간 정지를 해제한 뒤에도 남습니다. users.status는 자동으로 변경되지 않습니다. I08~I10은 answered_at IS NULL 조건을 쓴 순차 UPDATE 검증이며 별도의 동시성·관리자 권한 테스트를 대신하지 않습니다.

가상 해시의 SHA2 표현은 테스트 값 생성 전용입니다. 실제 전화번호/닉네임을 사용하지 않고 운영 HMAC 키도 사용하지 않습니다. 실제 서버는 정규화와 서버 비밀키 기반 HMAC, 보관기간·만료 정리·해제 동기화를 구현해야 합니다. 해시를 익명 데이터로 간주해 운영 값을 공개하면 안 됩니다.

## 오류 테스트

12_moderation_negative.sql은 전체 실행하지 않습니다.

1. J00 준비 블록(USE부터 SAVEPOINT 다음 SELECT까지)을 한 번 실행합니다. 출력 ID가 모두 숫자인지 확인합니다. missing ID는 이번 준비 단계에서 생성 후 삭제한 가상 행입니다.
2. J01~J07을 각각 선택 실행하고 오류 번호와 키/컬럼을 비교합니다.
3. 예상 밖 성공이면 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT moderation_negative_fixture;`로 준비 상태를 복구합니다. 다른 오류는 해당 검증 미확인입니다.
4. J99 정리 블록을 실행하고 PASS를 확인합니다.

| ID | 예상 오류 | 키·컬럼 |
|---|---|---|
| J01 | 1062 | uk_banned_sanction_identity |
| J02 | 1452 | fk_user_sanctions_user_id |
| J03 | 1452 | fk_user_sanctions_report_id |
| J04 | 1452 | fk_reports_reporter_id |
| J05 | 1452 | fk_banned_identities_user_id |
| J06 | 1452 | fk_support_inquiries_user_id |
| J07 | 1048 | content cannot be null |

J00의 일시적인 신고 행은 target_id=1을 사용하나 실제 글 1번을 조회·수정·삭제하지 않습니다. reports.target_id에는 직접 FK가 없어 대상 존재/종류 검사는 서버 책임이라는 점에 유의합니다.

## 결과와 남은 범위

```text
MySQL 버전:
I01~I14: 각 PASS / FAIL / 미실행
J01~J07: 각 오류 번호 + 키·컬럼
J99: PASS / FAIL
최초 예상 밖 오류:
```

이 파일은 스키마와 정적으로 대조했지만 실제 MySQL 실행은 아직 확인하지 않았습니다. 관리자 권한·소유권·로그인/재가입 차단, WARNING 등 API 명칭 변환, 정지 기간 검증, 제재 대상과 차단 식별값 소유자 일치, 문의/답변 길이, 정지 만료 후 상태 갱신, 동시 답변·동시 제재는 API 구현 후 확인합니다. 회원 삭제 시 제재 원문은 보존되지 않고 차단 해시만 남는 현재 설계가 운영 정책에 맞는지도 별도로 결정해야 합니다. 결과 확인 후 동네·지도·AI 검증으로 진행합니다.

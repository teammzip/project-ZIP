# 일정·메모·알림 DB 검증

## 범위와 준비

대상: event_categories, event_presets, events, memos, notifications. users와 user_settings는 가상 데이터의 소유자·홈 메모 설정 검증을 위해 함께 사용합니다. 실제 MySQL 실행 결과는 사용자 확인 후 판정합니다. 전체 44개 테이블 또는 백엔드 기능의 검증 완료를 의미하지 않습니다.

이전 테스트가 끝난 뒤 **zip_test의 새 연결**에서 시작합니다. 기존 미완료 트랜잭션이 없어야 하며 실행 중 COMMIT·DDL·다른 START TRANSACTION을 실행하지 않습니다. 각 파일은 자체 가상 데이터를 생성하므로 이전 회원 ID나 변수가 필요하지 않습니다. 연결을 바꾸면 변수·트랜잭션을 이어 쓸 수 없습니다.

```sql
USE zip_test;
SHOW CREATE TABLE event_categories;
SHOW CREATE TABLE event_presets;
SHOW CREATE TABLE events;
SHOW CREATE TABLE memos;
SHOW COLUMNS FROM notifications;
```

events에 is_anniversary/repeat_yearly와 ck_events_anniversary_flags, memos에 ck_memos_items_array, notifications에 deleted_at이 있어야 합니다. 이 구조가 다르면 먼저 최신 마이그레이션 적용 상태를 확인합니다.

## 1. 정상 테스트: 05_life_positive.sql

파일을 Workbench에서 열어 전체 실행합니다. C01~C17 모두 PASS가 예상 결과이며 마지막에 자동 ROLLBACK합니다. 중간 오류로 멈추면 같은 연결에서 ROLLBACK하고 첫 오류를 확인합니다. 출력 자체가 없는 항목을 통과로 기록하면 안 됩니다.

| ID | 검증 내용 |
|---|---|
| C01 | 서로 다른 회원은 같은 카테고리 이름 사용 가능 |
| C02 | 일정의 카테고리·시간, 기본/직접 버튼 저장 |
| C03 | 반복 기념일의 원본 한 행과 종일 저장 |
| C04~C05 | 일정 완료 및 취소의 두 컬럼 변경 |
| C06 | 카테고리 변경은 JOIN에 반영, 버튼 수정은 과거 일정 제목에 영향 없음 |
| C07 | 제목 충돌 버튼 정리 후 미분류 이동·카테고리 삭제 |
| C08 | 카테고리 직접 삭제 시 일정 SET NULL·버튼 CASCADE |
| C09~C10 | 글 메모 기본값, 체크리스트 저장·체크 수정 |
| C11 | 홈 메모 ID 문자열 배열과 순서 |
| C12~C13 | 메모 삭제 후 JSON의 남은 ID 확인·수동 정리 |
| C14~C15 | 읽음·삭제 상태에 따른 알림 목록·미확인 수 조회 |
| C16 | 회원 삭제 시 CASCADE 및 다른 회원 데이터 보존 |
| C17 | 최종 ROLLBACK으로 가상 데이터 제거 |

C07은 fixture의 기본키를 지정해 서버의 이동 절차를 수동 재현한 것입니다. 일반적인 자동 이동 API 구현이 아닙니다. C08은 예상되는 DB 삭제 규칙을 관찰하므로 통과하더라도 실제 서비스에서 버튼 보존을 원하면 C07 방식이 필요합니다. C12도 자동 정리가 없다는 사실을 확인하는 테스트이므로 PASS여야 합니다. C14~C15의 필터는 API에 구현돼야 하며 테이블 자체가 삭제된 행을 숨기지는 않습니다.

## 2. 오류 테스트: 06_life_negative.sql

**전체 실행하지 않습니다.** 같은 연결에서 D00 준비 블록(USE부터 SAVEPOINT 다음 SELECT까지)을 한 번 실행한 뒤 member_id/category_id/missing_category_id가 숫자인지 확인합니다. missing_category_id는 이번 준비 과정에서 삭제한 가상 카테고리 번호입니다.

그다음 D01~D09를 문장 하나씩 선택 실행합니다.

| ID | 예상 오류 | 확인할 키/컬럼 |
|---|---|---|
| D01 | 1062 | uk_event_categories_user_name |
| D02 | 1062 | uk_event_categories_user_system |
| D03 | 1062 | uk_event_presets_category_title |
| D04 | 1452 | fk_events_category_id |
| D05~D06 | 3819 | ck_events_anniversary_flags |
| D07 | 3819 | ck_memos_items_array |
| D08 | 3140 | items의 Invalid JSON text |
| D09 | 1048 | body cannot be null |

이번 **D09의 1048은 의도한 결과**입니다. 준비 변수가 NULL이라 user_id에서 발생한 1048과 구분해야 합니다. 에러 번호만이 아니라 메시지의 컬럼/제약조건도 확인합니다.

예상 밖 성공이면 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT life_negative_fixture;`로 준비 상태를 복원합니다. 다른 오류이면 해당 항목은 미확인으로 두고 원인을 확인합니다. 마지막에는 D99를 실행해 PASS를 확인합니다. 연결을 잃었다면 새 연결에서 준비 블록부터 다시 진행합니다. 자동 증가 번호의 빈 값은 정상입니다.

## 3. 아직 검증하지 않은 서버 규칙

- 다른 회원의 카테고리·메모 참조 금지: 개별 FK만으로 소유자 일치를 보장하지 않습니다.
- 미분류 카테고리 이름 변경·삭제 금지: system_key UNIQUE는 중복만 제한합니다.
- 기념일 완료 금지, 기간별 반복 확장과 2/29 평년 처리: 이 파일은 저장된 원본만 확인합니다.
- 메모 본문 5000자·항목 text 100자, items 내부 text/done 구조, 홈 메모 최대 3개: 현재 CHECK는 배열 여부만 확인합니다.
- 동일 날짜·제목·카테고리 일정 중복 방지: 현재 DB UNIQUE가 없으며 서버가 검사해야 합니다.
- 알림 중복 생성 방지, 참조 대상 삭제 후 이동 처리, 시간대·권한·동시성: 별도 API 검증이 필요합니다.

## 결과 전달

```text
MySQL 버전:
C01~C17: 각 PASS / FAIL / 미실행
D01~D09: 각 오류 번호와 제약조건/컬럼 이름
D99: PASS / FAIL
최초 예상 밖 오류:
```

이번 결과 확인 후 가계부·월별 집계 검증으로 진행합니다. 기존 주거 대출 테스트의 이자 집계 외에 일반 수입·지출·공과금·월세·월별 중복 제한은 별도로 확인해야 합니다.

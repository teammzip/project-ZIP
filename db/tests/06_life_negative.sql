-- zip_test 전용. 전체 실행 금지. D00 → D01~D09 각 문장 → D99 순서.

-- D00 준비 블록
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('생활제약회원');
SET @life_neg_user=LAST_INSERT_ID();
INSERT INTO event_categories (user_id,name,system_key) VALUES (@life_neg_user,'미분류','UNCATEGORIZED');
SET @life_neg_misc=LAST_INSERT_ID();
INSERT INTO event_categories (user_id,name) VALUES (@life_neg_user,'집 관리');
SET @life_neg_category=LAST_INSERT_ID();
INSERT INTO event_presets (user_id,category_id,title) VALUES (@life_neg_user,@life_neg_category,'필터 청소');
-- 존재하지 않는 카테고리 ID를 만들기 위해 이번 트랜잭션의 가상 행 하나를 삭제.
INSERT INTO event_categories (user_id,name) VALUES (@life_neg_user,'삭제할 가상 카테고리');
SET @life_neg_missing_category=LAST_INSERT_ID();
DELETE FROM event_categories WHERE id=@life_neg_missing_category;
SAVEPOINT life_negative_fixture;
SELECT DATABASE() AS db,@life_neg_user AS member_id,@life_neg_category AS category_id,
 @life_neg_missing_category AS missing_category_id;

-- D01: 1062 / uk_event_categories_user_name — 같은 회원의 이름 중복
INSERT INTO event_categories (user_id,name) VALUES (@life_neg_user,'집 관리');
-- D02: 1062 / uk_event_categories_user_system — 미분류 시스템 키 중복
INSERT INTO event_categories (user_id,name,system_key) VALUES (@life_neg_user,'두번째 미분류','UNCATEGORIZED');
-- D03: 1062 / uk_event_presets_category_title — 같은 카테고리의 버튼 제목 중복
INSERT INTO event_presets (user_id,category_id,title) VALUES (@life_neg_user,@life_neg_category,'필터 청소');
-- D04: 1452 / fk_events_category_id — 존재하지 않는 카테고리
INSERT INTO events (user_id,category_id,title,event_date)
VALUES (@life_neg_user,@life_neg_missing_category,'잘못된 참조','2026-11-02');
-- D05: 3819 / ck_events_anniversary_flags — 일반 일정의 반복
INSERT INTO events (user_id,title,event_date,is_anniversary,repeat_yearly)
VALUES (@life_neg_user,'잘못된 반복','2026-11-02',0,1);
-- D06: 3819 / ck_events_anniversary_flags — boolean 범위 밖
INSERT INTO events (user_id,title,event_date,is_anniversary,repeat_yearly)
VALUES (@life_neg_user,'잘못된 플래그','2026-11-02',2,0);
-- D07: 3819 / ck_memos_items_array — 배열 대신 객체
INSERT INTO memos (user_id,body,items) VALUES (@life_neg_user,'가상 메모',JSON_OBJECT('text','객체'));
-- D08: 3140 / Invalid JSON text — JSON 문법 오류, 키 이름 대신 items 컬럼 오류 확인
INSERT INTO memos (user_id,body,items) VALUES (@life_neg_user,'가상 메모','{invalid-json');
-- D09: 1048 / body cannot be null — 본문 필수
INSERT INTO memos (user_id,body) VALUES (@life_neg_user,NULL);

-- D99 정리 블록
ROLLBACK;
SELECT 'D99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@life_neg_user)=0
 AND (SELECT COUNT(*) FROM event_categories WHERE user_id=@life_neg_user)=0
 AND (SELECT COUNT(*) FROM event_presets WHERE user_id=@life_neg_user)=0
 AND (SELECT COUNT(*) FROM events WHERE user_id=@life_neg_user)=0
 AND (SELECT COUNT(*) FROM memos WHERE user_id=@life_neg_user)=0,'PASS','FAIL') AS result;

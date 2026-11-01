-- zip_test 전용. 전체 실행 가능. 새 연결에서 실행하고 기존 미완료 트랜잭션이 없어야 합니다.
USE zip_test;
START TRANSACTION;
SET @life_now=CURRENT_TIMESTAMP;
INSERT INTO users (nickname) VALUES ('생활검증회원');
SET @life_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('다른생활회원');
SET @life_other=LAST_INSERT_ID();
INSERT INTO event_categories (user_id,name,system_key) VALUES (@life_user,'미분류','UNCATEGORIZED');
SET @life_misc=LAST_INSERT_ID();
INSERT INTO event_categories (user_id,name) VALUES (@life_user,'집 관리');
SET @life_category=LAST_INSERT_ID();
INSERT INTO event_categories (user_id,name) VALUES (@life_other,'집 관리');
SET @life_other_category=LAST_INSERT_ID();
SELECT 'C01 회원별 동일 카테고리 이름 허용' AS test,
 IF((SELECT COUNT(*) FROM event_categories WHERE id IN (@life_category,@life_other_category) AND name='집 관리')=2,'PASS','FAIL') AS result;

INSERT INTO event_presets (user_id,category_id,title,is_custom)
VALUES (@life_user,@life_category,'필터 청소',0);
SET @life_preset=LAST_INSERT_ID();
INSERT INTO event_presets (user_id,category_id,title,is_custom)
VALUES (@life_user,@life_category,'직접 만든 항목',1);
SET @life_custom=LAST_INSERT_ID();
-- 카테고리 이동 시 제목 충돌을 검사할 목적의 중복 제목(다른 카테고리라 허용).
INSERT INTO event_presets (user_id,category_id,title,is_custom)
VALUES (@life_user,@life_misc,'필터 청소',1);
SET @life_misc_preset=LAST_INSERT_ID();
INSERT INTO events (user_id,category_id,title,event_date,event_time)
VALUES (@life_user,@life_category,'필터 청소','2026-11-02','18:00:00');
SET @life_event=LAST_INSERT_ID();
INSERT INTO events (user_id,title,event_date,is_anniversary,repeat_yearly)
VALUES (@life_user,'🎉 입주 기념일','2024-02-29',1,1);
SET @life_anniversary=LAST_INSERT_ID();
SELECT 'C02 일정·카테고리·기본/직접 항목 저장' AS test,
 IF((SELECT COUNT(*) FROM events e JOIN event_categories c ON c.id=e.category_id
 WHERE e.id=@life_event AND c.user_id=@life_user AND e.event_time='18:00:00')=1
 AND (SELECT COUNT(*) FROM event_presets WHERE id=@life_preset AND is_custom=0)=1
 AND (SELECT COUNT(*) FROM event_presets WHERE id=@life_custom AND is_custom=1)=1,'PASS','FAIL') AS result;
SELECT 'C03 반복 기념일 원본 한 행' AS test,
 IF(COUNT(*)=1 AND MIN(is_anniversary)=1 AND MIN(repeat_yearly)=1 AND MIN(event_time) IS NULL,'PASS','FAIL') AS result
FROM events WHERE id=@life_anniversary;

UPDATE events SET is_done=1,done_at=@life_now WHERE id=@life_event;
SELECT 'C04 일정 완료 저장' AS test,IF(is_done=1 AND done_at=@life_now,'PASS','FAIL') AS result
FROM events WHERE id=@life_event;
UPDATE events SET is_done=0,done_at=NULL WHERE id=@life_event;
SELECT 'C05 일정 완료 취소' AS test,IF(is_done=0 AND done_at IS NULL,'PASS','FAIL') AS result
FROM events WHERE id=@life_event;
UPDATE event_categories SET name='집 관리 수정' WHERE id=@life_category;
UPDATE event_presets SET title='필터 청소 수정' WHERE id=@life_preset;
SELECT 'C06 이름 변경과 과거 일정 제목 분리' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result
FROM events e JOIN event_categories c ON c.id=e.category_id
JOIN event_presets p ON p.id=@life_preset
WHERE e.id=@life_event AND c.name='집 관리 수정' AND e.title='필터 청소' AND p.title='필터 청소 수정';
UPDATE event_presets SET title='필터 청소' WHERE id=@life_preset;

-- 서버가 수행할 카테고리 삭제 절차를 이번 fixture의 PK들로 수동 재현.
-- 전체 회원 대상 UPDATE/DELETE 또는 안전 모드 해제를 사용하지 않습니다.
SAVEPOINT before_category_delete;
UPDATE events SET category_id=NULL WHERE id=@life_event;
DELETE FROM event_presets WHERE id=@life_preset;
UPDATE event_presets SET category_id=@life_misc WHERE id=@life_custom;
DELETE FROM event_categories WHERE id=@life_category;
SELECT 'C07 충돌 정리 후 미분류 이동' AS test,
 IF((SELECT COUNT(*) FROM events WHERE id=@life_event AND category_id IS NULL)=1
 AND (SELECT COUNT(*) FROM event_categories WHERE id=@life_category)=0
 AND (SELECT COUNT(*) FROM event_presets WHERE id IN (@life_misc_preset,@life_custom) AND category_id=@life_misc)=2
 AND (SELECT COUNT(*) FROM event_presets WHERE id=@life_preset)=0,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT before_category_delete;
-- 바로 삭제하면 이벤트는 남고 버튼은 지워진다는 FK 동작을 별도로 확인.
DELETE FROM event_categories WHERE id=@life_category;
SELECT 'C08 직접 삭제의 SET NULL·CASCADE' AS test,
 IF((SELECT COUNT(*) FROM events WHERE id=@life_event AND category_id IS NULL)=1
 AND (SELECT COUNT(*) FROM event_presets WHERE id IN (@life_preset,@life_custom))=0
 AND (SELECT COUNT(*) FROM event_presets WHERE id=@life_misc_preset)=1,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT before_category_delete;

INSERT INTO memos (user_id,body) VALUES (@life_user,'가상 글 메모');
SET @life_plain_memo=LAST_INSERT_ID();
INSERT INTO memos (user_id,title,body,color,is_pinned,is_checklist,items)
VALUES (@life_user,'장보기 테스트','','하늘',1,1,
 JSON_ARRAY(JSON_OBJECT('text','세제','done',FALSE),JSON_OBJECT('text','수세미','done',TRUE)));
SET @life_check_memo=LAST_INSERT_ID();
SELECT 'C09 메모 기본값·체크리스트 저장' AS test,
 IF((SELECT COUNT(*) FROM memos WHERE id=@life_plain_memo AND title='' AND color='노랑' AND JSON_LENGTH(items)=0)=1
 AND (SELECT COUNT(*) FROM memos WHERE id=@life_check_memo AND is_pinned=1 AND is_checklist=1
 AND JSON_LENGTH(items)=2 AND JSON_UNQUOTE(JSON_EXTRACT(items,'$[0].text'))='세제')=1,'PASS','FAIL') AS result;
UPDATE memos SET items=JSON_SET(items,'$[0].done',CAST('true' AS JSON)) WHERE id=@life_check_memo;
SELECT 'C10 체크 항목 완료 수정' AS test,
 IF(JSON_UNQUOTE(JSON_EXTRACT(items,'$[0].done'))='true','PASS','FAIL') AS result
FROM memos WHERE id=@life_check_memo;
INSERT INTO user_settings (user_id,home_memo_ids)
VALUES (@life_user,JSON_ARRAY(CAST(@life_plain_memo AS CHAR),CAST(@life_check_memo AS CHAR)));
SELECT 'C11 홈 메모 ID 문자열·순서' AS test,
 IF(JSON_TYPE(JSON_EXTRACT(home_memo_ids,'$[0]'))='STRING'
 AND JSON_UNQUOTE(JSON_EXTRACT(home_memo_ids,'$[0]'))=CAST(@life_plain_memo AS CHAR)
 AND JSON_UNQUOTE(JSON_EXTRACT(home_memo_ids,'$[1]'))=CAST(@life_check_memo AS CHAR),'PASS','FAIL') AS result
FROM user_settings WHERE user_id=@life_user;
DELETE FROM memos WHERE id=@life_plain_memo;
SELECT 'C12 메모 삭제 후 JSON ID 자동 정리 없음' AS test,
 IF((SELECT COUNT(*) FROM memos WHERE id=@life_plain_memo)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@life_user AND JSON_LENGTH(home_memo_ids)=2)=1,'PASS','FAIL') AS result;
UPDATE user_settings SET home_memo_ids=JSON_ARRAY(CAST(@life_check_memo AS CHAR)) WHERE user_id=@life_user;
SELECT 'C13 서버가 수행할 홈 메모 ID 정리' AS test,
 IF(JSON_LENGTH(home_memo_ids)=1 AND JSON_UNQUOTE(JSON_EXTRACT(home_memo_ids,'$[0]'))=CAST(@life_check_memo AS CHAR),'PASS','FAIL') AS result
FROM user_settings WHERE user_id=@life_user;

INSERT INTO notifications (user_id,noti_type,title,ref_id,notify_at)
VALUES (@life_user,'EVENT','가상 일정 알림',@life_event,@life_now);
SET @life_noti_read=LAST_INSERT_ID();
INSERT INTO notifications (user_id,noti_type,title,notify_at)
VALUES (@life_user,'SYSTEM','가상 시스템 알림',@life_now);
SET @life_noti_delete=LAST_INSERT_ID();
SELECT 'C14 초기 미확인 알림 두 건' AS test,IF(COUNT(*)=2,'PASS','FAIL') AS result
FROM notifications WHERE user_id=@life_user AND read_at IS NULL AND deleted_at IS NULL;
UPDATE notifications SET read_at=@life_now WHERE id=@life_noti_read;
UPDATE notifications SET deleted_at=@life_now WHERE id=@life_noti_delete;
SELECT 'C15 읽음·논리 삭제 조건 조회' AS test,
 IF((SELECT COUNT(*) FROM notifications WHERE user_id=@life_user)=2
 AND (SELECT COUNT(*) FROM notifications WHERE user_id=@life_user AND deleted_at IS NULL)=1
 AND (SELECT COUNT(*) FROM notifications WHERE user_id=@life_user AND read_at IS NULL AND deleted_at IS NULL)=0,'PASS','FAIL') AS result;

DELETE FROM users WHERE id=@life_user;
SELECT 'C16 회원 삭제 CASCADE·다른 회원 보존' AS test,
 IF((SELECT COUNT(*) FROM event_categories WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM event_presets WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM events WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM memos WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM notifications WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM event_categories WHERE id=@life_other_category)=1,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'C17 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@life_user,@life_other))=0
 AND (SELECT COUNT(*) FROM event_categories WHERE user_id IN (@life_user,@life_other))=0
 AND (SELECT COUNT(*) FROM event_presets WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM events WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM memos WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM notifications WHERE user_id=@life_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@life_user)=0,'PASS','FAIL') AS result;

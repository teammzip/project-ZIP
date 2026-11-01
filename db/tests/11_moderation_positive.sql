-- zip_test 전용. 새 연결에서 전체 실행. 실제 차단/문자/로그인 처리는 수행하지 않습니다.
USE zip_test;
START TRANSACTION;
SET @mod_now=CURRENT_TIMESTAMP;
SET @mod_tag=UUID();
INSERT INTO users (nickname) VALUES ('조치검증회원');
SET @mod_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('신고검증회원');
SET @mod_reporter=LAST_INSERT_ID();
INSERT INTO users (nickname,role) VALUES ('관리검증회원','ADMIN');
SET @mod_admin=LAST_INSERT_ID();
INSERT INTO regions (name,level) VALUES (CONCAT('가상',LEFT(REPLACE(UUID(),'-',''),12)),1);
SET @mod_region=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@mod_user,@mod_region,'FREE','가상 신고 대상','가상 본문');
SET @mod_post=LAST_INSERT_ID();
INSERT INTO reports (reporter_id,target_type,target_id,reason)
VALUES (@mod_reporter,'POST',@mod_post,'OTHER');
SET @mod_report=LAST_INSERT_ID();
SELECT 'I01 신고 대상·작성자·기본 상태' AS test,IF(COUNT(*)=1,'PASS','FAIL') AS result
FROM reports r JOIN posts p ON p.id=r.target_id AND r.target_type='POST'
WHERE r.id=@mod_report AND r.reporter_id=@mod_reporter AND p.user_id=@mod_user AND r.status='RECEIVED';
UPDATE reports SET status='HIDDEN',handled_by=@mod_admin,handled_at=@mod_now WHERE id=@mod_report;
UPDATE posts SET status='HIDDEN' WHERE id=@mod_post;
SELECT 'I02 신고 처리와 글 숨김 수동 반영' AS test,
 IF((SELECT COUNT(*) FROM reports WHERE id=@mod_report AND status='HIDDEN' AND handled_by=@mod_admin AND handled_at=@mod_now)=1
 AND (SELECT COUNT(*) FROM posts WHERE id=@mod_post AND status='HIDDEN')=1,'PASS','FAIL') AS result;
INSERT INTO user_sanctions (user_id,sanction_type,reason,report_id,starts_at,created_by)
VALUES (@mod_user,'WARNING','가상 경고',@mod_report,@mod_now,@mod_admin);
SET @mod_warn=LAST_INSERT_ID();
UPDATE user_sanctions SET seen_at=@mod_now WHERE id=@mod_warn;
SELECT 'I03 경고 확인 이력' AS test,IF(seen_at=@mod_now,'PASS','FAIL') AS result FROM user_sanctions WHERE id=@mod_warn;
INSERT INTO user_sanctions (user_id,sanction_type,reason,report_id,starts_at,ends_at,created_by)
VALUES (@mod_user,'SUSPEND','가상 기간 정지',@mod_report,DATE_SUB(@mod_now,INTERVAL 1 DAY),DATE_ADD(@mod_now,INTERVAL 3 DAY),@mod_admin);
SET @mod_suspend=LAST_INSERT_ID();
INSERT INTO user_sanctions (user_id,sanction_type,reason,report_id,starts_at,created_by)
VALUES (@mod_user,'BAN','가상 영구 정지',@mod_report,@mod_now,@mod_admin);
SET @mod_ban=LAST_INSERT_ID();
INSERT INTO user_sanctions (user_id,sanction_type,reason,starts_at,ends_at)
VALUES (@mod_user,'SUSPEND','만료된 가상 정지',DATE_SUB(@mod_now,INTERVAL 5 DAY),DATE_SUB(@mod_now,INTERVAL 1 DAY));
SELECT 'I04 기간·영구 정지 조회, 경고·만료 제외' AS test,IF(COUNT(*)=2,'PASS','FAIL') AS result
FROM user_sanctions WHERE user_id=@mod_user AND sanction_type IN ('SUSPEND','BAN')
AND starts_at<=@mod_now AND (ends_at IS NULL OR ends_at>@mod_now) AND revoked_at IS NULL;

-- SHA2는 비밀 없는 가상 fixture 값 생성 전용. 실제 운영 HMAC 구현 예제가 아닙니다.
INSERT INTO banned_identities (user_id,sanction_id,identity_type,identity_hash,starts_at)
VALUES (@mod_user,@mod_ban,'LOGIN_ID',SHA2(CONCAT('login-',@mod_tag),256),@mod_now),
 (@mod_user,@mod_ban,'NICKNAME',SHA2(CONCAT('nick-',@mod_tag),256),@mod_now),
 (@mod_user,@mod_ban,'PHONE',SHA2(CONCAT('phone-',@mod_tag),256),@mod_now);
INSERT INTO banned_identities (user_id,sanction_id,identity_type,identity_hash,starts_at,expires_at)
VALUES (@mod_user,@mod_suspend,'LOGIN_ID',SHA2(CONCAT('temp-',@mod_tag),256),@mod_now,DATE_ADD(@mod_now,INTERVAL 3 DAY));
SET @mod_temp_identity=LAST_INSERT_ID();
SELECT 'I05 차단 식별값 3종·키 버전 기본값' AS test,
 IF(COUNT(*)=3 AND COUNT(DISTINCT identity_type)=3 AND MIN(hash_key_version)=1,'PASS','FAIL') AS result
FROM banned_identities WHERE sanction_id=@mod_ban AND expires_at IS NULL AND revoked_at IS NULL;
UPDATE user_sanctions SET revoked_at=@mod_now,revoked_by=@mod_admin,revoke_reason='가상 조기 해제' WHERE id=@mod_suspend;
UPDATE banned_identities SET revoked_at=@mod_now WHERE id=@mod_temp_identity;
SELECT 'I06 조기 해제와 원래 종료 시각 보존' AS test,
 IF((SELECT COUNT(*) FROM user_sanctions WHERE id=@mod_suspend AND revoked_at=@mod_now AND ends_at=DATE_ADD(@mod_now,INTERVAL 3 DAY))=1
 AND (SELECT COUNT(*) FROM banned_identities WHERE id=@mod_temp_identity AND revoked_at=@mod_now)=1
 AND (SELECT COUNT(*) FROM user_sanctions WHERE user_id=@mod_user AND sanction_type IN ('SUSPEND','BAN') AND starts_at<=@mod_now
 AND (ends_at IS NULL OR ends_at>@mod_now) AND revoked_at IS NULL)=1,'PASS','FAIL') AS result;

INSERT INTO support_inquiries (user_id,title,content) VALUES (@mod_user,'가상 문의','가상 문의 본문');
SET @mod_inquiry=LAST_INSERT_ID();
SELECT 'I07 문의 기본 유형·답변 대기' AS test,
 IF(category='이용 문의' AND answered_at IS NULL AND answer_content IS NULL,'PASS','FAIL') AS result
FROM support_inquiries WHERE id=@mod_inquiry;
UPDATE support_inquiries SET answer_content='첫 가상 답변',answered_by=@mod_admin,answered_at=@mod_now
WHERE id=@mod_inquiry AND answered_at IS NULL;
SELECT 'I08 최초 조건부 답변 1행' AS test,IF(ROW_COUNT()=1,'PASS','FAIL') AS result;
UPDATE support_inquiries SET answer_content='덮어쓰면 안 되는 답변',answered_by=@mod_admin,answered_at=@mod_now
WHERE id=@mod_inquiry AND answered_at IS NULL;
SELECT 'I09 두번째 조건부 답변 0행' AS test,IF(ROW_COUNT()=0,'PASS','FAIL') AS result;
SELECT 'I10 최초 답변 내용 보존' AS test,IF(answer_content='첫 가상 답변','PASS','FAIL') AS result
FROM support_inquiries WHERE id=@mod_inquiry;

DELETE FROM users WHERE id=@mod_admin;
SELECT 'I11 관리자 삭제 후 내용 보존·관리자 FK 해제' AS test,
 IF((SELECT COUNT(*) FROM reports WHERE id=@mod_report AND handled_by IS NULL)=1
 AND (SELECT COUNT(*) FROM user_sanctions WHERE id=@mod_suspend AND created_by IS NULL AND revoked_by IS NULL AND revoke_reason='가상 조기 해제')=1
 AND (SELECT COUNT(*) FROM user_sanctions WHERE id=@mod_ban AND created_by IS NULL)=1
 AND (SELECT COUNT(*) FROM support_inquiries WHERE id=@mod_inquiry AND answered_by IS NULL AND answer_content='첫 가상 답변' AND answered_at IS NOT NULL)=1,'PASS','FAIL') AS result;
DELETE FROM users WHERE id=@mod_reporter;
SELECT 'I12 신고자 삭제 후 신고 삭제·제재 보존' AS test,
 IF((SELECT COUNT(*) FROM reports WHERE id=@mod_report)=0
 AND (SELECT COUNT(*) FROM user_sanctions WHERE id IN (@mod_warn,@mod_suspend,@mod_ban) AND report_id IS NULL)=3,'PASS','FAIL') AS result;
DELETE FROM users WHERE id=@mod_user;
SELECT 'I13 탈퇴 후 차단 해시 보존' AS test,
 IF((SELECT COUNT(*) FROM user_sanctions WHERE user_id=@mod_user)=0
 AND (SELECT COUNT(*) FROM support_inquiries WHERE id=@mod_inquiry)=0
 AND (SELECT COUNT(*) FROM banned_identities WHERE identity_hash IN
 (SHA2(CONCAT('login-',@mod_tag),256),SHA2(CONCAT('nick-',@mod_tag),256),SHA2(CONCAT('phone-',@mod_tag),256))
 AND user_id IS NULL AND sanction_id IS NULL AND revoked_at IS NULL)=3
 AND (SELECT COUNT(*) FROM banned_identities WHERE id=@mod_temp_identity AND user_id IS NULL AND sanction_id IS NULL AND revoked_at=@mod_now)=1,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'I14 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@mod_user,@mod_reporter,@mod_admin))=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@mod_region)=0
 AND (SELECT COUNT(*) FROM posts WHERE id=@mod_post)=0
 AND (SELECT COUNT(*) FROM reports WHERE id=@mod_report)=0
 AND (SELECT COUNT(*) FROM user_sanctions WHERE user_id=@mod_user)=0
 AND (SELECT COUNT(*) FROM support_inquiries WHERE id=@mod_inquiry)=0
 AND (SELECT COUNT(*) FROM banned_identities WHERE identity_hash IN
 (SHA2(CONCAT('login-',@mod_tag),256),SHA2(CONCAT('nick-',@mod_tag),256),SHA2(CONCAT('phone-',@mod_tag),256),SHA2(CONCAT('temp-',@mod_tag),256)))=0,'PASS','FAIL') AS result;

-- zip_test 전용. 전체 실행 금지. J00 → J01~J07 각각 → J99.
-- J00 준비 블록
USE zip_test;
START TRANSACTION;
SET @mod_neg_tag=UUID();
INSERT INTO users (nickname) VALUES ('조치제약회원');
SET @mod_neg_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('삭제할가상회원');
SET @mod_neg_missing_user=LAST_INSERT_ID();
DELETE FROM users WHERE id=@mod_neg_missing_user;
INSERT INTO user_sanctions (user_id,sanction_type,reason,starts_at)
VALUES (@mod_neg_user,'BAN','가상 정지',CURRENT_TIMESTAMP);
SET @mod_neg_sanction=LAST_INSERT_ID();
INSERT INTO banned_identities (user_id,sanction_id,identity_type,identity_hash,starts_at)
VALUES (@mod_neg_user,@mod_neg_sanction,'LOGIN_ID',SHA2(@mod_neg_tag,256),CURRENT_TIMESTAMP);
INSERT INTO reports (reporter_id,target_type,target_id,reason)
VALUES (@mod_neg_user,'POST',1,'OTHER');
SET @mod_neg_missing_report=LAST_INSERT_ID();
DELETE FROM reports WHERE id=@mod_neg_missing_report;
-- 위 target_id=1은 FK 없는 다형 참조 fixture이며 실제 게시글 존재를 검증하지 않습니다.
SAVEPOINT moderation_negative_fixture;
SELECT DATABASE() AS db,@mod_neg_user AS member_id,@mod_neg_sanction AS sanction_id,
 @mod_neg_missing_user AS missing_user_id,@mod_neg_missing_report AS missing_report_id;

-- J01: 1062 / uk_banned_sanction_identity
INSERT INTO banned_identities (user_id,sanction_id,identity_type,identity_hash,starts_at)
VALUES (@mod_neg_user,@mod_neg_sanction,'LOGIN_ID',SHA2(CONCAT('other-',@mod_neg_tag),256),CURRENT_TIMESTAMP);
-- J02: 1452 / fk_user_sanctions_user_id
INSERT INTO user_sanctions (user_id,sanction_type,reason,starts_at)
VALUES (@mod_neg_missing_user,'WARNING','잘못된 회원',CURRENT_TIMESTAMP);
-- J03: 1452 / fk_user_sanctions_report_id
INSERT INTO user_sanctions (user_id,sanction_type,reason,report_id,starts_at)
VALUES (@mod_neg_user,'WARNING','잘못된 신고',@mod_neg_missing_report,CURRENT_TIMESTAMP);
-- J04: 1452 / fk_reports_reporter_id
INSERT INTO reports (reporter_id,target_type,target_id,reason) VALUES (@mod_neg_missing_user,'POST',1,'OTHER');
-- J05: 1452 / fk_banned_identities_user_id
INSERT INTO banned_identities (user_id,identity_type,identity_hash,starts_at)
VALUES (@mod_neg_missing_user,'PHONE',SHA2(CONCAT('phone-',@mod_neg_tag),256),CURRENT_TIMESTAMP);
-- J06: 1452 / fk_support_inquiries_user_id
INSERT INTO support_inquiries (user_id,title,content) VALUES (@mod_neg_missing_user,'잘못된 회원 문의','가상 본문');
-- J07: 1048 / content cannot be null
INSERT INTO support_inquiries (user_id,title,content) VALUES (@mod_neg_user,'가상 문의',NULL);

-- J99 정리 블록
ROLLBACK;
SELECT 'J99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@mod_neg_user)=0
 AND (SELECT COUNT(*) FROM user_sanctions WHERE user_id=@mod_neg_user)=0
 AND (SELECT COUNT(*) FROM reports WHERE reporter_id=@mod_neg_user)=0
 AND (SELECT COUNT(*) FROM support_inquiries WHERE user_id=@mod_neg_user)=0
 AND (SELECT COUNT(*) FROM banned_identities WHERE identity_hash IN
 (SHA2(@mod_neg_tag,256),SHA2(CONCAT('other-',@mod_neg_tag),256),SHA2(CONCAT('phone-',@mod_neg_tag),256)))=0,'PASS','FAIL') AS result;

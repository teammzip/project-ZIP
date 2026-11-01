-- zip_test 전용。전체 실행 금지. H00 → H01~H09 각각 → H99.
-- H00 준비 블록
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('커뮤니티제약회원');
SET @community_neg_user=LAST_INSERT_ID();
INSERT INTO regions (name,level) VALUES (CONCAT('가상',LEFT(REPLACE(UUID(),'-',''),12)),1);
SET @community_neg_region=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@community_neg_user,@community_neg_region,'FREE','가상 원본','가상 본문');
SET @community_neg_post=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@community_neg_user,@community_neg_region,'FREE','가상 두번째 글','가상 본문');
SET @community_neg_other_post=LAST_INSERT_ID();
INSERT INTO post_likes (post_id,user_id) VALUES (@community_neg_post,@community_neg_user);
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_neg_user,'fixture-a.png','urn:zip-test:a','image/png',1024);
SET @community_neg_file=LAST_INSERT_ID();
INSERT INTO post_attachments (post_id,file_id,sort_order) VALUES (@community_neg_post,@community_neg_file,0);
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_neg_user,'fixture-b.png','urn:zip-test:b','image/png',1024);
SET @community_neg_other_file=LAST_INSERT_ID();
-- 이번 fixture에서 삭제한 ID로 존재하지 않는 참조를 만듭니다.
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@community_neg_user,@community_neg_region,'FREE','삭제할 가상 글','가상 본문');
SET @community_neg_missing_post=LAST_INSERT_ID();
DELETE FROM posts WHERE id=@community_neg_missing_post;
INSERT INTO comments (post_id,user_id,body) VALUES (@community_neg_post,@community_neg_user,'삭제할 가상 댓글');
SET @community_neg_missing_comment=LAST_INSERT_ID();
DELETE FROM comments WHERE id=@community_neg_missing_comment;
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_neg_user,'missing.png','urn:zip-test:missing','image/png',1);
SET @community_neg_missing_file=LAST_INSERT_ID();
DELETE FROM uploaded_files WHERE id=@community_neg_missing_file;
SAVEPOINT community_negative_fixture;
SELECT DATABASE() AS db,@community_neg_user AS member_id,@community_neg_post AS post_id,
 @community_neg_file AS file_id,@community_neg_region AS region_id;

-- H01: 1062 / PRIMARY — 좋아요 중복
INSERT INTO post_likes (post_id,user_id) VALUES (@community_neg_post,@community_neg_user);
-- H02: 1062 / uk_post_attachments_file_id — 같은 파일을 다른 글에 재사용
INSERT INTO post_attachments (post_id,file_id,sort_order) VALUES (@community_neg_other_post,@community_neg_file,0);
-- H03: 1062 / uk_post_attachments_post_sort — 같은 글의 표시 순서 중복
INSERT INTO post_attachments (post_id,file_id,sort_order) VALUES (@community_neg_post,@community_neg_other_file,0);
-- H04: 1452 / fk_post_likes_post_id
INSERT INTO post_likes (post_id,user_id) VALUES (@community_neg_missing_post,@community_neg_user);
-- H05: 1452 / fk_post_attachments_file_id
INSERT INTO post_attachments (post_id,file_id,sort_order) VALUES (@community_neg_post,@community_neg_missing_file,1);
-- H06: 1452 / fk_comments_parent_id
INSERT INTO comments (post_id,user_id,parent_id,body)
VALUES (@community_neg_post,@community_neg_user,@community_neg_missing_comment,'잘못된 대댓글');
-- H07: 1451 / fk_posts_region_id — 게시글이 참조하는 동네 삭제
DELETE FROM regions WHERE id=@community_neg_region;
-- H08: 1048 / storage_url cannot be null
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_neg_user,'invalid.png',NULL,'image/png',1024);
-- H09: 1452 / fk_comments_post_id
INSERT INTO comments (post_id,user_id,body) VALUES (@community_neg_missing_post,@community_neg_user,'없는 글 댓글');

-- H99 정리 블록
ROLLBACK;
SELECT 'H99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@community_neg_user)=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@community_neg_region)=0
 AND (SELECT COUNT(*) FROM posts WHERE user_id=@community_neg_user)=0
 AND (SELECT COUNT(*) FROM post_likes WHERE user_id=@community_neg_user)=0
 AND (SELECT COUNT(*) FROM comments WHERE user_id=@community_neg_user)=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE user_id=@community_neg_user)=0
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id IN (@community_neg_post,@community_neg_other_post))=0,'PASS','FAIL') AS result;

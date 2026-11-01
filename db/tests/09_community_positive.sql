-- zip_test 전용. 새 연결에서 전체 실행. 실제 파일을 업로드하거나 내려받지 않습니다.
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('게시글검증회원');
SET @community_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('댓글검증회원');
SET @community_other=LAST_INSERT_ID();
INSERT INTO regions (name,level) VALUES (CONCAT('가상',LEFT(REPLACE(UUID(),'-',''),12)),1);
SET @community_region=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@community_user,@community_region,'TIP','가상 정리 팁','가상 게시글 본문');
SET @community_post=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body)
VALUES (@community_other,@community_region,'FREE','다른 회원 글','보존할 가상 본문');
SET @community_other_post=LAST_INSERT_ID();
SELECT 'G01 게시글·회원·동네 연결 및 기본값' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM posts p JOIN users u ON u.id=p.user_id
 JOIN regions r ON r.id=p.region_id WHERE p.id=@community_post AND u.id=@community_user
 AND r.id=@community_region AND p.status='VISIBLE' AND p.like_count=0 AND p.comment_count=0;
UPDATE posts SET title='수정한 가상 팁',body='수정한 가상 본문',is_home_tip=1 WHERE id=@community_post;
SELECT 'G02 게시글 수정' AS test,IF(title='수정한 가상 팁' AND body='수정한 가상 본문' AND is_home_tip=1,'PASS','FAIL') AS result
FROM posts WHERE id=@community_post;
INSERT INTO post_likes (post_id,user_id) VALUES (@community_post,@community_other);
INSERT INTO comments (post_id,user_id,body) VALUES (@community_post,@community_user,'가상 부모 댓글');
SET @community_comment=LAST_INSERT_ID();
INSERT INTO comments (post_id,user_id,parent_id,body)
VALUES (@community_post,@community_other,@community_comment,'가상 대댓글');
SET @community_reply=LAST_INSERT_ID();
SELECT 'G03 좋아요·댓글·대댓글 연결' AS test,
 IF((SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post AND user_id=@community_other)=1
 AND (SELECT COUNT(*) FROM comments WHERE id=@community_reply AND parent_id=@community_comment AND post_id=@community_post)=1,'PASS','FAIL') AS result;
SELECT 'G04 집계 컬럼 자동 갱신 없음' AS test,
 IF((SELECT COUNT(*) FROM posts WHERE id=@community_post AND like_count=0 AND comment_count=0)=1
 AND (SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post)=1
 AND (SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=2,'PASS','FAIL') AS result;
UPDATE posts SET like_count=(SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post),
 comment_count=(SELECT COUNT(*) FROM comments WHERE post_id=@community_post AND status='VISIBLE' AND deleted_at IS NULL)
WHERE id=@community_post;
SELECT 'G05 서버가 수행할 카운터 갱신' AS test,IF(like_count=1 AND comment_count=2,'PASS','FAIL') AS result
FROM posts WHERE id=@community_post;
UPDATE comments SET body='수정한 가상 대댓글' WHERE id=@community_reply;
SELECT 'G06 댓글 수정' AS test,IF(body='수정한 가상 대댓글','PASS','FAIL') AS result FROM comments WHERE id=@community_reply;

INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_user,'fixture-a.png','urn:zip-test:fixture-a','image/png',1024);
SET @community_file_a=LAST_INSERT_ID();
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@community_user,'fixture-b.png','urn:zip-test:fixture-b','image/png',2048);
SET @community_file_b=LAST_INSERT_ID();
INSERT INTO post_attachments (post_id,file_id,sort_order)
VALUES (@community_post,@community_file_a,0),(@community_post,@community_file_b,1);
INSERT INTO user_profiles (user_id,avatar_file_id) VALUES (@community_user,@community_file_a);
SELECT 'G07 첨부·표시 순서·크기 합계' AS test,
 IF(COUNT(*)=2 AND SUM(f.size_bytes)=3072 AND MIN(a.sort_order)=0 AND MAX(a.sort_order)=1,'PASS','FAIL') AS result
FROM post_attachments a JOIN uploaded_files f ON f.id=a.file_id WHERE a.post_id=@community_post AND f.user_id=@community_user;

SAVEPOINT community_baseline;
UPDATE posts SET status='DELETED',deleted_at=CURRENT_TIMESTAMP WHERE id=@community_post;
SELECT 'G08 논리 삭제는 자식 유지·조회에서 제외' AS test,
 IF((SELECT COUNT(*) FROM posts WHERE id=@community_post AND status='VISIBLE' AND deleted_at IS NULL)=0
 AND (SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=2
 AND (SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post)=1
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id=@community_post)=2,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT community_baseline;
DELETE FROM comments WHERE id=@community_comment;
SELECT 'G09 부모 댓글 실제 삭제 시 대댓글 CASCADE' AS test,
 IF((SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=0
 AND (SELECT comment_count FROM posts WHERE id=@community_post)=2,'PASS','FAIL') AS result;
-- 카운터는 자동으로 0이 되지 않으므로 서비스가 함께 갱신해야 합니다.
ROLLBACK TO SAVEPOINT community_baseline;
DELETE FROM uploaded_files WHERE id=@community_file_a;
SELECT 'G10 파일 행 삭제 시 첨부 해제·프로필 SET NULL' AS test,
 IF((SELECT COUNT(*) FROM post_attachments WHERE file_id=@community_file_a)=0
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id=@community_post)=1
 AND (SELECT COUNT(*) FROM user_profiles WHERE user_id=@community_user AND avatar_file_id IS NULL)=1
 AND (SELECT COUNT(*) FROM posts WHERE id=@community_post)=1,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT community_baseline;
DELETE FROM posts WHERE id=@community_post;
SELECT 'G11 게시글 실제 삭제와 파일 메타데이터 보존' AS test,
 IF((SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE id IN (@community_file_a,@community_file_b))=2,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT community_baseline;
DELETE FROM users WHERE id=@community_user;
SELECT 'G12 회원 삭제 영향·다른 회원 보존' AS test,
 IF((SELECT COUNT(*) FROM posts WHERE id=@community_post)=0
 AND (SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE user_id=@community_user)=0
 AND (SELECT COUNT(*) FROM user_profiles WHERE user_id=@community_user)=0
 AND (SELECT COUNT(*) FROM users WHERE id=@community_other)=1
 AND (SELECT COUNT(*) FROM posts WHERE id=@community_other_post)=1,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'G13 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@community_user,@community_other))=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@community_region)=0
 AND (SELECT COUNT(*) FROM posts WHERE id IN (@community_post,@community_other_post))=0
 AND (SELECT COUNT(*) FROM comments WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM post_likes WHERE post_id=@community_post)=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE user_id=@community_user)=0
 AND (SELECT COUNT(*) FROM user_profiles WHERE user_id=@community_user)=0
 AND (SELECT COUNT(*) FROM post_attachments WHERE post_id=@community_post)=0,'PASS','FAIL') AS result;

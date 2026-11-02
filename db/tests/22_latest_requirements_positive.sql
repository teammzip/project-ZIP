-- 20261102_requirements_hardening 적용 후 zip_test의 새 연결에서 전체 실행.
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('최신검증작성자');
SET @latest_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('최신검증신고자');
SET @latest_reporter=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('다른검증신고자');
SET @latest_other=LAST_INSERT_ID();
INSERT INTO user_settings (user_id,region_name,region_source,region_lat,region_lon)
VALUES (@latest_user,'가상 설문 동네','SURVEY',0,0);
INSERT INTO housing_surveys (user_id,birth_date,address,address_lat,address_lon,contract_kind,income_period,answered_at)
VALUES (@latest_user,'2000-01-01','가상 설문 동네',0,0,'MONTHLY','MONTHLY',CURRENT_TIMESTAMP);
SELECT 'V01 설문 좌표·동네 출처 저장' AS test,
 IF((SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_user AND region_source='SURVEY' AND region_lat=0 AND region_lon=0)=1
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@latest_user AND address_lat=0 AND address_lon=0)=1,'PASS','FAIL') AS result;
UPDATE users SET region_verified_at=CURRENT_TIMESTAMP WHERE id=@latest_user;
UPDATE user_settings SET region_source='VERIFIED',region_lat=90,region_lon=-180 WHERE user_id=@latest_user;
SELECT 'V02 인증 좌표와 설문 스냅샷 분리' AS test,
 IF((SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_user AND region_lat=90 AND region_lon=-180)=1
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@latest_user AND address_lat=0 AND address_lon=0)=1
 AND (SELECT COUNT(*) FROM users WHERE id=@latest_user AND home_lat IS NULL AND home_lon IS NULL)=1,'PASS','FAIL') AS result;
-- 주소 변경 시 인증 초기화를 서비스 트랜잭션에서 수동 재현합니다.
UPDATE user_settings SET region_name='다른 가상 동네',region_source='MANUAL',region_lat=NULL,region_lon=NULL WHERE user_id=@latest_user;
UPDATE users SET region_verified_at=NULL WHERE id=@latest_user;
SELECT 'V03 좌표 없는 수동 지역·인증 초기화' AS test,
 IF((SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_user AND region_source='MANUAL' AND region_lat IS NULL AND region_lon IS NULL)=1
 AND (SELECT COUNT(*) FROM users WHERE id=@latest_user AND region_verified_at IS NULL)=1,'PASS','FAIL') AS result;
UPDATE user_settings SET region_name=NULL,region_source=NULL,region_lat=NULL,region_lon=NULL,
 home_memo_ids=JSON_ARRAY(),map_categories=JSON_ARRAY(),map_keywords=JSON_ARRAY() WHERE user_id=@latest_user;
SELECT 'V04 미설정 위치와 빈 JSON 배열 허용' AS test,
 IF(region_source IS NULL AND JSON_LENGTH(home_memo_ids)=0,'PASS','FAIL') AS result
FROM user_settings WHERE user_id=@latest_user;
UPDATE user_settings SET home_memo_ids=JSON_ARRAY('1','2','3') WHERE user_id=@latest_user;
SELECT 'V05 홈 메모 최대 세 개' AS test,IF(JSON_LENGTH(home_memo_ids)=3,'PASS','FAIL') AS result
FROM user_settings WHERE user_id=@latest_user;
-- 위 ID는 형식/개수 검사용이며 실제 소유권 검증 통과를 의미하지 않습니다.
INSERT INTO regions (name,level) VALUES (CONCAT('가상',LEFT(REPLACE(UUID(),'-',''),12)),1);
SET @latest_region=LAST_INSERT_ID();
INSERT INTO posts (user_id,region_id,category,title,body) VALUES (@latest_user,@latest_region,'FREE','가상 신고 제목','가상 본문');
SET @latest_post=LAST_INSERT_ID();
INSERT INTO reports (reporter_id,target_type,target_id,reason,detail,target_author_snapshot,target_text_snapshot)
SELECT @latest_reporter,'POST',p.id,'OTHER','가상 사유',u.nickname,p.title FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=@latest_post;
SET @latest_report=LAST_INSERT_ID();
INSERT INTO reports (reporter_id,target_type,target_id,reason,detail,target_author_snapshot,target_text_snapshot)
SELECT @latest_other,'POST',p.id,'OTHER','다른 가상 사유',u.nickname,p.title FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=@latest_post;
SELECT 'V06 서로 다른 회원의 동일 대상 신고 허용' AS test,IF(COUNT(*)=2,'PASS','FAIL') AS result
FROM reports WHERE target_type='POST' AND target_id=@latest_post;
UPDATE reports SET status='DISMISSED',handled_at=CURRENT_TIMESTAMP WHERE id=@latest_report;
DELETE FROM posts WHERE id=@latest_post;
SELECT 'V07 대상 삭제 후 신고 스냅샷·처리 상태 보존' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM reports WHERE id=@latest_report AND status='DISMISSED'
 AND target_author_snapshot='최신검증작성자' AND target_text_snapshot='가상 신고 제목';
-- 실제 글/댓글 삭제 API는 관련 신고를 HIDDEN으로 갱신하는 정책을 별도 구현합니다.
DELETE FROM users WHERE id=@latest_user;
SELECT 'V08 작성자 탈퇴 후 타인의 신고 보존' AS test,
 IF((SELECT COUNT(*) FROM reports WHERE target_type='POST' AND target_id=@latest_post)=2
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@latest_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_user)=0,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'V09 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@latest_user,@latest_reporter,@latest_other))=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@latest_region)=0
 AND (SELECT COUNT(*) FROM reports WHERE reporter_id IN (@latest_reporter,@latest_other))=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_user)=0
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@latest_user)=0,'PASS','FAIL') AS result;

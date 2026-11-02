-- zip_test 전용. 새 연결에서 전체 실행. 실제 위치 조회·AI 호출·파일 전송은 없습니다.
USE zip_test;
START TRANSACTION;
SET @map_tag=LEFT(REPLACE(UUID(),'-',''),12);
INSERT INTO regions (name,level) VALUES (CONCAT('가상부모',@map_tag),1);
SET @map_parent=LAST_INSERT_ID();
INSERT INTO regions (parent_id,name,level) VALUES (@map_parent,'가상동네A',2);
SET @map_region=LAST_INSERT_ID();
INSERT INTO regions (parent_id,name,level) VALUES (@map_parent,'가상동네B',2);
SET @map_other_region=LAST_INSERT_ID();
INSERT INTO region_neighbors (region_id,neighbor_region_id) VALUES (@map_region,@map_other_region);
SELECT 'K01 동네 계층·방향성 이웃' AS test,
 IF((SELECT COUNT(*) FROM regions WHERE parent_id=@map_parent)=2
 AND (SELECT COUNT(*) FROM region_neighbors WHERE region_id=@map_region AND neighbor_region_id=@map_other_region)=1
 AND (SELECT COUNT(*) FROM region_neighbors WHERE region_id=@map_other_region AND neighbor_region_id=@map_region)=0,'PASS','FAIL') AS result;
INSERT INTO users (nickname,region_id) VALUES ('지도AI검증회원',@map_region);
SET @map_user=LAST_INSERT_ID();
INSERT INTO users (nickname,region_id) VALUES ('다른지도회원',@map_other_region);
SET @map_other=LAST_INSERT_ID();
INSERT INTO trash_schedules (region_id,weekday,waste_type,description)
VALUES (@map_region,1,'GENERAL','가상 월요일 일반 배출'),(@map_region,1,'RECYCLE','가상 월요일 재활용 배출');
SELECT 'K02 같은 요일 다른 배출 종류' AS test,IF(COUNT(*)=2,'PASS','FAIL') AS result
FROM trash_schedules WHERE region_id=@map_region AND weekday=1;
INSERT INTO place_categories (name,icon) VALUES (CONCAT('검증',@map_tag),'📍');
SET @map_category=LAST_INSERT_ID();
INSERT INTO places (region_id,category_id,name,lat,lon)
VALUES (@map_region,@map_category,'가상 장소',0.000000,0.000000);
SET @map_place=LAST_INSERT_ID();
SELECT 'K03 장소·분류·동네 연결, 0 좌표 저장' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM places p JOIN place_categories c ON c.id=p.category_id
 JOIN regions r ON r.id=p.region_id WHERE p.id=@map_place AND p.lat=0 AND p.lon=0 AND p.source='MANUAL';
INSERT INTO place_favorites (user_id,place_id) VALUES (@map_user,@map_place),(@map_other,@map_place);
INSERT INTO place_reviews (place_id,user_id,rating,body) VALUES (@map_place,@map_user,4,'가상 리뷰'),(@map_place,@map_other,2,'다른 가상 리뷰');
SELECT 'K04 회원별 즐겨찾기·리뷰' AS test,
 IF((SELECT COUNT(*) FROM place_favorites WHERE place_id=@map_place)=2
 AND (SELECT COUNT(*) FROM place_reviews WHERE place_id=@map_place)=2,'PASS','FAIL') AS result;
SELECT 'K05 리뷰 집계 자동 갱신 없음' AS test,IF(rating_avg IS NULL AND review_count=0,'PASS','FAIL') AS result
FROM places WHERE id=@map_place;
UPDATE places SET rating_avg=(SELECT AVG(rating) FROM place_reviews WHERE place_id=@map_place),
 review_count=(SELECT COUNT(*) FROM place_reviews WHERE place_id=@map_place) WHERE id=@map_place;
SELECT 'K06 리뷰 집계 수동 반영' AS test,IF(rating_avg=3.0 AND review_count=2,'PASS','FAIL') AS result
FROM places WHERE id=@map_place;
INSERT INTO user_settings (user_id,map_categories,map_keywords)
VALUES (@map_user,JSON_ARRAY(CONCAT('검증',@map_tag)),JSON_ARRAY('가상 검색어'));
SELECT 'K07 지도 설정 JSON 저장' AS test,
 IF(JSON_UNQUOTE(JSON_EXTRACT(map_categories,'$[0]'))=CONCAT('검증',@map_tag)
 AND JSON_UNQUOTE(JSON_EXTRACT(map_keywords,'$[0]'))='가상 검색어','PASS','FAIL') AS result
FROM user_settings WHERE user_id=@map_user;

INSERT INTO ai_topics (code,name,description) VALUES (CONCAT('test',@map_tag),'가상 AI 주제','가상 테스트 설명');
SET @map_topic=LAST_INSERT_ID();
INSERT INTO ai_conversations (user_id,topic_id,entry_point,title)
VALUES (@map_user,@map_topic,'AI_PAGE','가상 AI 대화');
SET @map_conversation=LAST_INSERT_ID();
INSERT INTO ai_conversations (user_id,entry_point,title) VALUES (@map_other,'HOME_MODAL','다른 회원 대화');
SET @map_other_conversation=LAST_INSERT_ID();
INSERT INTO ai_messages (conversation_id,role,content) VALUES (@map_conversation,'USER','가상 질문');
INSERT INTO ai_messages (conversation_id,role,content,card_type,card_data)
VALUES (@map_conversation,'ASSISTANT','가상 지출 요약','SPEND_SUMMARY',JSON_OBJECT('month',11,'total',12345));
SET @map_summary=LAST_INSERT_ID();
INSERT INTO ai_messages (conversation_id,role,content,card_type,card_data)
VALUES (@map_conversation,'ASSISTANT','가상 이동 안내','LINK',JSON_OBJECT('label','지도 보기','to','/map'));
SET @map_link=LAST_INSERT_ID();
SELECT 'K08 대화·질문·카드 메시지 저장' AS test,
 IF((SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_conversation)=3
 AND (SELECT COUNT(*) FROM ai_messages WHERE id=@map_summary AND card_type='SPEND_SUMMARY'
 AND JSON_EXTRACT(card_data,'$.total')=12345)=1
 AND (SELECT COUNT(*) FROM ai_messages WHERE id=@map_link AND card_type='LINK'
 AND JSON_UNQUOTE(JSON_EXTRACT(card_data,'$.to'))='/map')=1,'PASS','FAIL') AS result;
INSERT INTO ai_usage_daily (user_id,usage_date,question_count)
VALUES (@map_user,'2026-11-02',1),(@map_user,'2026-11-03',0),(@map_other,'2026-11-02',7);
UPDATE ai_usage_daily SET question_count=question_count+1 WHERE user_id=@map_user AND usage_date='2026-11-02';
SELECT 'K09 일별·회원별 사용량 구분 및 증가' AS test,
 IF((SELECT question_count FROM ai_usage_daily WHERE user_id=@map_user AND usage_date='2026-11-02')=2
 AND (SELECT question_count FROM ai_usage_daily WHERE user_id=@map_user AND usage_date='2026-11-03')=0
 AND (SELECT question_count FROM ai_usage_daily WHERE user_id=@map_other AND usage_date='2026-11-02')=7,'PASS','FAIL') AS result;

-- 현재 AI 사진 영구 미보관 정책과 별개로, 스키마의 선택적 파일 FK만 검증하는 메타데이터.
INSERT INTO uploaded_files (user_id,original_name,storage_url,mime_type,size_bytes)
VALUES (@map_user,'fixture.png','urn:zip-test:ai-file','image/png',1);
SET @map_file=LAST_INSERT_ID();
UPDATE ai_messages SET attachment_id=@map_file WHERE id=@map_link;
SAVEPOINT map_ai_baseline;
DELETE FROM uploaded_files WHERE id=@map_file;
SELECT 'K10 파일 삭제 후 메시지·카드 유지' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM ai_messages WHERE id=@map_link AND attachment_id IS NULL AND card_type='LINK';
ROLLBACK TO SAVEPOINT map_ai_baseline;
DELETE FROM ai_topics WHERE id=@map_topic;
SELECT 'K11 주제 삭제 후 대화·메시지 보존' AS test,
 IF((SELECT COUNT(*) FROM ai_conversations WHERE id=@map_conversation AND topic_id IS NULL)=1
 AND (SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_conversation)=3,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT map_ai_baseline;
DELETE FROM ai_conversations WHERE id=@map_conversation;
SELECT 'K12 대화 삭제 시 메시지 CASCADE·다른 대화 보존' AS test,
 IF((SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_conversation)=0
 AND (SELECT COUNT(*) FROM ai_conversations WHERE id=@map_other_conversation)=1,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT map_ai_baseline;
DELETE FROM places WHERE id=@map_place;
SELECT 'K13 장소 삭제 시 즐겨찾기·리뷰 CASCADE' AS test,
 IF((SELECT COUNT(*) FROM place_favorites WHERE place_id=@map_place)=0
 AND (SELECT COUNT(*) FROM place_reviews WHERE place_id=@map_place)=0
 AND (SELECT COUNT(*) FROM place_categories WHERE id=@map_category)=1,'PASS','FAIL') AS result;
DELETE FROM regions WHERE id=@map_region;
SELECT 'K14 동네 삭제 후 회원 연결 해제·요일표·이웃 삭제' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@map_user AND region_id IS NULL)=1
 AND (SELECT COUNT(*) FROM trash_schedules WHERE region_id=@map_region)=0
 AND (SELECT COUNT(*) FROM region_neighbors WHERE region_id=@map_region OR neighbor_region_id=@map_region)=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@map_other_region)=1,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT map_ai_baseline;
DELETE FROM users WHERE id=@map_user;
SELECT 'K15 회원 삭제·공통 데이터·다른 회원 보존' AS test,
 IF((SELECT COUNT(*) FROM ai_conversations WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_conversation)=0
 AND (SELECT COUNT(*) FROM ai_usage_daily WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM place_favorites WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM place_reviews WHERE user_id=@map_user)=0
 AND (SELECT COUNT(*) FROM places WHERE id=@map_place)=1
 AND (SELECT COUNT(*) FROM ai_topics WHERE id=@map_topic)=1
 AND (SELECT COUNT(*) FROM ai_conversations WHERE id=@map_other_conversation)=1
 AND (SELECT COUNT(*) FROM place_reviews WHERE user_id=@map_other AND place_id=@map_place)=1,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'K16 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@map_user,@map_other))=0
 AND (SELECT COUNT(*) FROM regions WHERE id IN (@map_parent,@map_region,@map_other_region))=0
 AND (SELECT COUNT(*) FROM region_neighbors WHERE region_id=@map_region OR neighbor_region_id=@map_region)=0
 AND (SELECT COUNT(*) FROM trash_schedules WHERE region_id=@map_region)=0
 AND (SELECT COUNT(*) FROM place_categories WHERE id=@map_category)=0
 AND (SELECT COUNT(*) FROM places WHERE id=@map_place)=0
 AND (SELECT COUNT(*) FROM place_favorites WHERE place_id=@map_place)=0
 AND (SELECT COUNT(*) FROM place_reviews WHERE place_id=@map_place)=0
 AND (SELECT COUNT(*) FROM ai_topics WHERE id=@map_topic)=0
 AND (SELECT COUNT(*) FROM ai_conversations WHERE user_id IN (@map_user,@map_other))=0
 AND (SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_conversation)=0
 AND (SELECT COUNT(*) FROM ai_usage_daily WHERE user_id IN (@map_user,@map_other))=0
 AND (SELECT COUNT(*) FROM uploaded_files WHERE id=@map_file)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@map_user)=0,'PASS','FAIL') AS result;

-- zip_test 전용. 전체 실행 금지. L00 → L01~L13 각각 → L99.
-- L00 준비 블록
USE zip_test;
START TRANSACTION;
SET @map_neg_tag=LEFT(REPLACE(UUID(),'-',''),12);
INSERT INTO users (nickname) VALUES ('지도AI제약회원');
SET @map_neg_user=LAST_INSERT_ID();
INSERT INTO regions (name,level) VALUES (CONCAT('가상부모',@map_neg_tag),1);
SET @map_neg_parent=LAST_INSERT_ID();
INSERT INTO regions (parent_id,name,level) VALUES (@map_neg_parent,'가상동네A',2);
SET @map_neg_region=LAST_INSERT_ID();
INSERT INTO regions (parent_id,name,level) VALUES (@map_neg_parent,'가상동네B',2);
SET @map_neg_other_region=LAST_INSERT_ID();
INSERT INTO region_neighbors (region_id,neighbor_region_id) VALUES (@map_neg_region,@map_neg_other_region);
INSERT INTO trash_schedules (region_id,weekday,waste_type,description) VALUES (@map_neg_region,1,'GENERAL','가상 안내');
INSERT INTO place_categories (name) VALUES (CONCAT('검증',@map_neg_tag));
SET @map_neg_category=LAST_INSERT_ID();
INSERT INTO places (region_id,category_id,name,lat,lon) VALUES (@map_neg_region,@map_neg_category,'가상 장소',0,0);
SET @map_neg_place=LAST_INSERT_ID();
INSERT INTO place_favorites (user_id,place_id) VALUES (@map_neg_user,@map_neg_place);
INSERT INTO place_reviews (place_id,user_id,rating) VALUES (@map_neg_place,@map_neg_user,4);
INSERT INTO ai_usage_daily (user_id,usage_date) VALUES (@map_neg_user,'2026-11-02');
INSERT INTO ai_topics (code,name,description) VALUES (CONCAT('test',@map_neg_tag),'가상 주제','가상 테스트 설명');
SET @map_neg_topic=LAST_INSERT_ID();
INSERT INTO ai_conversations (user_id,topic_id,entry_point) VALUES (@map_neg_user,@map_neg_topic,'AI_PAGE');
SET @map_neg_conversation=LAST_INSERT_ID();
INSERT INTO ai_conversations (user_id,entry_point) VALUES (@map_neg_user,'AI_PAGE');
SET @map_neg_missing_conversation=LAST_INSERT_ID();
DELETE FROM ai_conversations WHERE id=@map_neg_missing_conversation;
SAVEPOINT map_ai_negative_fixture;
SELECT DATABASE() AS db,@map_neg_user AS member_id,@map_neg_parent AS parent_region_id,
 @map_neg_region AS region_id,@map_neg_place AS place_id,@map_neg_conversation AS conversation_id;

-- L01: 1062 / uk_regions_parent_id_name
INSERT INTO regions (parent_id,name,level) VALUES (@map_neg_parent,'가상동네A',2);
-- L02: 1062 / PRIMARY (region_neighbors)
INSERT INTO region_neighbors (region_id,neighbor_region_id) VALUES (@map_neg_region,@map_neg_other_region);
-- L03: 1062 / uk_trash_schedules_region_weekday_type
INSERT INTO trash_schedules (region_id,weekday,waste_type,description) VALUES (@map_neg_region,1,'GENERAL','중복 안내');
-- L04: 1062 / uk_place_categories_name
INSERT INTO place_categories (name) VALUES (CONCAT('검증',@map_neg_tag));
-- L05: 1062 / PRIMARY (place_favorites)
INSERT INTO place_favorites (user_id,place_id) VALUES (@map_neg_user,@map_neg_place);
-- L06: 1062 / uk_place_reviews_place_id_user_id
INSERT INTO place_reviews (place_id,user_id,rating) VALUES (@map_neg_place,@map_neg_user,5);
-- L07: 1062 / PRIMARY (ai_usage_daily)
INSERT INTO ai_usage_daily (user_id,usage_date) VALUES (@map_neg_user,'2026-11-02');
-- L08: 1062 / uk_ai_topics_code
INSERT INTO ai_topics (code,name,description) VALUES (CONCAT('test',@map_neg_tag),'중복 주제','가상 테스트 설명');
-- L09: 1451 / fk_places_category_id
DELETE FROM place_categories WHERE id=@map_neg_category;
-- L10: 1451 / fk_regions_parent_id
DELETE FROM regions WHERE id=@map_neg_parent;
-- L11: 1452 / fk_ai_messages_conversation_id
INSERT INTO ai_messages (conversation_id,role,content) VALUES (@map_neg_missing_conversation,'USER','없는 대화 질문');
-- L12: 3140 / ai_messages.card_data Invalid JSON text
INSERT INTO ai_messages (conversation_id,role,content,card_type,card_data)
VALUES (@map_neg_conversation,'ASSISTANT','잘못된 카드','LINK','{invalid-json');
-- L13: 1451 / fk_places_region_id
DELETE FROM regions WHERE id=@map_neg_region;

-- L99 정리 블록
ROLLBACK;
SELECT 'L99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@map_neg_user)=0
 AND (SELECT COUNT(*) FROM regions WHERE id IN (@map_neg_parent,@map_neg_region,@map_neg_other_region))=0
 AND (SELECT COUNT(*) FROM region_neighbors WHERE region_id=@map_neg_region)=0
 AND (SELECT COUNT(*) FROM trash_schedules WHERE region_id=@map_neg_region)=0
 AND (SELECT COUNT(*) FROM place_categories WHERE id=@map_neg_category)=0
 AND (SELECT COUNT(*) FROM places WHERE id=@map_neg_place)=0
 AND (SELECT COUNT(*) FROM place_favorites WHERE place_id=@map_neg_place)=0
 AND (SELECT COUNT(*) FROM place_reviews WHERE place_id=@map_neg_place)=0
 AND (SELECT COUNT(*) FROM ai_topics WHERE id=@map_neg_topic)=0
 AND (SELECT COUNT(*) FROM ai_conversations WHERE user_id=@map_neg_user)=0
 AND (SELECT COUNT(*) FROM ai_messages WHERE conversation_id=@map_neg_conversation)=0
 AND (SELECT COUNT(*) FROM ai_usage_daily WHERE user_id=@map_neg_user)=0,'PASS','FAIL') AS result;

-- 전체 실행 금지. 새 연결에서 W00 → W01~W17 각 블록 → W99.
-- W00 준비
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('최신제약회원');
SET @latest_neg_user=LAST_INSERT_ID();
INSERT INTO user_settings (user_id) VALUES (@latest_neg_user);
INSERT INTO housing_surveys (user_id,birth_date,address,contract_kind,income_period,answered_at)
VALUES (@latest_neg_user,'2000-01-01','가상 주소','MONTHLY','MONTHLY',CURRENT_TIMESTAMP);
INSERT INTO regions (name,level) VALUES (CONCAT('가상',LEFT(REPLACE(UUID(),'-',''),12)),1);
SET @latest_neg_region=LAST_INSERT_ID();
INSERT INTO reports (reporter_id,target_type,target_id,reason,detail) VALUES (@latest_neg_user,'POST',1,'OTHER','가상 제약 검사');
SET @latest_neg_report=LAST_INSERT_ID();
-- target_id는 다형 참조의 중복 키만 검사하는 fixture. 글 1번의 조회/수정/삭제는 하지 않습니다.
INSERT INTO place_categories (name) VALUES (CONCAT('검증',LEFT(REPLACE(UUID(),'-',''),12)));
SET @latest_neg_category=LAST_INSERT_ID();
INSERT INTO places (region_id,category_id,name,lat,lon) VALUES (@latest_neg_region,@latest_neg_category,'가상 장소',0,0);
SET @latest_neg_place=LAST_INSERT_ID();
SAVEPOINT latest_negative_fixture;
SELECT DATABASE() AS db,@latest_neg_user AS member_id,@latest_neg_report AS report_id,@latest_neg_place AS place_id;
-- W01: 1062 / uk_reports_reporter_target
INSERT INTO reports (reporter_id,target_type,target_id,reason) VALUES (@latest_neg_user,'POST',1,'ABUSE');
-- W02: 블록 두 문장 실행. 1062 / uk_reports_reporter_target — 기각 후에도 재신고 불가
UPDATE reports SET status='DISMISSED' WHERE id=@latest_neg_report;
INSERT INTO reports (reporter_id,target_type,target_id,reason) VALUES (@latest_neg_user,'POST',1,'ABUSE');
-- W03: 3819 / ck_survey_address_point — 위도 범위
UPDATE housing_surveys SET address_lat=91,address_lon=0 WHERE user_id=@latest_neg_user;
-- W04: 3819 / ck_survey_address_point — 좌표 한쪽 누락
UPDATE housing_surveys SET address_lat=1,address_lon=NULL WHERE user_id=@latest_neg_user;
-- W05: 3819 / ck_settings_region_location — 출처 없는 위치
UPDATE user_settings SET region_name='가상 동네' WHERE user_id=@latest_neg_user;
-- W06: 3819 / ck_settings_region_location — 빈 동네 이름
UPDATE user_settings SET region_name=' ',region_source='MANUAL' WHERE user_id=@latest_neg_user;
-- W07: 3819 / ck_settings_region_location — 좌표 한쪽 누락
UPDATE user_settings SET region_name='가상',region_source='SURVEY',region_lat=1,region_lon=NULL WHERE user_id=@latest_neg_user;
-- W08: 3819 / ck_settings_region_location — 경도 범위
UPDATE user_settings SET region_name='가상',region_source='VERIFIED',region_lat=0,region_lon=181 WHERE user_id=@latest_neg_user;
-- W09: 3819 / ck_settings_json_arrays — 메모 네 개
UPDATE user_settings SET home_memo_ids=JSON_ARRAY('1','2','3','4') WHERE user_id=@latest_neg_user;
-- W10: 3819 / ck_settings_json_arrays — 메모 배열 대신 객체
UPDATE user_settings SET home_memo_ids=JSON_OBJECT('id','1') WHERE user_id=@latest_neg_user;
-- W11: 3819 / ck_settings_json_arrays — 분류 배열 대신 객체
UPDATE user_settings SET map_categories=JSON_OBJECT('name','가상') WHERE user_id=@latest_neg_user;
-- W12: 3819 / ck_settings_json_arrays — 검색어 배열 대신 객체
UPDATE user_settings SET map_keywords=JSON_OBJECT('keyword','가상') WHERE user_id=@latest_neg_user;
-- W13: 3819 / ck_users_home_point — 집 좌표 한쪽 누락
UPDATE users SET home_lat=1,home_lon=NULL WHERE id=@latest_neg_user;
-- W14: 3819 / ck_users_home_point — 집 경도 범위
UPDATE users SET home_lat=0,home_lon=181 WHERE id=@latest_neg_user;
-- W15: 3819 / ck_places_point
UPDATE places SET lat=91 WHERE id=@latest_neg_place;
-- W16: 3819 / ck_place_review_rating
INSERT INTO place_reviews (place_id,user_id,rating) VALUES (@latest_neg_place,@latest_neg_user,0);
-- W17: 3819 / ck_trash_weekday
INSERT INTO trash_schedules (region_id,weekday,waste_type,description) VALUES (@latest_neg_region,7,'GENERAL','잘못된 요일');
-- W99 정리
ROLLBACK;
SELECT 'W99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@latest_neg_user)=0
 AND (SELECT COUNT(*) FROM reports WHERE reporter_id=@latest_neg_user)=0
 AND (SELECT COUNT(*) FROM regions WHERE id=@latest_neg_region)=0
 AND (SELECT COUNT(*) FROM place_categories WHERE id=@latest_neg_category)=0
 AND (SELECT COUNT(*) FROM places WHERE id=@latest_neg_place)=0
 AND (SELECT COUNT(*) FROM place_reviews WHERE place_id=@latest_neg_place)=0
 AND (SELECT COUNT(*) FROM trash_schedules WHERE region_id=@latest_neg_region)=0
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@latest_neg_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@latest_neg_user)=0,'PASS','FAIL') AS result;

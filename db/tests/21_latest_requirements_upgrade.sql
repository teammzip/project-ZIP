-- 전체 실행 금지. Q00 정리 → Q01 사전 조회가 모두 0인지 확인 → Q02 변경 순서.
-- zip_test 전용. 실제 DDL 변경이므로 ROLLBACK으로 취소 불가. 기존 데이터가 있으면 백업.
-- 구조가 최신 44개 표(기존 M01~M07 통과)인 DB에서 한 번만 적용.
-- Q00
ROLLBACK;
USE zip_test;
SELECT DATABASE() AS db,VERSION() AS mysql_version;
-- Q01 아래 결과의 violations가 모두 0이어야 합니다.
SELECT '중복 신고 그룹' AS rule_name,COUNT(*) AS violations FROM
 (SELECT reporter_id,target_type,target_id FROM reports GROUP BY reporter_id,target_type,target_id HAVING COUNT(*)>1) d
UNION ALL
SELECT '집 좌표',COUNT(*) FROM users WHERE NOT ((home_lat IS NULL AND home_lon IS NULL) OR (home_lat IS NOT NULL AND home_lon IS NOT NULL AND home_lat BETWEEN -90 AND 90 AND home_lon BETWEEN -180 AND 180))
UNION ALL
SELECT '홈 메모 JSON',COUNT(*) FROM user_settings WHERE home_memo_ids IS NOT NULL AND (JSON_TYPE(home_memo_ids)<>'ARRAY' OR JSON_LENGTH(home_memo_ids)>3)
UNION ALL
SELECT '지도 분류 JSON',COUNT(*) FROM user_settings WHERE map_categories IS NOT NULL AND JSON_TYPE(map_categories)<>'ARRAY'
UNION ALL
SELECT '지도 검색어 JSON',COUNT(*) FROM user_settings WHERE map_keywords IS NOT NULL AND JSON_TYPE(map_keywords)<>'ARRAY'
UNION ALL
SELECT '장소 좌표',COUNT(*) FROM places WHERE lat NOT BETWEEN -90 AND 90 OR lon NOT BETWEEN -180 AND 180
UNION ALL
SELECT '별점',COUNT(*) FROM place_reviews WHERE rating NOT BETWEEN 1 AND 5
UNION ALL
SELECT '배출 요일',COUNT(*) FROM trash_schedules WHERE weekday NOT BETWEEN 0 AND 6;

-- Q02: 사전 위반이 없고 새 컬럼/키가 아직 없음을 확인한 뒤 아래 전체를 선택 실행.
-- 최신 44개 테이블 DB 대상, 한 번만 적용. 새 DB에는 최신 schema.sql만 사용.
-- 실행 전 migrations/README.md의 사전 검사·백업·쓰기 중단을 수행합니다.
-- 기존 중복/범위 위반 데이터를 자동 삭제·수정하지 않습니다. 오류가 나면 즉시 멈추세요.
-- DDL은 암묵 커밋. 실패 후 전체 파일을 무조건 재실행하지 마세요.
SET NAMES utf8mb4;
USE `zip_test`;

ALTER TABLE `reports`
  ADD COLUMN `target_author_snapshot` VARCHAR(12) NULL COMMENT '신고 당시 작성자 표시명 — 삭제 후 표시용, 권한 근거로 사용 금지',
  ADD COLUMN `target_text_snapshot` VARCHAR(200) NULL COMMENT '신고 당시 글 제목 또는 댓글 내용 — 서버가 실제 대상에서 복사',
  ADD UNIQUE KEY `uk_reports_reporter_target` (`reporter_id`, `target_type`, `target_id`);

ALTER TABLE `users`
  ADD CONSTRAINT `ck_users_home_point` CHECK ((`home_lat` IS NULL AND `home_lon` IS NULL) OR (`home_lat` IS NOT NULL AND `home_lon` IS NOT NULL AND `home_lat` BETWEEN -90 AND 90 AND `home_lon` BETWEEN -180 AND 180));

ALTER TABLE `user_settings`
  ADD COLUMN `region_name` VARCHAR(200) NULL COMMENT '현재 동네 표시명 — regionLocation.region',
  ADD COLUMN `region_source` ENUM('SURVEY','VERIFIED','MANUAL') NULL COMMENT '현재 동네 선택 출처 — regionLocation.source',
  ADD COLUMN `region_lat` DECIMAL(9,6) NULL COMMENT '현재 동네 좌표 위도 — 집 위치와 구분',
  ADD COLUMN `region_lon` DECIMAL(9,6) NULL COMMENT '현재 동네 좌표 경도 — 출처에 따라 행정구역 중심 또는 인증 위치',
  ADD CONSTRAINT `ck_settings_region_location` CHECK ((`region_source` IS NULL AND `region_name` IS NULL AND `region_lat` IS NULL AND `region_lon` IS NULL) OR (`region_source` IS NOT NULL AND `region_name` IS NOT NULL AND CHAR_LENGTH(TRIM(`region_name`)) > 0 AND ((`region_lat` IS NULL AND `region_lon` IS NULL) OR (`region_lat` IS NOT NULL AND `region_lon` IS NOT NULL AND `region_lat` BETWEEN -90 AND 90 AND `region_lon` BETWEEN -180 AND 180)))),
  ADD CONSTRAINT `ck_settings_json_arrays` CHECK ((`home_memo_ids` IS NULL OR (JSON_TYPE(`home_memo_ids`) = 'ARRAY' AND JSON_LENGTH(`home_memo_ids`) <= 3)) AND (`map_categories` IS NULL OR JSON_TYPE(`map_categories`) = 'ARRAY') AND (`map_keywords` IS NULL OR JSON_TYPE(`map_keywords`) = 'ARRAY'));

ALTER TABLE `housing_surveys`
  ADD COLUMN `address_lat` DECIMAL(9,6) NULL COMMENT '설문 주소 검색 당시 행정구역 중심 위도 — addressPoint.lat',
  ADD COLUMN `address_lon` DECIMAL(9,6) NULL COMMENT '설문 주소 검색 당시 행정구역 중심 경도 — addressPoint.lon',
  ADD CONSTRAINT `ck_survey_address_point` CHECK ((`address_lat` IS NULL AND `address_lon` IS NULL) OR (`address_lat` IS NOT NULL AND `address_lon` IS NOT NULL AND `address_lat` BETWEEN -90 AND 90 AND `address_lon` BETWEEN -180 AND 180));

ALTER TABLE `trash_schedules`
  ADD CONSTRAINT `ck_trash_weekday` CHECK (`weekday` BETWEEN 0 AND 6);

ALTER TABLE `places`
  ADD CONSTRAINT `ck_places_point` CHECK (`lat` BETWEEN -90 AND 90 AND `lon` BETWEEN -180 AND 180);

ALTER TABLE `place_reviews`
  ADD CONSTRAINT `ck_place_review_rating` CHECK (`rating` BETWEEN 1 AND 5);

SET NAMES utf8mb4;
USE `zip`;

-- 회원마다 기본 카테고리 5개 + 미분류, 기본 항목 30개를 복사합니다.
-- 가입 트랜잭션에서는 아래 users 조회를 새 회원 id로 제한해서 실행하세요.
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '집 관리', '🏠', NULL, 0 FROM `users`;
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'에어컨 필터 청소',0,0 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'배수구 청소',0,1 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'전구 교체',0,2 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'소모품 재고 확인',0,3 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'생필품 주문',0,4 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'곰팡이 점검',0,5 FROM `event_categories` WHERE `name`='집 관리';
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '청소·빨래', '🧺', NULL, 1 FROM `users`;
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'이불 빨래',0,0 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'화장실 청소',0,1 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'냉장고 정리',0,2 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'세탁기 통세척',0,3 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'침구 교체',0,4 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'쓰레기통 비우기',0,5 FROM `event_categories` WHERE `name`='청소·빨래';
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '돈·계약', '💸', NULL, 2 FROM `users`;
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'월세 이체',0,0 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'공과금 납부',0,1 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'관리비 확인',0,2 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'보험료 납부',0,3 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'계약 만료 확인',0,4 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'통신비 확인',0,5 FROM `event_categories` WHERE `name`='돈·계약';
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '건강·생활', '💊', NULL, 3 FROM `users`;
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'병원 예약',0,0 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'약 챙기기',0,1 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'운동하기',0,2 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'장보기',0,3 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'정수기 필터 확인',0,4 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'비타민 구매',0,5 FROM `event_categories` WHERE `name`='건강·생활';
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '연락·행정', '📞', NULL, 4 FROM `users`;
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'집주인 통화',0,0 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'주민센터 방문',0,1 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'택배 반품',0,2 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'전입신고',0,3 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'이사 업체 연락',0,4 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_presets` (`user_id`,`category_id`,`title`,`is_custom`,`sort_order`)
SELECT `user_id`,`id`,'수리 기사 방문',0,5 FROM `event_categories` WHERE `name`='연락·행정';
INSERT IGNORE INTO `event_categories` (`user_id`,`name`,`ico`,`system_key`,`sort_order`)
SELECT `id`, '미분류', '📌', 'UNCATEGORIZED', 5 FROM `users`;

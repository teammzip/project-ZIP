-- 2026-10-21 설계(35개 표)에서 2026-10-31 설계로 변경합니다. 실행 전 백업하세요.
-- 기존 35개 테이블 버전에서 한 번만 실행합니다. DDL은 암묵 커밋되므로 실패 시 자동 재실행하지 마세요.
-- 실행 중 쓰기를 중지하세요. 새 DB에는 schema.sql만 적용합니다.
SET NAMES utf8mb4;
USE `zip`;

CREATE TABLE IF NOT EXISTS `event_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `name` VARCHAR(20) NOT NULL COMMENT '일정 카테고리 이름',
  `ico` VARCHAR(20) NOT NULL DEFAULT '📌' COMMENT '카테고리 그림',
  `system_key` ENUM('UNCATEGORIZED') NULL COMMENT '미분류 식별값 — 이름 변경 및 삭제 불가',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_categories_user_name` (`user_id`, `name`),
  UNIQUE KEY `uk_event_categories_user_system` (`user_id`, `system_key`),
  CONSTRAINT `fk_event_categories_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 일정 카테고리';

CREATE TABLE IF NOT EXISTS `event_presets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '같은 사용자 소유 카테고리 번호',
  `title` VARCHAR(60) NOT NULL COMMENT '빠른 일정 항목 이름',
  `is_custom` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '직접 만든 항목이면 1, 기본 항목이면 0',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '카테고리 안 표시 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_presets_category_title` (`category_id`, `title`),
  CONSTRAINT `fk_event_presets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_presets_category_id` FOREIGN KEY (`category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='카테고리 아래의 기본 및 사용자 일정 항목 버튼';

CREATE TABLE IF NOT EXISTS `memos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `title` VARCHAR(60) NOT NULL DEFAULT '' COMMENT '메모 제목 — 빈 제목 허용',
  `body` TEXT NOT NULL COMMENT '글 메모 내용 — API에서 생략 시 빈 문자열, 최대 5000자',
  `color` ENUM('노랑','분홍','하늘','초록','보라','흰색') NOT NULL DEFAULT '노랑' COMMENT '메모 색',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '목록 상단 고정 여부',
  `is_checklist` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '체크리스트 여부',
  `items` JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '체크 항목 배열 — 각 항목은 text와 done, text 최대 100자',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  KEY `idx_memos_user_pinned_updated` (`user_id`, `is_pinned`, `updated_at`),
  CONSTRAINT `fk_memos_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_memos_items_array` CHECK (JSON_TYPE(`items`) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='글 메모 및 체크리스트';

CREATE TABLE IF NOT EXISTS `banned_identities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NULL COMMENT '대상 회원 — 탈퇴 시 연결만 해제',
  `sanction_id` BIGINT UNSIGNED NULL COMMENT '관련 제재 — 삭제 시 연결만 해제',
  `identity_type` ENUM('LOGIN_ID','NICKNAME','PHONE') NOT NULL COMMENT '재가입 차단 식별값 종류',
  `identity_hash` CHAR(64) NOT NULL COMMENT '정규화한 식별값의 서버 비밀키 기반 HMAC-SHA256 — 원문 저장 금지',
  `hash_key_version` SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'HMAC 키 버전 — 서버에서 키 관리',
  `starts_at` DATETIME NOT NULL COMMENT '차단 시작 일시',
  `expires_at` DATETIME NULL COMMENT '차단 만료 일시 — NULL은 영구',
  `revoked_at` DATETIME NULL COMMENT '차단 해제 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  KEY `idx_banned_identity_lookup` (`identity_type`, `identity_hash`, `hash_key_version`),
  UNIQUE KEY `uk_banned_sanction_identity` (`sanction_id`, `identity_type`),
  CONSTRAINT `fk_banned_identities_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_banned_identities_sanction_id` FOREIGN KEY (`sanction_id`) REFERENCES `user_sanctions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='탈퇴 후에도 유지하는 재가입 차단 식별값';

CREATE TABLE IF NOT EXISTS `support_inquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `category` ENUM('이용 문의','오류 신고','개선 제안','계정 문의','기타') NOT NULL DEFAULT '이용 문의' COMMENT '고객센터 문의 유형',
  `title` VARCHAR(100) NOT NULL COMMENT '문의 제목',
  `content` TEXT NOT NULL COMMENT '문의 내용 — 1~3000자',
  `answer_content` TEXT NULL COMMENT '관리자 답변 — 1~3000자, 문의당 답변 하나',
  `answered_by` BIGINT UNSIGNED NULL COMMENT '답변한 관리자 번호',
  `answered_at` DATETIME NULL COMMENT '답변 일시 — NULL이면 답변 대기',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  KEY `idx_support_user_created` (`user_id`, `created_at`),
  KEY `idx_support_answered_created` (`answered_at`, `created_at`),
  CONSTRAINT `fk_support_inquiries_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_support_answered_by` FOREIGN KEY (`answered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='고객센터 문의와 관리자 단일 답변';

CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '사용자 번호 — 회원당 한 프로필',
  `bio` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '한 줄 소개',
  `avatar_file_id` BIGINT UNSIGNED NULL COMMENT '프로필 사진 파일 번호 — 본인 소유 파일만 허용',
  `avatar_emoji` VARCHAR(20) NULL COMMENT '프로필 캐릭터',
  `avatar_color` VARCHAR(20) NULL COMMENT '프로필 배경 색',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_profiles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_profiles_avatar_file_id` FOREIGN KEY (`avatar_file_id`) REFERENCES `uploaded_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로필 꾸미기 — 인증 응답에 users와 함께 조회';

CREATE TABLE IF NOT EXISTS `place_favorites` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `place_id` BIGINT UNSIGNED NOT NULL COMMENT '저장한 장소 번호',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`user_id`, `place_id`),
  CONSTRAINT `fk_place_favorites_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_place_favorites_place_id` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 지도 즐겨찾기';

ALTER TABLE `users`
  ADD COLUMN `region_verified_at` DATETIME NULL COMMENT '동네 인증 일시 — 30일 유효, 동네 변경 시 NULL로 초기화',
  ADD COLUMN `home_lat` DECIMAL(9,6) NULL COMMENT '집 위치 위도 — 주소를 좌표로 변환한 값',
  ADD COLUMN `home_lon` DECIMAL(9,6) NULL COMMENT '집 위치 경도 — 주소를 좌표로 변환한 값';

ALTER TABLE `user_settings`
  ADD COLUMN `home_memo_ids` JSON NULL COMMENT '홈 메모 ID 문자열 배열 — NULL은 자동, 최대 3개, 배열 순서로 표시',
  ADD COLUMN `map_categories` JSON NULL COMMENT '지도에 표시할 장소 분류 이름 배열 — NULL은 기본 4개',
  ADD COLUMN `map_keywords` JSON NULL COMMENT '지도에서 직접 추가한 검색어 배열 — NULL은 없음';

ALTER TABLE `events`
  ADD COLUMN `category_id` BIGINT UNSIGNED NULL COMMENT '일정 카테고리 번호 — NULL은 미분류',
  ADD COLUMN `is_done` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '할 일 완료 여부',
  ADD COLUMN `done_at` DATETIME NULL COMMENT '완료 일시 — 완료 해제 시 NULL';

ALTER TABLE `events` ADD CONSTRAINT `fk_events_category_id` FOREIGN KEY (`category_id`) REFERENCES `event_categories` (`id`) ON DELETE SET NULL;

ALTER TABLE `bill_items`
  ADD COLUMN `tag` ENUM('공과금','통신','구독','관리비','기타') NOT NULL DEFAULT '공과금' COMMENT '고정 지출 태그';

ALTER TABLE `notifications`
  ADD COLUMN `deleted_at` DATETIME NULL COMMENT '사용자가 삭제한 시각 — 목록과 미확인 수에서 제외';

ALTER TABLE `incomes`
  ADD COLUMN `income_type` ENUM('FIXED','OTHER') NOT NULL DEFAULT 'OTHER' COMMENT '고정 수입 또는 기타 수입 — API incomeType의 fixed/other와 변환';

ALTER TABLE `user_sanctions`
  ADD COLUMN `seen_at` DATETIME NULL COMMENT '사용자가 경고를 확인한 시각',
  ADD COLUMN `revoked_at` DATETIME NULL COMMENT '관리자가 조치를 해제한 시각',
  ADD COLUMN `revoked_by` BIGINT UNSIGNED NULL COMMENT '해제한 관리자 번호',
  ADD COLUMN `revoke_reason` VARCHAR(200) NULL COMMENT '해제 사유';

ALTER TABLE `user_sanctions` ADD CONSTRAINT `fk_user_sanctions_revoked_by` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `place_categories`
  ADD COLUMN `icon` VARCHAR(20) NOT NULL DEFAULT '📍' COMMENT '장소 분류 그림';

ALTER TABLE `ai_messages` MODIFY COLUMN `card_type` ENUM('SPEND_SUMMARY','LINK') NULL COMMENT '지출 요약 또는 앱 내부 이동 링크 카드';

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

-- 기존 수입은 현재 프론트의 분류 판정 규칙으로 옮깁니다.
UPDATE `incomes` i JOIN `ledger_categories` c ON c.id=i.category_id
SET i.income_type=CASE WHEN c.name IN ('월급','이자','연금','임대 수입','기타 고정 수입') THEN 'FIXED' ELSE 'OTHER' END;

-- 날짜 없는 기존 할 일: 원본 생성 날짜를 일정 날짜로 사용합니다. 원본은 보관합니다.
-- 이전한 ID = 이전 직전 events 최대 ID + todos.id (기존 일정 ID와 충돌하지 않음).
SET @zip_todo_offset = (SELECT COALESCE(MAX(id),0) FROM events);
INSERT INTO events (id,user_id,title,event_date,event_time,source,created_at,updated_at,is_done,done_at)
SELECT @zip_todo_offset+id,user_id,content,DATE(created_at),NULL,'USER',created_at,created_at,is_done,done_at FROM todos;
RENAME TABLE todos TO todos_legacy_20261031;

INSERT IGNORE INTO `place_categories` (`name`, `icon`, `sort_order`) VALUES
  ('세탁방', '🧺', 1),
  ('편의점', '🏪', 2),
  ('약국', '💊', 3),
  ('마트', '🛒', 4),
  ('카페', '☕', 5),
  ('병원', '🏥', 6),
  ('헬스장', '🏋️', 7),
  ('은행', '🏦', 8),
  ('미용실', '💇', 9),
  ('다이소', '🧴', 10),
  ('공원', '🌳', 11),
  ('식당', '🍚', 12),
  ('반찬가게', '🥘', 13),
  ('세탁소', '👔', 14),
  ('주민센터', '🏛️', 15);
UPDATE `place_categories` SET `icon` = '🧺' WHERE `name` = '세탁방';
UPDATE `place_categories` SET `icon` = '🏪' WHERE `name` = '편의점';
UPDATE `place_categories` SET `icon` = '💊' WHERE `name` = '약국';
UPDATE `place_categories` SET `icon` = '🛒' WHERE `name` = '마트';
UPDATE `place_categories` SET `icon` = '☕' WHERE `name` = '카페';
UPDATE `place_categories` SET `icon` = '🏥' WHERE `name` = '병원';
UPDATE `place_categories` SET `icon` = '🏋️' WHERE `name` = '헬스장';
UPDATE `place_categories` SET `icon` = '🏦' WHERE `name` = '은행';
UPDATE `place_categories` SET `icon` = '💇' WHERE `name` = '미용실';
UPDATE `place_categories` SET `icon` = '🧴' WHERE `name` = '다이소';
UPDATE `place_categories` SET `icon` = '🌳' WHERE `name` = '공원';
UPDATE `place_categories` SET `icon` = '🍚' WHERE `name` = '식당';
UPDATE `place_categories` SET `icon` = '🥘' WHERE `name` = '반찬가게';
UPDATE `place_categories` SET `icon` = '👔' WHERE `name` = '세탁소';
UPDATE `place_categories` SET `icon` = '🏛️' WHERE `name` = '주민센터';

-- 2026-10-31 추가된 수입 분류 및 AI 사용 방법
INSERT IGNORE INTO `ledger_categories` (`kind`, `name`, `color`, `sort_order`) VALUES
  ('INCOME','이자','#2f80ed',7), ('INCOME','연금','#7c6cf5',8),
  ('INCOME','임대 수입','#f5a623',9), ('INCOME','기타 고정 수입','#8a90a2',10);
INSERT IGNORE INTO `ai_topics` (`code`,`name`,`description`,`photo_supported`,`sort_order`) VALUES
  ('guide','사용 방법','기능이 어디 있는지 알려드려요',0,10);

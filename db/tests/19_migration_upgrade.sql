-- 18_legacy_schema.sql 실행 후 이전 35개 테이블이 있고 사용자 행이 0인 전용 DB에서 한 번 실행.
-- 전체 실행 가능. 중간 오류면 멈추고 상태 확인. 재실행/ROLLBACK으로 DDL을 되돌릴 수 없습니다.
-- 가상 데이터는 검증을 위해 COMMIT하고 최종 DB를 보존합니다.
USE zip_migration_test;
SELECT DATABASE() AS test_database, VERSION() AS mysql_version;
SET @mig_old_safe_updates=@@SESSION.sql_safe_updates;
-- 마이그레이션은 전체 기존 수입 분류 UPDATE를 포함하므로 이 연결에서만 임시 해제.
SET SESSION sql_safe_updates=0;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('이전검증회원');
SET @mig_user=LAST_INSERT_ID();
INSERT INTO user_settings (user_id,rent_amount) VALUES (@mig_user,55);
INSERT INTO events (user_id,title,event_date,event_time) VALUES (@mig_user,'보존할 기존 일정','2026-11-10','18:00:00');
SET @mig_event=LAST_INSERT_ID();
INSERT INTO todos (user_id,content,is_done,created_at) VALUES (@mig_user,'미완료 이전 할 일',0,'2026-11-01 09:00:00');
SET @mig_todo_open=LAST_INSERT_ID();
INSERT INTO todos (user_id,content,is_done,created_at,done_at) VALUES (@mig_user,'완료한 이전 할 일',1,'2026-10-31 09:00:00','2026-10-31 12:00:00');
SET @mig_todo_done=LAST_INSERT_ID();
INSERT INTO incomes (user_id,category_id,amount,income_date)
SELECT @mig_user,id,3000000,'2026-11-01' FROM ledger_categories WHERE kind='INCOME' AND name='월급';
INSERT INTO incomes (user_id,category_id,amount,income_date)
SELECT @mig_user,id,300000,'2026-11-02' FROM ledger_categories WHERE kind='INCOME' AND name='아르바이트';
INSERT INTO expenses (user_id,category_id,amount,expense_date)
SELECT @mig_user,id,20000,'2026-11-02' FROM ledger_categories WHERE kind='EXPENSE' AND name='식비';
INSERT INTO bill_items (user_id,name,default_amount) VALUES (@mig_user,'이전 전기',40000);
SET @mig_bill=LAST_INSERT_ID();
INSERT INTO bill_payments (bill_item_id,period_ym,amount,paid_at) VALUES (@mig_bill,'2026-11',38000,'2026-11-01 12:00:00');
SET @mig_payment=LAST_INSERT_ID();
INSERT INTO rent_payments (user_id,period_ym,amount,paid_at) VALUES (@mig_user,'2026-11',550000,'2026-11-01 12:00:00');
INSERT INTO user_sanctions (user_id,sanction_type,reason,starts_at) VALUES (@mig_user,'BAN','가상 기존 영구 정지','2026-11-01 00:00:00');
SET @mig_sanction=LAST_INSERT_ID();
SET @mig_income_total=(SELECT SUM(amount) FROM incomes WHERE user_id=@mig_user);
SET @mig_spend_total=(SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@mig_user AND period_ym='2026-11');
SELECT 'U00 이전 가상 데이터 준비' AS test,
 IF((SELECT COUNT(*) FROM incomes WHERE user_id=@mig_user)=2
 AND (SELECT COUNT(*) FROM expenses WHERE user_id=@mig_user)=1
 AND (SELECT COUNT(*) FROM todos WHERE user_id=@mig_user)=2
 AND @mig_income_total=3300000 AND @mig_spend_total=608000,'PASS','FAIL') AS result;
COMMIT;

-- BEGIN copied migration: db/migrations/20261031_current_project.sql
-- 2026-10-21 설계(35개 표)에서 2026-10-31 설계로 변경합니다. 실행 전 백업하세요.
-- 기존 35개 테이블 버전에서 한 번만 실행합니다. DDL은 암묵 커밋되므로 실패 시 자동 재실행하지 마세요.
-- 실행 중 쓰기를 중지하세요. 새 DB에는 schema.sql만 적용합니다.
SET NAMES utf8mb4;
USE `zip_migration_test`;

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

-- END copied migration

-- BEGIN copied migration: db/migrations/20261031_02_event_anniversaries.sql
-- 기념일 기능 추가: 20261031_current_project.sql 적용 이후 한 번만 실행합니다.
-- 최신 schema.sql로 생성한 새 DB에는 실행하지 않습니다.
-- 실행 전 백업 및 쓰기 중단. DDL은 암묵 커밋되므로 실패 시 현재 상태를 확인하세요.
SET NAMES utf8mb4;
USE `zip_migration_test`;

ALTER TABLE `events`
  ADD COLUMN `is_anniversary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '기념일 여부 — API anniv, 할 일 완료 및 남은 일 집계에서 제외',
  ADD COLUMN `repeat_yearly` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '매년 반복 여부 — API yearly, 기념일 원본 한 행만 저장',
  ADD CONSTRAINT `ck_events_anniversary_flags` CHECK (`is_anniversary` IN (0,1) AND `repeat_yearly` IN (0,1) AND (`repeat_yearly` = 0 OR `is_anniversary` = 1));

-- 기존 일정은 두 값이 0으로 유지됩니다. 제목/이모지로 기념일을 추측하여 변환하지 않습니다.
-- 브라우저 데이터 이전 시 anniv/yearly를 명시적으로 매핑해야 합니다.

-- END copied migration

-- BEGIN copied migration: db/migrations/20261101_housing_and_loan.sql
-- 최신 기념일 컬럼까지 적용한 41개 테이블 DB 대상, 백업 및 쓰기 중단 후 한 번만 실행.
-- 새 DB에는 최신 schema.sql만 사용. DDL은 암묵 커밋되므로 실패 시 무조건 재실행하지 마세요.
SET NAMES utf8mb4;
USE `zip_migration_test`;

CREATE TABLE IF NOT EXISTS `housing_surveys` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `birth_date` DATE NOT NULL COMMENT '생년월일 — 나이는 조회 시 계산',
  `address` VARCHAR(200) NOT NULL COMMENT '응답 당시 간략한 주소',
  `contract_kind` ENUM('MONTHLY','JEONSE') NOT NULL,
  `deposit` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 보증금 — 원',
  `rent` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 — 원',
  `management_included` TINYINT(1) NOT NULL DEFAULT 0,
  `management_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '별도 관리비 — 원',
  `contract_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '전세 계약금 — 원, 보증금으로 임의 재해석하지 않음',
  `has_loan` TINYINT(1) NOT NULL DEFAULT 0,
  `loan_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '응답 당시 대출 금액 — 원',
  `loan_annual_rate` DECIMAL(5,2) NULL,
  `loan_payment_day` TINYINT UNSIGNED NULL,
  `loan_start_date` DATE NULL,
  `income` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선택한 기간의 수입 — 원, 가계부 실적과 별개',
  `income_period` ENUM('MONTHLY','ANNUAL') NOT NULL,
  `answered_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_housing_surveys_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_survey_flags` CHECK (`management_included` IN (0,1) AND `has_loan` IN (0,1)),
  CONSTRAINT `ck_survey_loan_rate` CHECK (`loan_annual_rate` BETWEEN 0 AND 100),
  CONSTRAINT `ck_survey_loan_day` CHECK (`loan_payment_day` BETWEEN 1 AND 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원별 최신 주거 설문 — 실제 개인정보를 seed로 넣지 않음';

CREATE TABLE IF NOT EXISTS `housing_loans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID — 프론트 loanId',
  `user_id` BIGINT UNSIGNED NOT NULL,
  `principal` BIGINT UNSIGNED NOT NULL COMMENT '원금 — 원',
  `annual_rate` DECIMAL(5,2) NOT NULL COMMENT '연 이율 — 퍼센트',
  `payment_day` TINYINT UNSIGNED NOT NULL,
  `start_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_housing_loans_user` (`user_id`),
  CONSTRAINT `fk_housing_loans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_housing_loan_terms` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `payment_day` BETWEEN 1 AND 31 AND `is_active` IN (0,1) AND `start_date` BETWEEN '2000-01-01' AND '2100-12-31')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원당 전세 대출 설정 하나 — 중지 후에도 같은 ID 재사용';

CREATE TABLE IF NOT EXISTS `loan_interest_charges` (
  `loan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `charge_date` DATE NOT NULL COMMENT '한국 날짜 기준 납부일 — 실제 출금 증빙 아님',
  `period_ym` INT GENERATED ALWAYS AS (EXTRACT(YEAR_MONTH FROM `charge_date`)) STORED COMMENT 'YYYYMM — 날짜에서 생성하여 월 불일치 방지',
  `principal` BIGINT UNSIGNED NOT NULL COMMENT '기록 당시 원금 스냅샷',
  `annual_rate` DECIMAL(5,2) NOT NULL COMMENT '기록 당시 금리 스냅샷',
  `amount` BIGINT UNSIGNED NOT NULL COMMENT '기록 당시 월 예상 이자 — 원',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`loan_id`, `charge_date`),
  UNIQUE KEY `uk_loan_interest_month` (`loan_id`, `period_ym`),
  CONSTRAINT `fk_loan_interest_loan` FOREIGN KEY (`loan_id`) REFERENCES `housing_loans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_loan_interest_snapshot` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `amount` = ROUND(`principal` * `annual_rate` / 1200, 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월별 이자 자동 기록 — 설정 변경 후에도 과거 스냅샷 보존';

ALTER TABLE `bill_items` MODIFY COLUMN `default_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '평소 금액 — 원 단위';
ALTER TABLE `bill_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 금액 — 원 단위';
ALTER TABLE `rent_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 월세 — 원 단위 (설정의 월세 × 10000)';
ALTER TABLE `incomes` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '수입 금액 — 원 단위';
ALTER TABLE `expenses` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '지출 금액 — 원 단위';
ALTER TABLE `user_settings` MODIFY COLUMN `rent_amount` DECIMAL(14,4) UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 금액 — 만원 단위 (55 = 55만원)';

CREATE OR REPLACE VIEW `v_monthly_spend_breakdown` AS
SELECT r.user_id, r.period_ym, '월세' AS label, r.amount AS amount
FROM rent_payments r
UNION ALL
SELECT b.user_id, p.period_ym, '공과금' AS label, SUM(p.amount) AS amount
FROM bill_payments p JOIN bill_items b ON b.id = p.bill_item_id
GROUP BY b.user_id, p.period_ym
UNION ALL
SELECT e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS period_ym, c.name AS label, SUM(e.amount) AS amount
FROM expenses e JOIN ledger_categories c ON c.id = e.category_id
GROUP BY e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m'), c.name
UNION ALL
SELECT l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m') AS period_ym, '전세 대출 이자' AS label, SUM(c.amount) AS amount
FROM loan_interest_charges c JOIN housing_loans l ON l.id = c.loan_id
GROUP BY l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m');

-- END copied migration

-- BEGIN copied migration: db/migrations/20261102_requirements_hardening.sql
-- 최신 44개 테이블 DB 대상, 한 번만 적용. 새 DB에는 최신 schema.sql만 사용.
-- 실행 전 migrations/README.md의 사전 검사·백업·쓰기 중단을 수행합니다.
-- 기존 중복/범위 위반 데이터를 자동 삭제·수정하지 않습니다. 오류가 나면 즉시 멈추세요.
-- DDL은 암묵 커밋. 실패 후 전체 파일을 무조건 재실행하지 마세요.
SET NAMES utf8mb4;
USE `zip_migration_test`;

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

-- END copied migration

-- 이전 데이터 보존 검증. 위 fixture와 같은 연결에서 연속 실행합니다.
SELECT 'U01 44개 현행 표와 보관 표 하나' AS test,
 IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE')=45
 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='todos')=0
 AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='todos_legacy_20261031')=1,'PASS','FAIL') AS result;
SELECT 'U02 기존 일정 원본 보존' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM events WHERE id=@mig_event AND user_id=@mig_user
 AND title='보존할 기존 일정' AND event_date='2026-11-10' AND event_time='18:00:00' AND source='USER';
SELECT 'U03 원본 할 일 보관 및 이전 ID 대응' AS test,
 IF((SELECT COUNT(*) FROM todos_legacy_20261031 WHERE user_id=@mig_user)=2
 AND @zip_todo_offset=@mig_event
 AND (SELECT COUNT(*) FROM todos_legacy_20261031 t JOIN events e ON e.id=@zip_todo_offset+t.id
 WHERE t.user_id=@mig_user AND e.user_id=t.user_id AND e.title=t.content
 AND e.event_date=DATE(t.created_at) AND e.created_at=t.created_at
 AND e.is_done=t.is_done AND (e.done_at <=> t.done_at))=2,'PASS','FAIL') AS result;
SELECT 'U04 완료·미완료 값 보존' AS test,
 IF((SELECT COUNT(*) FROM events WHERE id=@zip_todo_offset+@mig_todo_open AND is_done=0 AND done_at IS NULL)=1
 AND (SELECT COUNT(*) FROM events WHERE id=@zip_todo_offset+@mig_todo_done AND is_done=1 AND done_at='2026-10-31 12:00:00')=1,'PASS','FAIL') AS result;
SELECT 'U05 수입 금액·분류 이관' AS test,
 IF((SELECT SUM(amount) FROM incomes WHERE user_id=@mig_user)=@mig_income_total
 AND (SELECT SUM(amount) FROM incomes WHERE user_id=@mig_user AND income_type='FIXED')=3000000
 AND (SELECT SUM(amount) FROM incomes WHERE user_id=@mig_user AND income_type='OTHER')=300000,'PASS','FAIL') AS result;
SELECT 'U06 월별 VIEW 합계 보존' AS test,
 IF((SELECT total_amount FROM v_monthly_income WHERE user_id=@mig_user AND period_ym='2026-11')=3300000
 AND (SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@mig_user AND period_ym='2026-11')=@mig_spend_total
 AND @mig_spend_total=608000,'PASS','FAIL') AS result;
SELECT 'U07 설정 단위·새 JSON 기본값' AS test,
 IF(COUNT(*)=1,'PASS','FAIL') AS result FROM user_settings WHERE user_id=@mig_user AND rent_amount=55
 AND home_memo_ids IS NULL AND map_categories IS NULL AND map_keywords IS NULL;
SELECT 'U08 고정 지출·월세 납부 이력 보존' AS test,
 IF((SELECT COUNT(*) FROM bill_items WHERE id=@mig_bill AND default_amount=40000 AND tag='공과금')=1
 AND (SELECT COUNT(*) FROM bill_payments WHERE id=@mig_payment AND amount=38000 AND paid_at='2026-11-01 12:00:00')=1
 AND (SELECT COUNT(*) FROM rent_payments WHERE user_id=@mig_user AND amount=550000 AND paid_at='2026-11-01 12:00:00')=1,'PASS','FAIL') AS result;
SELECT 'U09 기존 회원의 카테고리·기본 항목 생성' AS test,
 IF((SELECT COUNT(*) FROM event_categories WHERE user_id=@mig_user)=6
 AND (SELECT COUNT(*) FROM event_categories WHERE user_id=@mig_user AND system_key='UNCATEGORIZED')=1
 AND (SELECT COUNT(*) FROM event_presets WHERE user_id=@mig_user AND is_custom=0)=30,'PASS','FAIL') AS result;
SELECT 'U10 기존 일정에 기념일 임의 추정 없음' AS test,
 IF((SELECT COUNT(*) FROM events WHERE user_id=@mig_user)=3
 AND (SELECT COUNT(*) FROM events WHERE user_id=@mig_user AND is_anniversary=0 AND repeat_yearly=0)=3,'PASS','FAIL') AS result;
SELECT 'U11 새 설문·대출·이자 임의 생성 없음' AS test,
 IF((SELECT COUNT(*) FROM housing_surveys)=0 AND (SELECT COUNT(*) FROM housing_loans)=0
 AND (SELECT COUNT(*) FROM loan_interest_charges)=0,'PASS','FAIL') AS result;
SELECT 'U12 기존 제재 보존·차단 해시 별도 이관 필요' AS test,
 IF((SELECT COUNT(*) FROM user_sanctions WHERE id=@mig_sanction AND user_id=@mig_user AND sanction_type='BAN' AND revoked_at IS NULL)=1
 AND (SELECT COUNT(*) FROM banned_identities)=0,'PASS','FAIL') AS result;
-- U12 PASS는 해시 이관 누락이 없다는 뜻이 아닙니다. 이 SQL은 키를 모르므로 생성하지 않습니다.
SELECT 'U13 확장 금액 타입 확인' AS test,
 IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(COLUMN_TYPE)='bigint unsigned'
 AND ((TABLE_NAME='bill_items' AND COLUMN_NAME='default_amount') OR
 (TABLE_NAME IN ('bill_payments','rent_payments','incomes','expenses') AND COLUMN_NAME='amount')))=5
 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='user_settings' AND COLUMN_NAME='rent_amount' AND LOWER(COLUMN_TYPE)='decimal(14,4) unsigned')=1,'PASS','FAIL') AS result;
SET SESSION sql_safe_updates=@mig_old_safe_updates;
SELECT DATABASE() AS preserved_test_database,@@SESSION.sql_safe_updates AS restored_safe_update_mode;

-- 최신 생활 분류 설정 확장
-- 20261102_requirements_hardening.sql까지 적용된 DB에 한 번만 실행.
-- 백업 후 쓰기 중단. DDL은 암묵 커밋되므로 실패 시 실제 구조부터 확인.
USE `zip_migration_test`;

ALTER TABLE `user_settings`
  ADD COLUMN `home_address` VARCHAR(200) NULL COMMENT '현재 실제 거주 상세주소 — 동네 표시명 및 가입 주소와 구분',
  ADD COLUMN `ledger_category_settings` JSON NULL COMMENT '회원별 scope의 custom 카테고리와 order 배열 — NULL은 기본 목록',
  ADD CONSTRAINT `ck_settings_ledger_object` CHECK (`ledger_category_settings` IS NULL OR JSON_TYPE(`ledger_category_settings`) = 'OBJECT');

ALTER TABLE `bill_items`
  MODIFY COLUMN `tag` VARCHAR(24) NOT NULL DEFAULT '공과금' COMMENT '회원별 고정 지출 카테고리 이름';

ALTER TABLE `ledger_categories`
  MODIFY COLUMN `name` VARCHAR(24) NOT NULL COMMENT '분류 이름 — 회원별 표시 목록은 설정 JSON에서 관리',
  MODIFY COLUMN `color` VARCHAR(32) NOT NULL COMMENT '기본 표시 색 — 회원별 색은 설정 JSON 우선';

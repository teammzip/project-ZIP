-- 2026-11-15 저장 리스트 (내가 만든 장소 묶음: "내 장소" · "맛집" · "제주" …)
-- ★ 저장 창에서 리스트를 골라 저장합니다. 한 장소를 여러 리스트에 넣을 수 있고, 어느 리스트에도 없으면 저장이 풀립니다.
-- place_key 는 DB 장소면 places.id 문자열("12"), 카카오 장소면 "kakao:카카오장소id" (카카오 장소 이름 · 종류는 kakao_place_favorites 에).
-- 20261115_02_email_verification.sql 다음에 한 번 실행합니다 (kakao_place_favorites 까지 적용된 DB 면 순서 상관없음). 새 DB 는 최신 schema.sql 만 실행합니다. 다시 실행해도 안전합니다.
USE `zip`;

CREATE TABLE IF NOT EXISTS `place_lists` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '리스트 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '리스트 주인',
  `name` VARCHAR(20) NOT NULL COMMENT '리스트 이름 — 회원 안에서 중복 불가',
  `color` CHAR(7) NOT NULL COMMENT '리스트 색 (#RRGGBB)',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '표시 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '만든 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_place_lists_user_name` (`user_id`, `name`),
  CONSTRAINT `fk_place_lists_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_place_lists_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
  CONSTRAINT `chk_place_lists_color` CHECK (`color` REGEXP '^#[0-9a-fA-F]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='저장 리스트: 회원이 만든 장소 묶음';

CREATE TABLE IF NOT EXISTS `place_list_items` (
  `list_id` BIGINT UNSIGNED NOT NULL COMMENT '리스트 아이디',
  `place_key` VARCHAR(60) NOT NULL COMMENT '장소 — DB 장소 번호 또는 "kakao:카카오장소id"',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '넣은 일시',
  PRIMARY KEY (`list_id`, `place_key`),
  CONSTRAINT `fk_place_list_items_list_id` FOREIGN KEY (`list_id`) REFERENCES `place_lists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_place_list_items_key` CHECK (`place_key` REGEXP '^([1-9][0-9]{0,18}|kakao:[0-9]{1,50})$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='저장 리스트에 넣은 장소';

-- 2026-11-15 카카오 검색 장소 즐겨찾기
-- 카카오 장소는 places 에 저장하지 않으므로(카카오 운영 정책: 장소명 · 주소 · 좌표 장기 저장 제한) 즐겨찾기를 따로 둡니다.
-- 저장하는 것: 회원 번호, 카카오 장소 id, 저장 목록에 보일 이름, 우리 종류 이름. 주소 · 좌표 · 전화번호는 저장하지 않습니다.
-- 20261108 까지 적용된 DB 에 한 번 실행합니다. 새 DB 는 최신 schema.sql 만 실행합니다. 다시 실행해도 안전합니다.
USE `zip`;

CREATE TABLE IF NOT EXISTS `kakao_place_favorites` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `kakao_place_id` VARCHAR(50) NOT NULL COMMENT '카카오 장소 id (숫자 문자열)',
  `name` VARCHAR(60) NOT NULL COMMENT '저장 목록에 보일 장소 이름',
  `category` VARCHAR(20) NOT NULL COMMENT '우리 장소 종류 이름 (place_categories.name, 아이콘 표시용)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`user_id`, `kakao_place_id`),
  CONSTRAINT `fk_kakao_place_favorites_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_kakao_place_favorites_id` CHECK (`kakao_place_id` REGEXP '^[0-9]{1,50}$'),
  CONSTRAINT `chk_kakao_place_favorites_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='카카오 검색 장소 즐겨찾기 (id · 이름만, 주소 · 좌표 없음)';

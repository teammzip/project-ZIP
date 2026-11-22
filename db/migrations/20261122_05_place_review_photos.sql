-- 적용할 DB를 선택한 후 실행. 장소 리뷰에 사진(리뷰당 5장까지)을 붙이는 표를 만든다. 20261122_03_place_reviews.sql 다음에 실행.
-- 기존 데이터는 바꾸지 않는다. 이미 있으면 건너뛰어 다시 실행해도 된다.
CREATE TABLE IF NOT EXISTS `place_review_photos` (
  `review_kind` ENUM('PLACE','KAKAO') NOT NULL COMMENT '리뷰 표 — PLACE: place_reviews / KAKAO: kakao_place_reviews',
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '리뷰 아이디 (review_kind 표의 id)',
  `file_id` BIGINT UNSIGNED NOT NULL COMMENT '사진 파일 (uploaded_files) — 리뷰 쓴 사람이 올린 사진만',
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '보여 줄 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '붙인 일시',
  PRIMARY KEY (`review_kind`, `review_id`, `file_id`),
  UNIQUE KEY `uk_place_review_photos_file_id` (`file_id`),
  CONSTRAINT `fk_place_review_photos_file_id` FOREIGN KEY (`file_id`) REFERENCES `uploaded_files` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='장소 리뷰 사진: 리뷰 하나에 사진 5장까지. 리뷰를 지우면 서버가 사진 연결과 파일도 지웁니다.';

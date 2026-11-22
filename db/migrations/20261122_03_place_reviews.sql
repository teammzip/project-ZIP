-- 적용할 DB를 선택한 후 실행. 장소 리뷰 기능 표 두 개를 만든다.
--   · kakao_place_reviews: 카카오 검색 장소에도 우리 회원이 리뷰(별점 1~5 · 한 줄 리뷰)를 남김
--   · place_review_reports: 장소 리뷰 신고 (운영자가 확인해 리뷰를 지우거나 기각)
-- 카카오 장소는 places 에 저장하지 않으므로(카카오 운영 정책: 장소 정보 장기 저장 제한) 카카오 장소 id · 이름과 회원이 쓴 리뷰만 저장한다. 주소 · 좌표는 저장하지 않는다.
-- 기존 데이터는 바꾸지 않는다. 이미 있으면 건너뛰어 다시 실행해도 된다.
CREATE TABLE IF NOT EXISTS `kakao_place_reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '리뷰 아이디 — 자동 증가',
  `kakao_place_id` VARCHAR(50) NOT NULL COMMENT '카카오 장소 id (숫자 문자열)',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '리뷰 쓴 사용자 아이디',
  `name` VARCHAR(60) NOT NULL COMMENT '리뷰 쓸 때의 장소 이름 (표시 · 운영 확인용)',
  `rating` TINYINT UNSIGNED NOT NULL COMMENT '별점 — 1~5',
  `body` VARCHAR(300) NULL COMMENT '리뷰 내용',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_kakao_place_reviews_place_user` (`kakao_place_id`, `user_id`),
  KEY `idx_kakao_place_reviews_user_id` (`user_id`),
  CONSTRAINT `fk_kakao_place_reviews_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_kakao_place_reviews_id` CHECK (`kakao_place_id` REGEXP '^[0-9]{1,50}$'),
  CONSTRAINT `chk_kakao_place_reviews_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
  CONSTRAINT `chk_kakao_place_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='카카오 검색 장소 리뷰 (우리 회원이 쓴 별점 · 한 줄 리뷰. 장소는 id · 이름만, 주소 · 좌표 없음)';

CREATE TABLE IF NOT EXISTS `place_review_reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '신고 아이디 — 자동 증가',
  `reporter_id` BIGINT UNSIGNED NOT NULL COMMENT '신고한 사용자 아이디',
  `review_kind` ENUM('PLACE','KAKAO') NOT NULL COMMENT '리뷰 표 — PLACE: place_reviews / KAKAO: kakao_place_reviews',
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '신고한 리뷰 아이디 (review_kind 표의 id)',
  `place_key` VARCHAR(60) NOT NULL COMMENT '장소 — DB 장소 번호 또는 "kakao:카카오장소id"',
  `place_name_snapshot` VARCHAR(60) NOT NULL COMMENT '신고 당시 장소 이름',
  `reason` ENUM('ABUSE','FALSE_INFO','PRIVACY','AD_ILLEGAL','COPYRIGHT','OTHER') NOT NULL COMMENT '신고 사유 — 커뮤니티 신고(reports.reason)와 같음',
  `detail` VARCHAR(200) NULL COMMENT '자세한 내용',
  `status` ENUM('RECEIVED','HIDDEN','DISMISSED') NOT NULL DEFAULT 'RECEIVED' COMMENT '처리 상태 — 접수 / 리뷰 삭제 / 기각',
  `target_author_snapshot` VARCHAR(12) NULL COMMENT '신고 당시 리뷰 작성자 닉네임 — 삭제 후 표시용',
  `target_text_snapshot` VARCHAR(300) NULL COMMENT '신고 당시 리뷰 내용 — 서버가 실제 리뷰에서 복사',
  `target_rating_snapshot` TINYINT UNSIGNED NULL COMMENT '신고 당시 별점',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '신고 일시',
  `handled_by` BIGINT UNSIGNED NULL COMMENT '처리한 운영자 아이디',
  `handled_at` DATETIME NULL COMMENT '처리 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_place_review_reports_reporter_target` (`reporter_id`, `review_kind`, `review_id`),
  KEY `idx_place_review_reports_target` (`review_kind`, `review_id`),
  KEY `idx_place_review_reports_status_created` (`status`, `created_at`, `id`),
  CONSTRAINT `fk_place_review_reports_reporter_id` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_place_review_reports_handled_by` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_place_review_reports_place_key` CHECK (`place_key` REGEXP '^([1-9][0-9]{0,18}|kakao:[0-9]{1,50})$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='장소 리뷰 신고: 운영 정책에 어긋나는 장소 리뷰를 신고한 기록. 운영자가 확인해 리뷰를 지우거나 기각합니다.';

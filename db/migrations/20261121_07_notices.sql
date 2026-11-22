-- 적용할 DB를 선택한 후 실행. 관리자 공지사항 표를 만든다. 기존 데이터는 바꾸지 않는다. 이미 있으면 건너뛴다.
CREATE TABLE IF NOT EXISTS `notices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `title` VARCHAR(100) NOT NULL COMMENT '공지 제목 — 1~100자',
  `body` TEXT NOT NULL COMMENT '공지 내용 — 1~5000자',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '목록 맨 위 고정',
  `is_popup` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '앱을 열면 팝업으로 보여 줌',
  `created_by` BIGINT UNSIGNED NULL COMMENT '쓴 관리자 번호',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  KEY `idx_notices_pinned_created` (`is_pinned`, `created_at`, `id`),
  CONSTRAINT `fk_notices_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_notices_title` CHECK (CHAR_LENGTH(TRIM(`title`)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='관리자 공지사항';

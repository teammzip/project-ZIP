-- 2026-11-15 커뮤니티 운영
-- 1) 글 · 댓글 삭제 기록: 누가 지웠는지(deleted_by) · 운영자가 지운 사유(delete_reason)
--    작성자 본인이 지우면 deleted_by = 본인, 사유는 비움. 운영자가 지우면 deleted_by = 운영자, 사유는 관리자 화면에서 받은 값.
-- 2) 목록 속도 키: 전체 동네 글 목록(보이는 글, 새 글부터) · 관리자 신고 목록(새 신고부터)
-- 20261115_kakao_place_favorites.sql 까지 적용된 DB 에 한 번 실행합니다. 새 DB 는 최신 schema.sql 만 실행합니다.
-- 이미 적용했으면 다시 실행하지 않습니다 (ALTER 는 다시 실행하면 실패). 기존 데이터는 그대로이고 새 칸은 비어 있어요.
USE `zip`;

-- 사전 확인: 셋 다 0 이어야 합니다 (이미 적용됐으면 2 · 2 · 2)
SELECT COUNT(*) AS posts_columns_already FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME IN ('deleted_by', 'delete_reason');
SELECT COUNT(*) AS comments_columns_already FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME IN ('deleted_by', 'delete_reason');
SELECT COUNT(DISTINCT INDEX_NAME) AS keys_already FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME IN ('idx_posts_status_created_at', 'idx_reports_created_at');

ALTER TABLE `posts`
  ADD COLUMN `deleted_by` BIGINT UNSIGNED NULL COMMENT '지운 사람 — 작성자 본인 또는 운영자 (20261115_04)' AFTER `deleted_at`,
  ADD COLUMN `delete_reason` VARCHAR(200) NULL COMMENT '운영자가 지운 사유 — 작성자 본인 삭제는 비움' AFTER `deleted_by`,
  ADD CONSTRAINT `fk_posts_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD KEY `idx_posts_status_created_at` (`status`, `created_at`, `id`);

ALTER TABLE `comments`
  ADD COLUMN `deleted_by` BIGINT UNSIGNED NULL COMMENT '지운 사람 — 작성자 본인 또는 운영자 (20261115_04)' AFTER `deleted_at`,
  ADD COLUMN `delete_reason` VARCHAR(200) NULL COMMENT '운영자가 지운 사유 — 작성자 본인 삭제는 비움' AFTER `deleted_by`,
  ADD CONSTRAINT `fk_comments_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `reports`
  ADD KEY `idx_reports_created_at` (`created_at`, `id`);

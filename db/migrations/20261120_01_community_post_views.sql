-- 적용할 DB를 선택한 후 실행. 기존 게시글의 조회 수는 0부터 집계한다.
SET @post_views_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'posts' AND column_name = 'view_count'),
  'SELECT 1',
  'ALTER TABLE posts ADD COLUMN `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''조회 수'' AFTER like_count'
);
PREPARE post_views_stmt FROM @post_views_ddl;
EXECUTE post_views_stmt;
DEALLOCATE PREPARE post_views_stmt;

SET @post_views_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'posts' AND index_name = 'idx_posts_region_status_views'),
  'SELECT 1',
  'ALTER TABLE posts ADD KEY `idx_posts_region_status_views` (`region_id`, `status`, `view_count`, `created_at`, `id`)'
);
PREPARE post_views_stmt FROM @post_views_ddl;
EXECUTE post_views_stmt;
DEALLOCATE PREPARE post_views_stmt;

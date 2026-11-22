-- 적용할 DB를 선택한 후 실행. 홈 꿀팁 · 동네 글 목록 · 관리자 회원 목록을 빠르게 하는 인덱스 4개. 데이터는 바꾸지 않는다. 이미 있으면 건너뛴다.

-- 홈 꿀팁: 꿀팁으로 지정한 보이는 글을 새 글부터
SET @post_list_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'posts' AND index_name = 'idx_posts_home_tip'),
  'SELECT 1',
  'ALTER TABLE posts ADD KEY `idx_posts_home_tip` (`is_home_tip`, `status`, `created_at`, `id`)'
);
PREPARE post_list_stmt FROM @post_list_ddl;
EXECUTE post_list_stmt;
DEALLOCATE PREPARE post_list_stmt;

-- 동네 글 목록: 동네별 보이는 글을 새 글부터
SET @post_list_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'posts' AND index_name = 'idx_posts_region_status_created'),
  'SELECT 1',
  'ALTER TABLE posts ADD KEY `idx_posts_region_status_created` (`region_id`, `status`, `created_at`, `id`)'
);
PREPARE post_list_stmt FROM @post_list_ddl;
EXECUTE post_list_stmt;
DEALLOCATE PREPARE post_list_stmt;

-- 관리자 회원 목록: 회원별 보이는 글 수
SET @post_list_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'posts' AND index_name = 'idx_posts_user_status'),
  'SELECT 1',
  'ALTER TABLE posts ADD KEY `idx_posts_user_status` (`user_id`, `status`)'
);
PREPARE post_list_stmt FROM @post_list_ddl;
EXECUTE post_list_stmt;
DEALLOCATE PREPARE post_list_stmt;

-- 관리자 회원 목록: 회원별 보이는 댓글 수
SET @post_list_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'comments' AND index_name = 'idx_comments_user_status'),
  'SELECT 1',
  'ALTER TABLE comments ADD KEY `idx_comments_user_status` (`user_id`, `status`)'
);
PREPARE post_list_stmt FROM @post_list_ddl;
EXECUTE post_list_stmt;
DEALLOCATE PREPARE post_list_stmt;

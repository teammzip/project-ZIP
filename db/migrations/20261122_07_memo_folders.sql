-- 메모 폴더. 기존 메모는 미분류 유지, 폴더를 지워도 메모는 보존합니다.
CREATE TABLE IF NOT EXISTS `memo_folders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_memo_folders_user_name` (`user_id`, `name`),
  CONSTRAINT `fk_memo_folders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 메모 분류 폴더';

SET @memo_folder_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='memos' AND column_name='folder_id'),
  'SELECT 1',
  'ALTER TABLE memos ADD COLUMN `folder_id` BIGINT UNSIGNED NULL COMMENT ''분류 폴더, NULL은 미분류'' AFTER `ledger_label`'
);
PREPARE memo_folder_stmt FROM @memo_folder_ddl;
EXECUTE memo_folder_stmt;
DEALLOCATE PREPARE memo_folder_stmt;

SET @memo_folder_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name='memos' AND constraint_name='fk_memos_folder'),
  'SELECT 1',
  'ALTER TABLE memos ADD CONSTRAINT `fk_memos_folder` FOREIGN KEY (`folder_id`) REFERENCES `memo_folders` (`id`) ON DELETE SET NULL'
);
PREPARE memo_folder_stmt FROM @memo_folder_ddl;
EXECUTE memo_folder_stmt;
DEALLOCATE PREPARE memo_folder_stmt;

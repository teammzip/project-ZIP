CREATE TABLE IF NOT EXISTS `bill_photo_drafts` (
  `id` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `period_ym` CHAR(7) NOT NULL,
  `time_zone` VARCHAR(64) NOT NULL,
  `photo_hash` CHAR(64) NOT NULL,
  `document_hash` CHAR(64) NULL,
  `input_json` TEXT NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `state` VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  CONSTRAINT `bill_photo_drafts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bill_photo_drafts_ibfk_2` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE,
  KEY `ix_bill_photo_drafts_owner` (`user_id`, `conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

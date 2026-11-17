-- Apply once before starting the updated backend. Existing amounts and payment states are preserved.
ALTER TABLE `bill_payments` ADD COLUMN `due_date` DATE NULL COMMENT '월별 납부 기한';
CREATE TABLE IF NOT EXISTS `bill_photo_imports` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `image_hash` CHAR(64) NOT NULL,
  `bill_item_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `image_hash`),
  CONSTRAINT `fk_bill_photo_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bill_photo_item` FOREIGN KEY (`bill_item_id`) REFERENCES `bill_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

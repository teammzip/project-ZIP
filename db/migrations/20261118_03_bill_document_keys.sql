CREATE TABLE IF NOT EXISTS `bill_document_keys` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `document_hash` CHAR(64) NOT NULL,
  `bill_item_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `document_hash`),
  CONSTRAINT `fk_bill_document_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bill_document_item` FOREIGN KEY (`bill_item_id`) REFERENCES `bill_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

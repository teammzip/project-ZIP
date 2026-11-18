-- 현재 연결된 DB에서 실행. 기존 설문과 개인 정보는 변경하지 않는다.
CREATE TABLE IF NOT EXISTS `home_contracts` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `contract_kind` VARCHAR(10) NOT NULL,
  `deposit` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `management_included` TINYINT(1) NOT NULL DEFAULT 0,
  `management_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `contract_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `management_bill_id` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_home_contract_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_home_contract_bill` FOREIGN KEY (`management_bill_id`) REFERENCES `bill_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_home_contract_kind` CHECK (contract_kind IN ('monthly','jeonse'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

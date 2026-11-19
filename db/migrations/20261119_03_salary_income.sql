-- 적용할 DB를 먼저 선택한다. 기존 수동 수입 기록은 변경하지 않는다.
CREATE TABLE IF NOT EXISTS `salary_settings` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `amount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `income_period` ENUM('monthly','annual') NOT NULL DEFAULT 'monthly',
  `payment_day` TINYINT UNSIGNED NOT NULL DEFAULT 25,
  `start_month` CHAR(7) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_salary_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_salary_settings_amount` CHECK ((`income_period` = 'monthly' AND `amount` <= 999999999) OR (`income_period` = 'annual' AND `amount` <= 11999999988)),
  CONSTRAINT `chk_salary_settings_day` CHECK (`payment_day` BETWEEN 1 AND 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월급 자동 등록 설정: 월 금액과 수령일';

CREATE TABLE IF NOT EXISTS `salary_records` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `period_ym` CHAR(7) NOT NULL,
  `income_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `period_ym`),
  UNIQUE KEY `uk_salary_records_income` (`income_id`),
  CONSTRAINT `fk_salary_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salary_records_income` FOREIGN KEY (`income_id`) REFERENCES `incomes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 월급 월 1건 중복 방지 및 수입 원본 연결';

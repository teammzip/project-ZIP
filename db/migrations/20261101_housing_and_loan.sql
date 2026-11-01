-- 최신 기념일 컬럼까지 적용한 41개 테이블 DB 대상, 백업 및 쓰기 중단 후 한 번만 실행.
-- 새 DB에는 최신 schema.sql만 사용. DDL은 암묵 커밋되므로 실패 시 무조건 재실행하지 마세요.
SET NAMES utf8mb4;
USE `zip`;

CREATE TABLE IF NOT EXISTS `housing_surveys` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `birth_date` DATE NOT NULL COMMENT '생년월일 — 나이는 조회 시 계산',
  `address` VARCHAR(200) NOT NULL COMMENT '응답 당시 간략한 주소',
  `contract_kind` ENUM('MONTHLY','JEONSE') NOT NULL,
  `deposit` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 보증금 — 원',
  `rent` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 — 원',
  `management_included` TINYINT(1) NOT NULL DEFAULT 0,
  `management_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '별도 관리비 — 원',
  `contract_fee` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '전세 계약금 — 원, 보증금으로 임의 재해석하지 않음',
  `has_loan` TINYINT(1) NOT NULL DEFAULT 0,
  `loan_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '응답 당시 대출 금액 — 원',
  `loan_annual_rate` DECIMAL(5,2) NULL,
  `loan_payment_day` TINYINT UNSIGNED NULL,
  `loan_start_date` DATE NULL,
  `income` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선택한 기간의 수입 — 원, 가계부 실적과 별개',
  `income_period` ENUM('MONTHLY','ANNUAL') NOT NULL,
  `answered_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_housing_surveys_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_survey_flags` CHECK (`management_included` IN (0,1) AND `has_loan` IN (0,1)),
  CONSTRAINT `ck_survey_loan_rate` CHECK (`loan_annual_rate` BETWEEN 0 AND 100),
  CONSTRAINT `ck_survey_loan_day` CHECK (`loan_payment_day` BETWEEN 1 AND 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원별 최신 주거 설문 — 실제 개인정보를 seed로 넣지 않음';

CREATE TABLE IF NOT EXISTS `housing_loans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'UUID — 프론트 loanId',
  `user_id` BIGINT UNSIGNED NOT NULL,
  `principal` BIGINT UNSIGNED NOT NULL COMMENT '원금 — 원',
  `annual_rate` DECIMAL(5,2) NOT NULL COMMENT '연 이율 — 퍼센트',
  `payment_day` TINYINT UNSIGNED NOT NULL,
  `start_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_housing_loans_user` (`user_id`),
  CONSTRAINT `fk_housing_loans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_housing_loan_terms` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `payment_day` BETWEEN 1 AND 31 AND `is_active` IN (0,1) AND `start_date` BETWEEN '2000-01-01' AND '2100-12-31')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원당 전세 대출 설정 하나 — 중지 후에도 같은 ID 재사용';

CREATE TABLE IF NOT EXISTS `loan_interest_charges` (
  `loan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `charge_date` DATE NOT NULL COMMENT '한국 날짜 기준 납부일 — 실제 출금 증빙 아님',
  `period_ym` INT GENERATED ALWAYS AS (EXTRACT(YEAR_MONTH FROM `charge_date`)) STORED COMMENT 'YYYYMM — 날짜에서 생성하여 월 불일치 방지',
  `principal` BIGINT UNSIGNED NOT NULL COMMENT '기록 당시 원금 스냅샷',
  `annual_rate` DECIMAL(5,2) NOT NULL COMMENT '기록 당시 금리 스냅샷',
  `amount` BIGINT UNSIGNED NOT NULL COMMENT '기록 당시 월 예상 이자 — 원',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`loan_id`, `charge_date`),
  UNIQUE KEY `uk_loan_interest_month` (`loan_id`, `period_ym`),
  CONSTRAINT `fk_loan_interest_loan` FOREIGN KEY (`loan_id`) REFERENCES `housing_loans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_loan_interest_snapshot` CHECK (`principal` BETWEEN 1 AND 9999990000 AND `annual_rate` BETWEEN 0 AND 100 AND `amount` = ROUND(`principal` * `annual_rate` / 1200, 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월별 이자 자동 기록 — 설정 변경 후에도 과거 스냅샷 보존';

ALTER TABLE `bill_items` MODIFY COLUMN `default_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '평소 금액 — 원 단위';
ALTER TABLE `bill_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 금액 — 원 단위';
ALTER TABLE `rent_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 월세 — 원 단위 (설정의 월세 × 10000)';
ALTER TABLE `incomes` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '수입 금액 — 원 단위';
ALTER TABLE `expenses` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '지출 금액 — 원 단위';
ALTER TABLE `user_settings` MODIFY COLUMN `rent_amount` DECIMAL(14,4) UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 금액 — 만원 단위 (55 = 55만원)';

CREATE OR REPLACE VIEW `v_monthly_spend_breakdown` AS
SELECT r.user_id, r.period_ym, '월세' AS label, r.amount AS amount
FROM rent_payments r
UNION ALL
SELECT b.user_id, p.period_ym, '공과금' AS label, SUM(p.amount) AS amount
FROM bill_payments p JOIN bill_items b ON b.id = p.bill_item_id
GROUP BY b.user_id, p.period_ym
UNION ALL
SELECT e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS period_ym, c.name AS label, SUM(e.amount) AS amount
FROM expenses e JOIN ledger_categories c ON c.id = e.category_id
GROUP BY e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m'), c.name
UNION ALL
SELECT l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m') AS period_ym, '전세 대출 이자' AS label, SUM(c.amount) AS amount
FROM loan_interest_charges c JOIN housing_loans l ON l.id = c.loan_id
GROUP BY l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m');

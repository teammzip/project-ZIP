-- Apply once after 20261118_01_bill_monthly_registration.sql.
ALTER TABLE `bill_payments` ADD COLUMN `memo` VARCHAR(200) NULL COMMENT '월별 고정 지출 메모';

-- zip_test 전용 부분 적용 복구. 전체 실행하지 말고 R00 → R01 확인 → R02 → R03 순서.
-- R02는 실제 테이블 구조를 변경하는 DDL입니다. 운영 DB에 사용하지 않습니다.
-- 기존 데이터가 있으면 백업하고, 먼저 현재 타입이 이전 INT UNSIGNED인지 확인합니다.

-- R00: 먼저 진행 중인 가상 데이터 테스트를 취소합니다.
ROLLBACK;
USE zip_test;
SELECT DATABASE() AS test_database, VERSION() AS mysql_version;

-- R01: 이 조회만 실행하고 실제 정의를 확인합니다. 5행이 나와야 합니다.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND (
 (TABLE_NAME='bill_items' AND COLUMN_NAME='default_amount') OR
 (TABLE_NAME IN ('bill_payments','rent_payments','expenses') AND COLUMN_NAME='amount') OR
 (TABLE_NAME='user_settings' AND COLUMN_NAME='rent_amount'))
ORDER BY TABLE_NAME, COLUMN_NAME;

-- R02: 위 타입이 이전 INT UNSIGNED인 경우 최신 스키마 정의로 변경합니다.
-- 일부가 이미 최신 타입이면 해당 ALTER는 생략 가능합니다.
-- 다른 타입/NULL/기본값이 의도적으로 설정돼 있다면 변경 전에 원인을 확인하세요.
-- ALTER는 암묵 커밋되므로 START TRANSACTION/ROLLBACK으로 취소할 수 없습니다.
ALTER TABLE `bill_items` MODIFY COLUMN `default_amount` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '평소 금액 — 원 단위';
ALTER TABLE `bill_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 금액 — 원 단위';
ALTER TABLE `rent_payments` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '그 달 월세 — 원 단위 (설정의 월세 × 10000)';
ALTER TABLE `expenses` MODIFY COLUMN `amount` BIGINT UNSIGNED NOT NULL COMMENT '지출 금액 — 원 단위';
ALTER TABLE `user_settings` MODIFY COLUMN `rent_amount` DECIMAL(14,4) UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 금액 — 만원 단위 (55 = 55만원)';

-- R03: 확인 후 15_schema_audit.sql을 다시 전체 실행합니다.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND (
 (TABLE_NAME='bill_items' AND COLUMN_NAME='default_amount') OR
 (TABLE_NAME IN ('bill_payments','rent_payments','expenses') AND COLUMN_NAME='amount') OR
 (TABLE_NAME='user_settings' AND COLUMN_NAME='rent_amount'))
ORDER BY TABLE_NAME, COLUMN_NAME;

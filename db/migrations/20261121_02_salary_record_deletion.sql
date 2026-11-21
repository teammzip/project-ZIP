-- NULL preserves the month after the salary transaction is deleted.
ALTER TABLE salary_records MODIFY COLUMN income_id BIGINT UNSIGNED NULL;

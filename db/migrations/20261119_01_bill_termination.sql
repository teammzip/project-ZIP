-- 등록된 항목의 사용자 지정 해지 적용일. 기존 납부 기록은 변경하지 않는다.
SET @bill_termination_ddl = IF(
 EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
         AND table_name='bill_items' AND column_name='termination_date'),
 'SELECT ''bill_items.termination_date already exists'' AS migration_info',
 'ALTER TABLE bill_items ADD COLUMN termination_date DATE NULL COMMENT ''사용자 지정 해지 적용일'''
);
PREPARE bill_termination_stmt FROM @bill_termination_ddl;
EXECUTE bill_termination_stmt;
DEALLOCATE PREPARE bill_termination_stmt;

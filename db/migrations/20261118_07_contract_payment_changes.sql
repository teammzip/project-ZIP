-- 대상 DB를 선택한 연결에서 파일 전체를 실행한다. 중간 실패 후 재실행 가능하다.
-- MySQL DDL은 자동 커밋되므로 앞서 성공한 컬럼 추가는 오류가 나도 유지된다.
SET @contract_payment_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema=DATABASE() AND table_name='rent_payments' AND column_name='due_date'),
  'SELECT ''rent_payments.due_date already exists'' AS migration_info',
  'ALTER TABLE rent_payments ADD COLUMN due_date DATE NULL COMMENT ''월별 계약 납부 기한 스냅샷'''
);
PREPARE contract_payment_stmt FROM @contract_payment_ddl;
EXECUTE contract_payment_stmt;
DEALLOCATE PREPARE contract_payment_stmt;

SET @contract_payment_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema=DATABASE() AND table_name='loan_interest_charges' AND column_name='paid_at'),
  'SELECT ''loan_interest_charges.paid_at already exists'' AS migration_info',
  'ALTER TABLE loan_interest_charges ADD COLUMN paid_at DATETIME NULL COMMENT ''실제 납부 완료 시각, NULL은 미납·예정'''
);
PREPARE contract_payment_stmt FROM @contract_payment_ddl;
EXECUTE contract_payment_stmt;
DEALLOCATE PREPARE contract_payment_stmt;

-- 과거 날짜가 없던 월세 기록은 현재 저장된 납부일로 보완한다.
-- 이 연결에서만 Safe Update를 잠시 해제하고 기존 설정으로 복원한다.
SET @contract_payment_previous_safe_updates = @@SESSION.SQL_SAFE_UPDATES;
SET SESSION SQL_SAFE_UPDATES = 0;
UPDATE rent_payments r JOIN user_settings s ON s.user_id=r.user_id
SET r.due_date=STR_TO_DATE(CONCAT(r.period_ym,'-',LPAD(LEAST(COALESCE(s.rent_day,15),DAY(LAST_DAY(CONCAT(r.period_ym,'-01')))),2,'0')),'%Y-%m-%d')
WHERE r.due_date IS NULL;
SET SESSION SQL_SAFE_UPDATES = @contract_payment_previous_safe_updates;
-- UPDATE 자체가 실패해 실행이 중단되면 위 복원문을 별도로 실행하거나 연결을 종료한다.

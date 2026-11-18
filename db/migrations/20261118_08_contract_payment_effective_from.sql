-- 대상 DB를 선택하고 전체 실행. 기존 컬럼은 유지한다.
SET @contract_effective_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
          AND table_name='home_contracts' AND column_name='payment_effective_from'),
  'SELECT ''home_contracts.payment_effective_from already exists'' AS migration_info',
  'ALTER TABLE home_contracts ADD COLUMN payment_effective_from DATE NULL COMMENT ''계약 납부 조건의 신규 가계부 반영 시작일'''
);
PREPARE contract_effective_stmt FROM @contract_effective_ddl;
EXECUTE contract_effective_stmt;
DEALLOCATE PREPARE contract_effective_stmt;
-- 기존 데이터는 변경하지 않는다. 내 집 정보 저장 시 서버가 지역 기준 오늘을 기록한다.

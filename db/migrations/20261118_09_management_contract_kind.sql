-- 대상 DB를 선택하고 전체 실행. 기존 컬럼은 유지한다.
SET @management_kind_ddl = IF(
 EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
         AND table_name='bill_items' AND column_name='home_contract_kind'),
 'SELECT ''bill_items.home_contract_kind already exists'' AS migration_info',
 'ALTER TABLE bill_items ADD COLUMN home_contract_kind VARCHAR(10) NULL COMMENT ''내 집 관리비 계약 유형, 일반 지출은 NULL'''
);
PREPARE management_kind_stmt FROM @management_kind_ddl;
EXECUTE management_kind_stmt;
DEALLOCATE PREPARE management_kind_stmt;

-- 현재 내 집 정보와 연결된 관리비만 유형을 확정한다. 연결되지 않은 과거 항목은 추정하지 않는다.
SET @management_kind_safe_updates = @@SESSION.SQL_SAFE_UPDATES;
SET SESSION SQL_SAFE_UPDATES=0;
UPDATE bill_items b JOIN home_contracts c ON c.management_bill_id=b.id AND c.user_id=b.user_id
SET b.home_contract_kind=c.contract_kind WHERE b.home_contract_kind IS NULL;
SET SESSION SQL_SAFE_UPDATES=@management_kind_safe_updates;
-- UPDATE 실패로 중단되면 위 복원문을 별도 실행하거나 연결을 종료한다.

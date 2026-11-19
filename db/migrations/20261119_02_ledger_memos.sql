-- 연결할 DB를 선택한 후 실행. 기존 메모와 가계부 기록은 유지한다.
SET @ledger_memo_ddl=IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='memos' AND column_name='ledger_source'),'SELECT 1','ALTER TABLE memos ADD COLUMN ledger_source VARCHAR(10) NULL COMMENT ''가계부 원본 종류 income/spend/bill''');
PREPARE ledger_memo_stmt FROM @ledger_memo_ddl;
EXECUTE ledger_memo_stmt;
DEALLOCATE PREPARE ledger_memo_stmt;
SET @ledger_memo_ddl=IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='memos' AND column_name='ledger_key'),'SELECT 1','ALTER TABLE memos ADD COLUMN ledger_key VARCHAR(40) NULL COMMENT ''가계부 원본 ID 또는 고정 지출 ID:월''');
PREPARE ledger_memo_stmt FROM @ledger_memo_ddl;
EXECUTE ledger_memo_stmt;
DEALLOCATE PREPARE ledger_memo_stmt;
SET @ledger_memo_ddl=IF(EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='memos' AND index_name='uk_memos_ledger_source'),'SELECT 1',
'ALTER TABLE memos ADD UNIQUE KEY `uk_memos_ledger_source` (`user_id`, `ledger_source`, `ledger_key`)'
);
PREPARE ledger_memo_stmt FROM @ledger_memo_ddl;
EXECUTE ledger_memo_stmt;
DEALLOCATE PREPARE ledger_memo_stmt;

SET @ledger_memo_ddl=IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='memos' AND column_name='ledger_label'),'SELECT 1','ALTER TABLE memos ADD COLUMN ledger_label VARCHAR(120) NULL COMMENT ''가계부 수입/지출 종류 및 날짜·분류''');
PREPARE ledger_memo_stmt FROM @ledger_memo_ddl;
EXECUTE ledger_memo_stmt;
DEALLOCATE PREPARE ledger_memo_stmt;

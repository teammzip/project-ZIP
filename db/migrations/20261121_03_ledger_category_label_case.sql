-- Distinct spellings can be used by different accounts without renaming shared rows.
ALTER TABLE ledger_categories MODIFY COLUMN name VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
  COMMENT '분류 이름 — 회원별 표시 목록은 설정 JSON에서 관리';

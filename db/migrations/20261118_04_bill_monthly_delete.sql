ALTER TABLE bill_payments ADD COLUMN deleted_at DATETIME NULL COMMENT '선택 월 기록 삭제 시각';

CREATE OR REPLACE VIEW `v_monthly_spend_breakdown` AS
SELECT r.user_id, r.period_ym, '월세' AS label, r.amount AS amount
FROM rent_payments r
UNION ALL
SELECT b.user_id, p.period_ym, '공과금' AS label, SUM(p.amount) AS amount
FROM bill_payments p JOIN bill_items b ON b.id = p.bill_item_id
WHERE p.deleted_at IS NULL
GROUP BY b.user_id, p.period_ym
UNION ALL
SELECT e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS period_ym, c.name AS label, SUM(e.amount) AS amount
FROM expenses e JOIN ledger_categories c ON c.id = e.category_id
GROUP BY e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m'), c.name
UNION ALL
SELECT l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m') AS period_ym, '전세 대출 이자' AS label, SUM(c.amount) AS amount
FROM loan_interest_charges c JOIN housing_loans l ON l.id = c.loan_id
GROUP BY l.user_id, DATE_FORMAT(c.charge_date, '%Y-%m');

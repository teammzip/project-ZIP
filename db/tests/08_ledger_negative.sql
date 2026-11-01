-- zip_test 전용. 전체 실행 금지. F00 → F01~F09 각 문장 → F99.
-- F00 준비 블록
USE zip_test;
START TRANSACTION;
SET @ledger_neg_name=CONCAT('제약',LEFT(REPLACE(UUID(),'-',''),12));
INSERT INTO users (nickname) VALUES ('가계부제약회원');
SET @ledger_neg_user=LAST_INSERT_ID();
INSERT INTO ledger_categories (kind,name,color) VALUES ('INCOME',@ledger_neg_name,'#123456');
SET @ledger_neg_income_cat=LAST_INSERT_ID();
INSERT INTO ledger_categories (kind,name,color) VALUES ('EXPENSE',@ledger_neg_name,'#123456');
SET @ledger_neg_expense_cat=LAST_INSERT_ID();
INSERT INTO incomes (user_id,category_id,amount,income_date) VALUES (@ledger_neg_user,@ledger_neg_income_cat,1000,'2026-11-01');
INSERT INTO expenses (user_id,category_id,amount,expense_date) VALUES (@ledger_neg_user,@ledger_neg_expense_cat,1000,'2026-11-01');
INSERT INTO bill_items (user_id,name) VALUES (@ledger_neg_user,'가상 공과금');
SET @ledger_neg_bill=LAST_INSERT_ID();
INSERT INTO bill_payments (bill_item_id,period_ym,amount) VALUES (@ledger_neg_bill,'2026-11',40000);
INSERT INTO rent_payments (user_id,period_ym,amount) VALUES (@ledger_neg_user,'2026-11',550000);
-- 삭제한 fixture ID를 이용해 부재 참조를 확실히 만듭니다.
INSERT INTO ledger_categories (kind,name,color) VALUES ('EXPENSE',CONCAT(@ledger_neg_name,'삭제'),'#123456');
SET @ledger_neg_missing_cat=LAST_INSERT_ID();
DELETE FROM ledger_categories WHERE id=@ledger_neg_missing_cat;
INSERT INTO bill_items (user_id,name) VALUES (@ledger_neg_user,'삭제할 가상 항목');
SET @ledger_neg_missing_bill=LAST_INSERT_ID();
DELETE FROM bill_items WHERE id=@ledger_neg_missing_bill;
SAVEPOINT ledger_negative_fixture;
SELECT DATABASE() AS db,@ledger_neg_user AS member_id,@ledger_neg_income_cat AS income_category_id,
 @ledger_neg_expense_cat AS expense_category_id,@ledger_neg_bill AS bill_id;

-- F01: 1062 / uk_ledger_categories_kind_name
INSERT INTO ledger_categories (kind,name,color) VALUES ('INCOME',@ledger_neg_name,'#000000');
-- F02: 1452 / fk_incomes_category_id
INSERT INTO incomes (user_id,category_id,amount,income_date) VALUES (@ledger_neg_user,@ledger_neg_missing_cat,1000,'2026-11-01');
-- F03: 1452 / fk_expenses_category_id
INSERT INTO expenses (user_id,category_id,amount,expense_date) VALUES (@ledger_neg_user,@ledger_neg_missing_cat,1000,'2026-11-01');
-- F04: 1062 / uk_bill_payments_bill_item_id_period_ym
INSERT INTO bill_payments (bill_item_id,period_ym,amount) VALUES (@ledger_neg_bill,'2026-11',99999);
-- F05: 1062 / uk_rent_payments_user_id_period_ym
INSERT INTO rent_payments (user_id,period_ym,amount) VALUES (@ledger_neg_user,'2026-11',99999);
-- F06: 1451 / fk_incomes_category_id
DELETE FROM ledger_categories WHERE id=@ledger_neg_income_cat;
-- F07: 1451 / fk_expenses_category_id
DELETE FROM ledger_categories WHERE id=@ledger_neg_expense_cat;
-- F08: 1452 / fk_bill_payments_bill_item_id
INSERT INTO bill_payments (bill_item_id,period_ym,amount) VALUES (@ledger_neg_missing_bill,'2026-11',1000);
-- F09: 1048 / amount cannot be null
INSERT INTO expenses (user_id,category_id,amount,expense_date) VALUES (@ledger_neg_user,@ledger_neg_expense_cat,NULL,'2026-11-01');

-- F99 정리 블록
ROLLBACK;
SELECT 'F99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@ledger_neg_user)=0
 AND (SELECT COUNT(*) FROM ledger_categories WHERE id IN (@ledger_neg_income_cat,@ledger_neg_expense_cat))=0
 AND (SELECT COUNT(*) FROM incomes WHERE user_id=@ledger_neg_user)=0
 AND (SELECT COUNT(*) FROM expenses WHERE user_id=@ledger_neg_user)=0
 AND (SELECT COUNT(*) FROM bill_items WHERE user_id=@ledger_neg_user)=0
 AND (SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=@ledger_neg_bill)=0
 AND (SELECT COUNT(*) FROM rent_payments WHERE user_id=@ledger_neg_user)=0,'PASS','FAIL') AS result;

-- zip_test 전용. 전체 실행 가능. 기존 트랜잭션 없는 새 연결에서 시작합니다.
USE zip_test;
START TRANSACTION;
SET @ledger_tag=LEFT(REPLACE(UUID(),'-',''),10);
SET @ledger_food_name=CONCAT('지출검증',@ledger_tag);
INSERT INTO users (nickname) VALUES ('가계부검증회원');
SET @ledger_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('다른가계부회원');
SET @ledger_other=LAST_INSERT_ID();
INSERT INTO ledger_categories (kind,name,color) VALUES ('INCOME',CONCAT('수입검증',@ledger_tag),'#123456');
SET @ledger_income_cat=LAST_INSERT_ID();
INSERT INTO ledger_categories (kind,name,color) VALUES ('EXPENSE',@ledger_food_name,'#654321');
SET @ledger_expense_cat=LAST_INSERT_ID();
INSERT INTO incomes (user_id,category_id,amount,income_date,income_type)
VALUES (@ledger_user,@ledger_income_cat,3000000,'2026-11-01','FIXED');
SET @ledger_income=LAST_INSERT_ID();
INSERT INTO incomes (user_id,category_id,amount,income_date,income_type)
VALUES (@ledger_user,@ledger_income_cat,300000,'2026-11-02','OTHER'),
 (@ledger_user,@ledger_income_cat,2000000,'2026-12-01','FIXED'),
 (@ledger_other,@ledger_income_cat,9999,'2026-11-01','OTHER');
SELECT 'E01 월별 수입·회원 분리' AS test,
 IF((SELECT COUNT(*) FROM v_monthly_income WHERE user_id=@ledger_user)=2
 AND (SELECT COUNT(*) FROM v_monthly_income WHERE user_id=@ledger_user AND period_ym='2026-11' AND total_amount=3300000)=1
 AND (SELECT COUNT(*) FROM v_monthly_income WHERE user_id=@ledger_user AND period_ym='2026-12' AND total_amount=2000000)=1
 AND (SELECT COUNT(*) FROM v_monthly_income WHERE user_id=@ledger_other AND period_ym='2026-11' AND total_amount=9999)=1,'PASS','FAIL') AS result;
SELECT 'E02 고정·기타 수입 필터' AS test,
 IF((SELECT SUM(amount) FROM incomes WHERE user_id=@ledger_user AND income_date BETWEEN '2026-11-01' AND '2026-11-30' AND income_type='FIXED')=3000000
 AND (SELECT SUM(amount) FROM incomes WHERE user_id=@ledger_user AND income_date BETWEEN '2026-11-01' AND '2026-11-30' AND income_type='OTHER')=300000,'PASS','FAIL') AS result;

INSERT INTO expenses (user_id,category_id,amount,expense_date)
VALUES (@ledger_user,@ledger_expense_cat,12000,'2026-11-01');
SET @ledger_expense=LAST_INSERT_ID();
INSERT INTO expenses (user_id,category_id,amount,expense_date)
VALUES (@ledger_user,@ledger_expense_cat,8000,'2026-11-02'),
 (@ledger_user,@ledger_expense_cat,7000,'2026-12-01'),
 (@ledger_other,@ledger_expense_cat,3333,'2026-11-01');
INSERT INTO bill_items (user_id,name,default_amount,tag) VALUES (@ledger_user,'가상 전기',40000,'공과금');
SET @ledger_bill=LAST_INSERT_ID();
INSERT INTO bill_payments (bill_item_id,period_ym,amount) VALUES (@ledger_bill,'2026-11',40000);
SET @ledger_payment=LAST_INSERT_ID();
INSERT INTO bill_items (user_id,name,default_amount,tag) VALUES (@ledger_user,'가상 통신',20000,'통신');
SET @ledger_phone_bill=LAST_INSERT_ID();
INSERT INTO bill_payments (bill_item_id,period_ym,amount) VALUES (@ledger_phone_bill,'2026-11',20000);
INSERT INTO rent_payments (user_id,period_ym,amount) VALUES (@ledger_user,'2026-11',550000);
SET @ledger_rent=LAST_INSERT_ID();
SELECT 'E03 미납 초기 상태' AS test,
 IF((SELECT COUNT(*) FROM bill_payments WHERE id=@ledger_payment AND paid_at IS NULL)=1
 AND (SELECT COUNT(*) FROM rent_payments WHERE id=@ledger_rent AND paid_at IS NULL)=1,'PASS','FAIL') AS result;
SELECT 'E04 고정 지출 전체와 공과금 전용 구분' AS test,
 IF((SELECT SUM(p.amount) FROM bill_payments p JOIN bill_items b ON b.id=p.bill_item_id WHERE b.user_id=@ledger_user AND p.period_ym='2026-11')=60000
 AND (SELECT SUM(p.amount) FROM bill_payments p JOIN bill_items b ON b.id=p.bill_item_id WHERE b.user_id=@ledger_user AND p.period_ym='2026-11' AND b.tag='공과금')=40000,'PASS','FAIL') AS result;
SET @ledger_loan=CONVERT(UUID() USING ascii) COLLATE ascii_bin;
INSERT INTO housing_loans (id,user_id,principal,annual_rate,payment_day,start_date)
VALUES (@ledger_loan,@ledger_user,120000000,4.00,1,'2026-11-01');
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@ledger_loan,'2026-11-01',120000000,4.00,400000);
SELECT 'E05 월별 지출 4종 집계' AS test,
 IF(COUNT(*)=4 AND SUM(amount)=1030000
 AND SUM(CASE WHEN label='월세' THEN amount ELSE 0 END)=550000
 AND SUM(CASE WHEN label='공과금' THEN amount ELSE 0 END)=60000
 AND SUM(CASE WHEN label=@ledger_food_name THEN amount ELSE 0 END)=20000
 AND SUM(CASE WHEN label='전세 대출 이자' THEN amount ELSE 0 END)=400000,'PASS','FAIL') AS result
FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11';
SELECT 'E06 다른 달·다른 회원 지출 분리' AS test,
 IF((SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-12')=7000
 AND (SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_other AND period_ym='2026-11')=3333,'PASS','FAIL') AS result;
UPDATE bill_payments SET paid_at=CURRENT_TIMESTAMP WHERE id=@ledger_payment;
UPDATE rent_payments SET paid_at=CURRENT_TIMESTAMP WHERE id=@ledger_rent;
SELECT 'E07 납부 상태 저장·집계 금액 유지' AS test,
 IF((SELECT COUNT(*) FROM bill_payments WHERE id=@ledger_payment AND paid_at IS NOT NULL)=1
 AND (SELECT COUNT(*) FROM rent_payments WHERE id=@ledger_rent AND paid_at IS NOT NULL)=1
 AND (SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11')=1030000,'PASS','FAIL') AS result;
UPDATE bill_items SET default_amount=50000,is_active=0 WHERE id=@ledger_bill;
SELECT 'E08 기본 금액 변경·비활성화 후 과거 기록 보존' AS test,
 IF((SELECT amount FROM bill_payments WHERE id=@ledger_payment)=40000
 AND (SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11')=1030000,'PASS','FAIL') AS result;

SAVEPOINT ledger_baseline;
UPDATE expenses SET amount=15000 WHERE id=@ledger_expense;
SELECT 'E09 지출 수정 즉시 집계 반영' AS test,
 IF((SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11')=1033000,'PASS','FAIL') AS result;
DELETE FROM expenses WHERE id=@ledger_expense;
SELECT 'E10 지출 삭제 즉시 집계 반영' AS test,
 IF((SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11')=1018000,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT ledger_baseline;
UPDATE incomes SET amount=5000000000 WHERE id=@ledger_income;
SELECT 'E11 INT 범위를 넘는 금액 저장·합산' AS test,
 IF((SELECT total_amount FROM v_monthly_income WHERE user_id=@ledger_user AND period_ym='2026-11')=5000300000,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT ledger_baseline;
DELETE FROM bill_items WHERE id=@ledger_bill;
SELECT 'E12 고정 지출 실제 삭제 CASCADE' AS test,
 IF((SELECT COUNT(*) FROM bill_payments WHERE id=@ledger_payment)=0
 AND (SELECT SUM(amount) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user AND period_ym='2026-11')=990000,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT ledger_baseline;
DELETE FROM users WHERE id=@ledger_user;
SELECT 'E13 회원 삭제와 VIEW·다른 회원 보존' AS test,
 IF((SELECT COUNT(*) FROM incomes WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM expenses WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM bill_items WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM bill_payments WHERE bill_item_id IN (@ledger_bill,@ledger_phone_bill))=0
 AND (SELECT COUNT(*) FROM rent_payments WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM housing_loans WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id=CONVERT(@ledger_loan USING ascii) COLLATE ascii_bin)=0
 AND (SELECT COUNT(*) FROM v_monthly_income WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM v_monthly_spend_breakdown WHERE user_id=@ledger_user)=0
 AND (SELECT total_amount FROM v_monthly_income WHERE user_id=@ledger_other AND period_ym='2026-11')=9999
 AND (SELECT COUNT(*) FROM ledger_categories WHERE id IN (@ledger_income_cat,@ledger_expense_cat))=2,'PASS','FAIL') AS result;
ROLLBACK;
SELECT 'E14 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@ledger_user,@ledger_other))=0
 AND (SELECT COUNT(*) FROM ledger_categories WHERE id IN (@ledger_income_cat,@ledger_expense_cat))=0
 AND (SELECT COUNT(*) FROM incomes WHERE user_id IN (@ledger_user,@ledger_other))=0
 AND (SELECT COUNT(*) FROM expenses WHERE user_id IN (@ledger_user,@ledger_other))=0
 AND (SELECT COUNT(*) FROM bill_items WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM bill_payments WHERE bill_item_id IN (@ledger_bill,@ledger_phone_bill))=0
 AND (SELECT COUNT(*) FROM rent_payments WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM housing_loans WHERE user_id=@ledger_user)=0
 AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id=CONVERT(@ledger_loan USING ascii) COLLATE ascii_bin)=0,'PASS','FAIL') AS result;

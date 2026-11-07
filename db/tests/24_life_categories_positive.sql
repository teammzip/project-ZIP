-- 최신 schema 또는 20261107 마이그레이션 적용 후 전체 실행. 가상 데이터는 ROLLBACK.
USE zip_test;
START TRANSACTION;
INSERT INTO users(nickname,address) VALUES ('분류검증','가입 주소');
SET @cat_user=LAST_INSERT_ID();
INSERT INTO user_settings(user_id,home_address,ledger_category_settings)
VALUES (@cat_user,'실제 거주 주소',JSON_OBJECT('bill',JSON_OBJECT('custom',JSON_ARRAY(JSON_OBJECT('name','직접 추가한 고정 지출','color','#6485df')),'order',JSON_ARRAY('직접 추가한 고정 지출','공과금'))));
SELECT 'X01 주소 구분' AS test, IF((SELECT home_address FROM user_settings WHERE user_id=@cat_user)='실제 거주 주소' AND (SELECT address FROM users WHERE id=@cat_user)='가입 주소','PASS','FAIL') AS result;
SELECT 'X02 회원별 분류 및 순서' AS test, IF((SELECT JSON_UNQUOTE(JSON_EXTRACT(ledger_category_settings,'$.bill.order[0]')) FROM user_settings WHERE user_id=@cat_user)='직접 추가한 고정 지출','PASS','FAIL') AS result;
INSERT INTO bill_items(user_id,name,default_amount,tag) VALUES (@cat_user,'가상 항목',10000,'직접 추가한 고정 지출');
SET @cat_bill=LAST_INSERT_ID();
INSERT INTO bill_payments(bill_item_id,period_ym,amount,paid_at) VALUES (@cat_bill,'2026-10',10000,NOW()),(@cat_bill,'2026-11',12000,NOW());
UPDATE bill_payments SET paid_at=NULL WHERE bill_item_id=@cat_bill AND period_ym='2026-10';
UPDATE bill_items SET default_amount=15000 WHERE id=@cat_bill;
SELECT 'X03 월별 체크 해제 독립성' AS test, IF((SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=@cat_bill AND period_ym='2026-10' AND paid_at IS NULL)=1 AND (SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=@cat_bill AND period_ym='2026-11' AND paid_at IS NOT NULL AND amount=12000)=1,'PASS','FAIL') AS result;
INSERT INTO ledger_categories(kind,name,color) VALUES ('INCOME',REPEAT('가',24),'var(--color-primary)');
SET @cat_global=LAST_INSERT_ID();
INSERT INTO incomes(user_id,category_id,amount,income_date,income_type) VALUES (@cat_user,@cat_global,1000,'2026-11-07','FIXED');
SELECT 'X04 24자 분류 및 CSS 색 저장' AS test, IF((SELECT CHAR_LENGTH(name) FROM ledger_categories WHERE id=@cat_global)=24,'PASS','FAIL') AS result;
DELETE FROM users WHERE id=@cat_user;
SELECT 'X05 탈퇴 시 개인 분류 및 납부 삭제' AS test, IF((SELECT COUNT(*) FROM user_settings WHERE user_id=@cat_user)=0 AND (SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=@cat_bill)=0,'PASS','FAIL') AS result;
ROLLBACK;

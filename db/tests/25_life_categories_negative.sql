-- Workbench: Y00 준비 → Y01 단독 실행(3819 예상) → Y99 정리. 같은 연결 사용.
USE zip_test;
-- Y00 준비
START TRANSACTION;
INSERT INTO users(nickname) VALUES ('분류예외검증');
SET @cat_negative=LAST_INSERT_ID();
INSERT INTO user_settings(user_id) VALUES (@cat_negative);
-- Y01: 3819 / ck_settings_ledger_object
UPDATE user_settings SET ledger_category_settings=JSON_ARRAY() WHERE user_id=@cat_negative;
-- Y99 정리
ROLLBACK;
SELECT 'Y99 정리' AS test, IF((SELECT COUNT(*) FROM users WHERE id=@cat_negative)=0,'PASS','FAIL') AS result;

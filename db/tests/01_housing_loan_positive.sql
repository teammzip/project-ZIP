-- 최신 schema.sql이 적용된 zip_test 전용. 전체 실행 가능.
-- 새 연결에서 실행하며 기존 미완료 트랜잭션이 없어야 합니다.
-- 실제 회원가입/출금 테스트가 아닙니다. 가상 데이터이며 마지막에 ROLLBACK합니다.
USE zip_test;
SELECT DATABASE() AS test_database, VERSION() AS mysql_version;
SELECT TABLE_TYPE, COUNT(*) AS object_count
FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_TYPE;

START TRANSACTION;
INSERT INTO users (nickname) VALUES ('검증전용회원');
SET @zip_test_user = LAST_INSERT_ID();
SET @zip_test_loan = CONVERT(UUID() USING ascii) COLLATE ascii_bin;

INSERT INTO housing_surveys
  (user_id, birth_date, address, contract_kind, contract_fee, management_fee,
   has_loan, loan_amount, loan_annual_rate, loan_payment_day, loan_start_date,
   income, income_period, answered_at)
VALUES
  (@zip_test_user, '2000-01-01', '가상 테스트 동네', 'JEONSE', 20000000, 100000,
   1, 120000000, 4.00, 31, '2026-01-01', 36000000, 'ANNUAL', CURRENT_TIMESTAMP);

INSERT INTO housing_loans (id, user_id, principal, annual_rate, payment_day, start_date)
VALUES (@zip_test_loan, @zip_test_user, 120000000, 4.00, 31, '2026-01-01');

SELECT 'P01 설문-회원-대출 연결' AS test,
  IF(COUNT(*) = 1, 'PASS', 'FAIL') AS result
FROM housing_surveys s JOIN users u ON u.id=s.user_id
JOIN housing_loans l ON l.user_id=s.user_id
WHERE u.id=@zip_test_user AND s.income_period='ANNUAL' AND l.principal=120000000;

-- 월말 날짜는 서버가 계산할 값입니다. 이 SQL에서는 직접 넣어 저장을 검증합니다.
INSERT INTO loan_interest_charges (loan_id, charge_date, principal, annual_rate, amount)
VALUES (@zip_test_loan, '2026-02-28', 120000000, 4.00, 400000);
SELECT 'P02 월별 키 자동 생성' AS test,
  IF(COUNT(*)=1 AND MIN(period_ym)=202602 AND MIN(amount)=400000,'PASS','FAIL') AS result
FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin;

UPDATE housing_loans SET annual_rate=5.00 WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin;
INSERT INTO loan_interest_charges (loan_id, charge_date, principal, annual_rate, amount)
VALUES (@zip_test_loan, '2026-03-31', 120000000, 5.00, 500000);
SELECT 'P03 조건 변경 후 과거 금리 보존' AS test,
  IF(COUNT(*)=1 AND MIN(annual_rate)=4.00 AND MIN(amount)=400000,'PASS','FAIL') AS result
FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin AND period_ym=202602;

UPDATE housing_loans SET is_active=0 WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin;
SELECT 'P04 중지 후 과거 이자 집계' AS test,
  IF(COUNT(*)=2 AND SUM(amount)=900000,'PASS','FAIL') AS result
FROM v_monthly_spend_breakdown WHERE user_id=@zip_test_user AND label='전세 대출 이자';
SELECT period_ym, label, amount FROM v_monthly_spend_breakdown
WHERE user_id=@zip_test_user ORDER BY period_ym;

-- 월세 설정 단위 보존만 별도로 검증하는 fixture입니다. 위 전세 설문과 자동 동기화되지 않습니다.
INSERT INTO user_settings (user_id, rent_amount) VALUES (@zip_test_user, 55.5555);
SELECT 'P05 원 단위 월세 보존' AS test,
  IF(rent_amount * 10000=555555,'PASS','FAIL') AS result
FROM user_settings WHERE user_id=@zip_test_user;

UPDATE housing_loans SET principal=9999990000, annual_rate=100.00 WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin;
SELECT 'P06 최대 원금과 금리 저장' AS test,
  IF(principal=9999990000 AND annual_rate=100.00,'PASS','FAIL') AS result
FROM housing_loans WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin;
INSERT INTO loan_interest_charges (loan_id, charge_date, principal, annual_rate, amount)
VALUES (@zip_test_loan, '2026-04-30', 9999990000, 100.00, 833332500);
INSERT INTO loan_interest_charges (loan_id, charge_date, principal, annual_rate, amount)
VALUES (@zip_test_loan, '2026-05-31', 9999990000, 0.00, 0);
SELECT 'P07 최대 이자 및 무이자 저장' AS test,
  IF(COUNT(*)=2 AND SUM(amount)=833332500,'PASS','FAIL') AS result
FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin AND period_ym IN (202604,202605);
-- 위 두 행은 DB 경계값 검사입니다. 중지 상태에서 기록을 생성하지 않는 정책은 서버 책임입니다.

SAVEPOINT before_member_delete;
DELETE FROM users WHERE id=@zip_test_user;
SELECT 'P08 회원 삭제 CASCADE' AS test,
  IF((SELECT COUNT(*) FROM housing_surveys WHERE user_id=@zip_test_user)=0
  AND (SELECT COUNT(*) FROM housing_loans WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@zip_test_user)=0,'PASS','FAIL') AS result;
ROLLBACK TO SAVEPOINT before_member_delete;
SELECT 'P09 SAVEPOINT 복구' AS test,
  IF((SELECT COUNT(*) FROM users WHERE id=@zip_test_user)=1
  AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@zip_test_user)=1
  AND (SELECT COUNT(*) FROM housing_loans WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=1
  AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=4
  AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@zip_test_user)=1,'PASS','FAIL') AS result;

ROLLBACK;
SELECT 'P10 테스트 데이터 제거' AS test,
  IF((SELECT COUNT(*) FROM users WHERE id=@zip_test_user)=0
  AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@zip_test_user)=0
  AND (SELECT COUNT(*) FROM housing_loans WHERE id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_test_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@zip_test_user)=0,'PASS','FAIL') AS result;

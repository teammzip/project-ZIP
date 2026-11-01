-- 전체 실행 금지: README의 N00 → N01~N08 각각 → N99 순서로 선택 실행합니다.
-- 의도적인 제약조건 오류 테스트입니다. 같은 연결을 유지하세요.

-- N00: 준비 블록 전체를 한 번 실행합니다.
USE zip_test;
START TRANSACTION;
INSERT INTO users (nickname) VALUES ('제약검증회원');
SET @zip_negative_user=LAST_INSERT_ID();
SET @zip_negative_loan = CONVERT(UUID() USING ascii) COLLATE ascii_bin;
INSERT INTO housing_loans (id,user_id,principal,annual_rate,payment_day,start_date)
VALUES (@zip_negative_loan,@zip_negative_user,120000000,4.00,31,'2026-01-01');
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@zip_negative_loan,'2026-02-28',120000000,4.00,400000);
SAVEPOINT negative_fixture;

-- N01: 같은 회원의 두 번째 대출 → uk_housing_loans_user 중복 오류
INSERT INTO housing_loans (id,user_id,principal,annual_rate,payment_day,start_date)
VALUES (UUID(),@zip_negative_user,100000000,3.00,25,'2026-01-01');

-- N02: 같은 대출·같은 월, 날짜만 변경 → uk_loan_interest_month 중복 오류
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@zip_negative_loan,'2026-02-27',120000000,4.00,400000);

-- N03: 납부일 32 → ck_housing_loan_terms 위반
UPDATE housing_loans SET payment_day=32 WHERE id = CONVERT(@zip_negative_loan USING ascii) COLLATE ascii_bin;

-- N04: 금리 100.01% → ck_housing_loan_terms 위반
UPDATE housing_loans SET annual_rate=100.01 WHERE id = CONVERT(@zip_negative_loan USING ascii) COLLATE ascii_bin;

-- N05: 원금 상한 초과 → ck_housing_loan_terms 위반
UPDATE housing_loans SET principal=9999990001 WHERE id = CONVERT(@zip_negative_loan USING ascii) COLLATE ascii_bin;

-- N06: 월 이자 400,000원 대신 1원 → ck_loan_interest_snapshot 위반
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@zip_negative_loan,'2026-03-31',120000000,4.00,1);

-- N07: 존재하지 않는 대출 참조 → fk_loan_interest_loan 위반
-- 생성 직후 아직 INSERT하지 않은 UUID를 참조합니다.
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (UUID(),'2026-03-31',120000000,4.00,400000);

-- N08: 기념일 아닌데 매년 반복 → ck_events_anniversary_flags 위반
INSERT INTO events (user_id,title,event_date,is_anniversary,repeat_yearly)
VALUES (@zip_negative_user,'저장되면 안 되는 일정','2026-11-01',0,1);

-- N99: 각 오류를 기록한 뒤 정리 블록 전체 실행
ROLLBACK;
SELECT 'N99 테스트 데이터 제거' AS test,
  IF((SELECT COUNT(*) FROM users WHERE id=@zip_negative_user)=0
  AND (SELECT COUNT(*) FROM housing_loans WHERE id = CONVERT(@zip_negative_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id = CONVERT(@zip_negative_loan USING ascii) COLLATE ascii_bin)=0
  AND (SELECT COUNT(*) FROM events WHERE user_id=@zip_negative_user)=0,'PASS','FAIL') AS result;

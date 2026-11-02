-- zip_test 전용. 전체 실행 금지. S00 → S01~S12 각각 → S99.
-- S00 준비 블록
USE zip_test;
START TRANSACTION;
SET @supp_tag=UUID();
INSERT INTO users (nickname) VALUES ('보완검증회원');
SET @supp_user=LAST_INSERT_ID();
-- 000 접두사는 실제 휴대전화 대신 쓰는 가상 DB fixture. API 형식 검증 대상과 구분.
SET @supp_phone=CONCAT('000',LPAD(MOD(@supp_user,100000000),8,'0'));
UPDATE users SET phone=@supp_phone WHERE id=@supp_user;
INSERT INTO user_settings (user_id) VALUES (@supp_user);
INSERT INTO phone_verifications (purpose,phone,code_hash,expires_at,verified_token_hash)
VALUES ('SIGNUP',@supp_phone,SHA2(CONCAT('fixture-code-',@supp_tag),256),
 DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 3 MINUTE),SHA2(CONCAT('fixture-token-',@supp_tag),256));
SET @supp_verification=LAST_INSERT_ID();
-- SHA2는 가상 fixture 값 생성 전용이며 운영 비밀번호/인증코드 저장 지침이 아닙니다.
INSERT INTO housing_surveys (user_id,birth_date,address,contract_kind,income_period,answered_at)
VALUES (@supp_user,'2000-01-01','가상 테스트 동네','JEONSE','MONTHLY',CURRENT_TIMESTAMP);
SET @supp_loan=CONVERT(UUID() USING ascii) COLLATE ascii_bin;
INSERT INTO housing_loans (id,user_id,principal,annual_rate,payment_day,start_date)
VALUES (@supp_loan,@supp_user,120000000,4.00,25,'2026-01-01');
SAVEPOINT supplemental_fixture;
SELECT DATABASE() AS db,@supp_user AS member_id,@supp_loan AS loan_id,@supp_verification AS verification_id;

-- S01: 1062 / uk_users_phone
INSERT INTO users (nickname,phone) VALUES ('중복전화검증',@supp_phone);
-- S02: 1062 / uk_phone_verifications_verified_token_hash
INSERT INTO phone_verifications (purpose,phone,code_hash,expires_at,verified_token_hash)
VALUES ('SIGNUP',@supp_phone,SHA2(CONCAT('other-code-',@supp_tag),256),
 DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 3 MINUTE),SHA2(CONCAT('fixture-token-',@supp_tag),256));
-- S03: 1062 / user_settings.PRIMARY
INSERT INTO user_settings (user_id) VALUES (@supp_user);
-- S04: 1062 / housing_surveys.PRIMARY
INSERT INTO housing_surveys (user_id,birth_date,address,contract_kind,income_period,answered_at)
VALUES (@supp_user,'2000-01-01','가상 중복 응답','JEONSE','MONTHLY',CURRENT_TIMESTAMP);
-- S05: 3819 / ck_survey_flags
UPDATE housing_surveys SET management_included=2 WHERE user_id=@supp_user;
-- S06: 3819 / ck_survey_loan_rate
UPDATE housing_surveys SET loan_annual_rate=100.01 WHERE user_id=@supp_user;
-- S07: 3819 / ck_survey_loan_day
UPDATE housing_surveys SET loan_payment_day=32 WHERE user_id=@supp_user;
-- S08: 3819 / ck_housing_loan_terms — 시작일 하한
UPDATE housing_loans SET start_date='1999-12-31'
WHERE id=CONVERT(@supp_loan USING ascii) COLLATE ascii_bin;
-- S09: 3819 / ck_housing_loan_terms — boolean 범위
UPDATE housing_loans SET is_active=2
WHERE id=CONVERT(@supp_loan USING ascii) COLLATE ascii_bin;
-- S10: 3819 / ck_loan_interest_snapshot — 원금 0
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@supp_loan,'2026-01-25',0,4.00,0);
-- S11: 3819 / ck_loan_interest_snapshot — 이자 계산 불일치
INSERT INTO loan_interest_charges (loan_id,charge_date,principal,annual_rate,amount)
VALUES (@supp_loan,'2026-01-25',120000000,4.00,400001);
-- S12: 3105 / period_ym — 생성컬럼에 직접 값 지정 금지
INSERT INTO loan_interest_charges (loan_id,charge_date,period_ym,principal,annual_rate,amount)
VALUES (@supp_loan,'2026-01-25',202601,120000000,4.00,400000);

-- S99 정리 블록
ROLLBACK;
SELECT 'S99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@supp_user OR phone=@supp_phone)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@supp_user)=0
 AND (SELECT COUNT(*) FROM phone_verifications WHERE id=@supp_verification OR verified_token_hash=SHA2(CONCAT('fixture-token-',@supp_tag),256))=0
 AND (SELECT COUNT(*) FROM housing_surveys WHERE user_id=@supp_user)=0
 AND (SELECT COUNT(*) FROM housing_loans WHERE id=CONVERT(@supp_loan USING ascii) COLLATE ascii_bin)=0
 AND (SELECT COUNT(*) FROM loan_interest_charges WHERE loan_id=CONVERT(@supp_loan USING ascii) COLLATE ascii_bin)=0,'PASS','FAIL') AS result;

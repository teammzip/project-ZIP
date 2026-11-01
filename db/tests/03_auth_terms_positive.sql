-- zip_test 전용. 새 연결에서 전체 실행. 실제 로그인/문자 발송은 하지 않습니다.
USE zip_test;
START TRANSACTION;
SET @auth_now=CURRENT_TIMESTAMP;
SET @auth_tag=REPLACE(UUID(),'-','');
SET @auth_version=CONCAT('test-',LEFT(@auth_tag,15));
INSERT INTO users (login_id,nickname,email,age_confirmed_at)
VALUES (CONCAT('t',LEFT(@auth_tag,15)),'인증검증회원',CONCAT(@auth_tag,'@example.invalid'),@auth_now);
SET @auth_user=LAST_INSERT_ID();
INSERT INTO users (nickname,signup_provider) VALUES ('소셜검증회원','GOOGLE');
SET @auth_social_user=LAST_INSERT_ID();
SELECT 'A01 회원 기본값·소셜 NULL 허용' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id=@auth_user AND role='USER' AND status='ACTIVE')=1
 AND (SELECT COUNT(*) FROM users WHERE id=@auth_social_user AND login_id IS NULL AND password_hash IS NULL)=1,'PASS','FAIL') AS result;

INSERT INTO social_accounts (user_id,provider,provider_user_id)
VALUES (@auth_social_user,'GOOGLE',CONCAT('fixture-',@auth_tag));
SELECT 'A02 소셜 회원 연결' AS test,IF(COUNT(*)=1,'PASS','FAIL') AS result
FROM social_accounts s JOIN users u ON u.id=s.user_id WHERE u.id=@auth_social_user;

-- 해시는 가상 토큰용 fixture이며 실제 보안 알고리즘의 구현 예제가 아닙니다.
INSERT INTO auth_sessions (user_id,refresh_token_hash,expires_at)
VALUES (@auth_user,SHA2(CONCAT('session-',@auth_tag),256),DATE_ADD(@auth_now,INTERVAL 1 DAY));
SET @auth_session=LAST_INSERT_ID();
INSERT INTO auth_sessions (user_id,refresh_token_hash,expires_at)
VALUES (@auth_user,SHA2(CONCAT('expired-',@auth_tag),256),DATE_SUB(@auth_now,INTERVAL 1 DAY));
SELECT 'A03 만료 시각 조건 조회' AS test,IF(COUNT(*)=1,'PASS','FAIL') AS result
FROM auth_sessions WHERE user_id=@auth_user AND revoked_at IS NULL AND expires_at>@auth_now;
UPDATE auth_sessions SET revoked_at=@auth_now WHERE id=@auth_session;
SELECT 'A04 폐기 시각 기록·조건 조회' AS test,IF(COUNT(*)=0,'PASS','FAIL') AS result
FROM auth_sessions WHERE user_id=@auth_user AND revoked_at IS NULL AND expires_at>@auth_now;

-- 00000000000은 연락 불가능한 형식 검사용 값. 서버 전화번호 검증 통과를 의미하지 않습니다.
INSERT INTO phone_verifications (purpose,phone,user_id,code_hash,expires_at,verified_at,verified_token_hash)
VALUES ('RESET_PASSWORD','00000000000',@auth_user,SHA2(CONCAT('code-',@auth_tag),256),
 DATE_ADD(@auth_now,INTERVAL 3 MINUTE),@auth_now,SHA2(CONCAT('verified-',@auth_tag),256));
SET @auth_phone=LAST_INSERT_ID();
UPDATE phone_verifications SET consumed_at=@auth_now
WHERE id=@auth_phone AND consumed_at IS NULL AND expires_at>@auth_now;
SELECT 'A05 인증 완료 값 첫 소비' AS test,IF(ROW_COUNT()=1,'PASS','FAIL') AS result;
UPDATE phone_verifications SET consumed_at=@auth_now
WHERE id=@auth_phone AND consumed_at IS NULL AND expires_at>@auth_now;
SELECT 'A06 인증 완료 값 재소비 조건' AS test,IF(ROW_COUNT()=0,'PASS','FAIL') AS result;
INSERT INTO phone_verifications (purpose,phone,code_hash,expires_at)
VALUES ('SIGNUP','00000000000',SHA2(CONCAT('signup-',@auth_tag),256),DATE_ADD(@auth_now,INTERVAL 3 MINUTE));
SET @auth_unbound_phone=LAST_INSERT_ID();

INSERT INTO password_resets (user_id,method,token_hash,expires_at)
VALUES (@auth_user,'PHONE',SHA2(CONCAT('reset-',@auth_tag),256),DATE_ADD(@auth_now,INTERVAL 10 MINUTE));
SET @auth_reset=LAST_INSERT_ID();
UPDATE password_resets SET used_at=@auth_now WHERE id=@auth_reset AND used_at IS NULL AND expires_at>@auth_now;
SELECT 'A07 재설정 토큰 첫 소비' AS test,IF(ROW_COUNT()=1,'PASS','FAIL') AS result;
UPDATE password_resets SET used_at=@auth_now WHERE id=@auth_reset AND used_at IS NULL AND expires_at>@auth_now;
SELECT 'A08 재설정 토큰 재소비 조건' AS test,IF(ROW_COUNT()=0,'PASS','FAIL') AS result;

-- 실제 약관에 동의하지 않고 테스트 전용 버전 3개를 만듭니다.
INSERT INTO terms_documents (doc_type,version,title,content,consent_kind,effective_at)
VALUES ('SERVICE',@auth_version,'테스트 이용약관','가상 테스트 문서','AGREE',@auth_now);
SET @auth_terms=LAST_INSERT_ID();
INSERT INTO terms_documents (doc_type,version,title,content,consent_kind,effective_at)
VALUES ('PRIVACY',@auth_version,'테스트 처리방침','가상 테스트 문서','CONFIRM',@auth_now);
SET @auth_privacy=LAST_INSERT_ID();
INSERT INTO terms_documents (doc_type,version,title,content,consent_kind,effective_at)
VALUES ('POLICY',@auth_version,'테스트 운영정책','가상 테스트 문서','AGREE',@auth_now);
SET @auth_policy=LAST_INSERT_ID();
INSERT INTO user_term_agreements (user_id,terms_id,agreed_at)
VALUES (@auth_user,@auth_terms,@auth_now),(@auth_user,@auth_privacy,@auth_now),(@auth_user,@auth_policy,@auth_now);
SELECT 'A09 문서 종류·버전·동의 시각 연결' AS test,
 IF(COUNT(*)=3 AND COUNT(DISTINCT t.doc_type)=3 AND MIN(a.agreed_at)=@auth_now,'PASS','FAIL') AS result
FROM user_term_agreements a JOIN terms_documents t ON t.id=a.terms_id
WHERE a.user_id=@auth_user AND t.version=@auth_version;

INSERT INTO user_settings (user_id) VALUES (@auth_user);
INSERT INTO user_profiles (user_id,bio,avatar_emoji) VALUES (@auth_user,'가상 프로필','🏠');
SELECT 'A10 회원별 설정·프로필 연결' AS test,IF(COUNT(*)=1,'PASS','FAIL') AS result
FROM users u JOIN user_settings s ON s.user_id=u.id JOIN user_profiles p ON p.user_id=u.id
WHERE u.id=@auth_user AND s.rent_day=15 AND p.bio='가상 프로필';
INSERT INTO withdrawal_logs (former_user_id) VALUES (@auth_user);
SET @auth_withdrawal=LAST_INSERT_ID();

DELETE FROM users WHERE id=@auth_user;
DELETE FROM users WHERE id=@auth_social_user;
SELECT 'A11 회원 삭제 CASCADE' AS test,
 IF((SELECT COUNT(*) FROM social_accounts WHERE user_id=@auth_social_user)=0
 AND (SELECT COUNT(*) FROM auth_sessions WHERE user_id=@auth_user)=0
 AND (SELECT COUNT(*) FROM phone_verifications WHERE id=@auth_phone)=0
 AND (SELECT COUNT(*) FROM password_resets WHERE user_id=@auth_user)=0
 AND (SELECT COUNT(*) FROM user_term_agreements WHERE user_id=@auth_user)=0
 AND (SELECT COUNT(*) FROM user_settings WHERE user_id=@auth_user)=0
 AND (SELECT COUNT(*) FROM user_profiles WHERE user_id=@auth_user)=0,'PASS','FAIL') AS result;
SELECT 'A12 독립 기록 보존' AS test,
 IF((SELECT COUNT(*) FROM withdrawal_logs WHERE id=@auth_withdrawal)=1
 AND (SELECT COUNT(*) FROM phone_verifications WHERE id=@auth_unbound_phone AND user_id IS NULL)=1
 AND (SELECT COUNT(*) FROM terms_documents WHERE id IN (@auth_terms,@auth_privacy,@auth_policy))=3,'PASS','FAIL') AS result;
-- 가입 전 인증은 회원 삭제로 없어지지 않으므로 서버 만료 정리 작업이 필요합니다.
ROLLBACK;
SELECT 'A13 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@auth_user,@auth_social_user))=0
 AND (SELECT COUNT(*) FROM terms_documents WHERE id IN (@auth_terms,@auth_privacy,@auth_policy))=0
 AND (SELECT COUNT(*) FROM phone_verifications WHERE id=@auth_unbound_phone)=0
 AND (SELECT COUNT(*) FROM withdrawal_logs WHERE id=@auth_withdrawal)=0,'PASS','FAIL') AS result;

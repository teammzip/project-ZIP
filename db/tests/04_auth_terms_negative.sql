-- 전체 실행 금지. B00 → B01~B10 각각 → B99, 같은 연결에서 실행하세요.
-- B00 준비 블록
USE zip_test;
START TRANSACTION;
SET @auth_neg_tag=REPLACE(UUID(),'-','');
SET @auth_neg_login=CONCAT('t',LEFT(@auth_neg_tag,15));
SET @auth_neg_email=CONCAT(@auth_neg_tag,'@example.invalid');
SET @auth_neg_version=CONCAT('test-',LEFT(@auth_neg_tag,15));
INSERT INTO users (login_id,nickname,email) VALUES (@auth_neg_login,'오류검증회원',@auth_neg_email);
SET @auth_neg_user=LAST_INSERT_ID();
INSERT INTO users (nickname) VALUES ('다른검증회원');
SET @auth_neg_other=LAST_INSERT_ID();
INSERT INTO social_accounts (user_id,provider,provider_user_id) VALUES (@auth_neg_user,'GOOGLE',@auth_neg_tag);
INSERT INTO auth_sessions (user_id,refresh_token_hash,expires_at)
VALUES (@auth_neg_user,SHA2(CONCAT('session-',@auth_neg_tag),256),DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 DAY));
INSERT INTO password_resets (user_id,method,token_hash,expires_at)
VALUES (@auth_neg_user,'PHONE',SHA2(CONCAT('reset-',@auth_neg_tag),256),DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 10 MINUTE));
INSERT INTO terms_documents (doc_type,version,title,content,consent_kind,effective_at)
VALUES ('SERVICE',@auth_neg_version,'제약 검증 약관','가상 테스트 문서','AGREE',CURRENT_TIMESTAMP);
SET @auth_neg_terms=LAST_INSERT_ID();
INSERT INTO user_term_agreements (user_id,terms_id) VALUES (@auth_neg_user,@auth_neg_terms);
INSERT INTO user_profiles (user_id) VALUES (@auth_neg_user);
SAVEPOINT auth_negative_fixture;
SELECT DATABASE() AS db, @auth_neg_user AS member_id, @auth_neg_other AS other_id, @auth_neg_terms AS terms_id;

-- B01: 1062 / uk_users_login_id
INSERT INTO users (login_id,nickname) VALUES (@auth_neg_login,'중복아이디');
-- B02: 1062 / uk_users_email
INSERT INTO users (email,nickname) VALUES (@auth_neg_email,'중복이메일');
-- B03: 1062 / uk_social_accounts_provider_provider_user_id
INSERT INTO social_accounts (user_id,provider,provider_user_id) VALUES (@auth_neg_other,'GOOGLE',@auth_neg_tag);
-- B04: 1062 / uk_social_accounts_user_id_provider
INSERT INTO social_accounts (user_id,provider,provider_user_id) VALUES (@auth_neg_user,'GOOGLE',CONCAT('other-',@auth_neg_tag));
-- B05: 1062 / uk_auth_sessions_refresh_token_hash
INSERT INTO auth_sessions (user_id,refresh_token_hash,expires_at)
VALUES (@auth_neg_other,SHA2(CONCAT('session-',@auth_neg_tag),256),DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 DAY));
-- B06: 1062 / uk_password_resets_token_hash
INSERT INTO password_resets (user_id,method,token_hash,expires_at)
VALUES (@auth_neg_other,'PHONE',SHA2(CONCAT('reset-',@auth_neg_tag),256),DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 10 MINUTE));
-- B07: 1062 / uk_terms_documents_doc_type_version
INSERT INTO terms_documents (doc_type,version,title,content,consent_kind,effective_at)
VALUES ('SERVICE',@auth_neg_version,'중복 약관','가상 테스트 문서','AGREE',CURRENT_TIMESTAMP);
-- B08: 1062 / uk_user_term_agreements_user_id_terms_id
INSERT INTO user_term_agreements (user_id,terms_id) VALUES (@auth_neg_user,@auth_neg_terms);
-- B09: 1451 / fk_user_term_agreements_terms_id — 참조 중인 약관 삭제 차단
DELETE FROM terms_documents WHERE id=@auth_neg_terms;
-- B10: 1062 / PRIMARY — 회원당 프로필 하나
INSERT INTO user_profiles (user_id) VALUES (@auth_neg_user);

-- B99 정리 블록
ROLLBACK;
SELECT 'B99 테스트 데이터 제거' AS test,
 IF((SELECT COUNT(*) FROM users WHERE id IN (@auth_neg_user,@auth_neg_other))=0
 AND (SELECT COUNT(*) FROM terms_documents WHERE id=@auth_neg_terms)=0,'PASS','FAIL') AS result;

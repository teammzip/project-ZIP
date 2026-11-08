DROP ALL OBJECTS;
CREATE TABLE regions (id BIGINT PRIMARY KEY, name VARCHAR(30));
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, login_id VARCHAR(16), password_hash VARCHAR(100),
    email VARCHAR(100), nickname VARCHAR(12) NOT NULL, address VARCHAR(200),
    signup_provider VARCHAR(10) DEFAULT 'EMAIL', role VARCHAR(10) DEFAULT 'USER',
    status VARCHAR(12) DEFAULT 'ACTIVE', last_login_at TIMESTAMP,
    region_id BIGINT, password_changed_at TIMESTAMP, age_confirmed_at TIMESTAMP
);
CREATE TABLE social_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, provider VARCHAR(10) NOT NULL,
    provider_user_id VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id), UNIQUE (user_id, provider)
);
CREATE TABLE auth_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL,
    refresh_token_hash CHAR(64) NOT NULL UNIQUE, remember BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP
);
CREATE TABLE user_sanctions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL,
    sanction_type VARCHAR(20), starts_at TIMESTAMP, ends_at TIMESTAMP, revoked_at TIMESTAMP
);
CREATE TABLE terms_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, doc_type VARCHAR(10), version VARCHAR(20),
    title VARCHAR(100), content VARCHAR(300), consent_kind VARCHAR(10),
    is_required BOOLEAN, effective_at TIMESTAMP
);
CREATE TABLE user_term_agreements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT, terms_id BIGINT, agreed_at TIMESTAMP
);
INSERT INTO terms_documents (doc_type, version, title, content, consent_kind, is_required, effective_at) VALUES
('SERVICE', '2026-10-18', '약관', '본문', 'AGREE', TRUE, '2026-10-18 00:00:00'),
('PRIVACY', '2026-10-18', '개인정보', '본문', 'CONFIRM', TRUE, '2026-10-18 00:00:00'),
('POLICY', '2026-10-18', '정책', '본문', 'AGREE', TRUE, '2026-10-18 00:00:00'),
('SERVICE', '2099-01-01', '미래 약관', '미래', 'AGREE', TRUE, '2099-01-01 00:00:00');

DROP ALL OBJECTS;
CREATE TABLE regions (id BIGINT PRIMARY KEY, parent_id BIGINT, name VARCHAR(30));
INSERT INTO regions (id, parent_id, name) VALUES (1, NULL, '서울특별시'), (2, 1, '마포구'), (3, 1, '용산구');
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, login_id VARCHAR(16), password_hash VARCHAR(100),
    email VARCHAR(100), nickname VARCHAR(12) NOT NULL, address VARCHAR(200),
    signup_provider VARCHAR(10) DEFAULT 'EMAIL', role VARCHAR(10) DEFAULT 'USER',
    status VARCHAR(12) DEFAULT 'ACTIVE', last_login_at TIMESTAMP,
    region_id BIGINT, password_changed_at TIMESTAMP, region_verified_at TIMESTAMP,
    home_lat DECIMAL(9,6), home_lon DECIMAL(9,6)
);
CREATE TABLE user_settings (
    user_id BIGINT PRIMARY KEY, rent_amount DECIMAL(14,4) DEFAULT 0 NOT NULL,
    rent_day INT DEFAULT 15 NOT NULL, move_in_ym CHAR(7), contract_end_ym CHAR(7),
    noti_on BOOLEAN DEFAULT TRUE NOT NULL, home_address VARCHAR(200),
    region_name VARCHAR(200), region_source VARCHAR(10), region_lat DECIMAL(9,6), region_lon DECIMAL(9,6),
    home_memo_ids VARCHAR(500), map_categories VARCHAR(500), map_keywords VARCHAR(500), ledger_category_settings VARCHAR(500),
    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK ((region_source IS NULL AND region_name IS NULL AND region_lat IS NULL AND region_lon IS NULL)
        OR (region_source IS NOT NULL AND region_name IS NOT NULL AND CHAR_LENGTH(TRIM(region_name)) > 0
            AND ((region_lat IS NULL AND region_lon IS NULL) OR (region_lat IS NOT NULL AND region_lon IS NOT NULL
                AND region_lat BETWEEN -90 AND 90 AND region_lon BETWEEN -180 AND 180))))
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
CREATE TABLE bill_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, name VARCHAR(30) NOT NULL,
    default_amount BIGINT DEFAULT 0 NOT NULL, is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, tag VARCHAR(24) DEFAULT '공과금' NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE bill_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, bill_item_id BIGINT NOT NULL,
    period_ym CHAR(7) NOT NULL, amount BIGINT NOT NULL, paid_at TIMESTAMP,
    UNIQUE (bill_item_id, period_ym), FOREIGN KEY (bill_item_id) REFERENCES bill_items(id)
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
CREATE TABLE uploaded_files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, original_name VARCHAR(255) NOT NULL,
    storage_url VARCHAR(500) NOT NULL, mime_type VARCHAR(50) NOT NULL, size_bytes INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE user_profiles (
    user_id BIGINT PRIMARY KEY, bio VARCHAR(30) NOT NULL DEFAULT '', avatar_file_id BIGINT,
    avatar_emoji VARCHAR(20), avatar_color VARCHAR(20), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (avatar_file_id) REFERENCES uploaded_files(id)
);
INSERT INTO terms_documents (doc_type, version, title, content, consent_kind, is_required, effective_at) VALUES
('SERVICE', '2026-10-18', '약관', '본문', 'AGREE', TRUE, '2026-10-18 00:00:00'),
('PRIVACY', '2026-10-18', '개인정보', '본문', 'CONFIRM', TRUE, '2026-10-18 00:00:00'),
('POLICY', '2026-10-18', '정책', '본문', 'AGREE', TRUE, '2026-10-18 00:00:00'),
('SERVICE', '2099-01-01', '미래 약관', '미래', 'AGREE', TRUE, '2099-01-01 00:00:00');

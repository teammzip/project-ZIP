CREATE TABLE home_contracts (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 contract_kind VARCHAR(10) NOT NULL,
 billing_time_zone VARCHAR(64),
 payment_effective_from DATE,
 deposit BIGINT DEFAULT 0 NOT NULL,
 management_included BOOLEAN DEFAULT FALSE NOT NULL,
 management_fee BIGINT DEFAULT 0 NOT NULL,
 contract_fee BIGINT DEFAULT 0 NOT NULL,
 management_bill_id BIGINT REFERENCES bill_items(id)
);
CREATE TABLE housing_loans (
 id VARCHAR(36) PRIMARY KEY,
 user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 principal BIGINT NOT NULL, annual_rate DECIMAL(5,2) NOT NULL,
 payment_day INT NOT NULL, start_date DATE NOT NULL, is_active BOOLEAN DEFAULT TRUE NOT NULL
);
CREATE TABLE loan_interest_charges (
 paid_at TIMESTAMP NULL,
 loan_id VARCHAR(36) NOT NULL REFERENCES housing_loans(id) ON DELETE CASCADE,
 charge_date DATE NOT NULL, principal BIGINT NOT NULL, annual_rate DECIMAL(5,2) NOT NULL, amount BIGINT NOT NULL,
 PRIMARY KEY(loan_id,charge_date)
);

CREATE TABLE rent_payments (due_date DATE NULL,id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), period_ym CHAR(7) NOT NULL, amount BIGINT NOT NULL, paid_at TIMESTAMP, UNIQUE(user_id,period_ym));

DROP TABLE IF EXISTS bill_photo_drafts;
CREATE TABLE IF NOT EXISTS bill_photo_drafts (
 id CHAR(36) NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 conversation_id BIGINT UNSIGNED NOT NULL,
 period_ym CHAR(7) NOT NULL,
 time_zone VARCHAR(64) NOT NULL,
 photo_hash CHAR(64) NOT NULL,
 document_hash CHAR(64) NULL,
 input_json TEXT NOT NULL,
 expires_at DATETIME NOT NULL,
 state VARCHAR(12) NOT NULL DEFAULT 'PENDING',
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
 INDEX ix_bill_photo_drafts_owner(user_id, conversation_id)
);

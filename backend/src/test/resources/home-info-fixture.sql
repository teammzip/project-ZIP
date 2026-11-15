CREATE TABLE home_contracts (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 contract_kind VARCHAR(10) NOT NULL,
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
 loan_id VARCHAR(36) NOT NULL REFERENCES housing_loans(id) ON DELETE CASCADE,
 charge_date DATE NOT NULL, principal BIGINT NOT NULL, annual_rate DECIMAL(5,2) NOT NULL, amount BIGINT NOT NULL,
 PRIMARY KEY(loan_id,charge_date)
);

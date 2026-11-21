CREATE TABLE ledger_categories (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(10) NOT NULL, name VARCHAR(24) NOT NULL,
 color VARCHAR(32) NOT NULL, sort_order TINYINT DEFAULT 0 NOT NULL, UNIQUE(kind,name)
);
CREATE TABLE incomes (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
 category_id BIGINT NOT NULL REFERENCES ledger_categories(id), amount BIGINT NOT NULL,
 income_date DATE NOT NULL, memo VARCHAR(100), income_type VARCHAR(10) DEFAULT 'OTHER' NOT NULL
);
CREATE TABLE expenses (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
 category_id BIGINT NOT NULL REFERENCES ledger_categories(id), amount BIGINT NOT NULL,
 expense_date DATE NOT NULL, memo VARCHAR(100)
);
INSERT INTO ledger_categories(kind,name,color) VALUES ('INCOME','월급','#7895cb'),('INCOME','용돈','#7895cb'),('EXPENSE','식비','#7895cb');
CREATE TABLE salary_settings (
 user_id BIGINT PRIMARY KEY REFERENCES users(id), amount BIGINT NOT NULL DEFAULT 0,
 income_period VARCHAR(10) NOT NULL DEFAULT 'monthly', payment_day INT NOT NULL DEFAULT 25, start_month CHAR(7) NOT NULL
);
CREATE TABLE salary_records (
 user_id BIGINT NOT NULL REFERENCES users(id), period_ym CHAR(7) NOT NULL,
 income_id BIGINT UNIQUE REFERENCES incomes(id), PRIMARY KEY(user_id,period_ym)
);

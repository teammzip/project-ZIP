CREATE TABLE housing_surveys (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    birth_date DATE NOT NULL
);

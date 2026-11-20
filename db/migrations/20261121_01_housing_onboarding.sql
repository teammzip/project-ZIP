ALTER TABLE users
    ADD COLUMN housing_survey_status VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN housing_loan_draft TEXT NULL,
    ADD COLUMN housing_salary_draft TEXT NULL;

-- Run this backfill block in one session. Restore the client setting afterward.
SET @housing_onboarding_safe_updates = @@SESSION.SQL_SAFE_UPDATES;
SET SESSION SQL_SAFE_UPDATES = 0;

UPDATE users AS u
SET housing_survey_status = CASE
    WHEN EXISTS (SELECT 1 FROM home_contracts AS h WHERE h.user_id = u.id) THEN 'COMPLETED'
    ELSE 'SKIPPED'
END
WHERE u.housing_survey_status = 'PENDING'
  AND (u.last_login_at IS NOT NULL
       OR EXISTS (SELECT 1 FROM home_contracts AS h WHERE h.user_id = u.id));

SET SESSION SQL_SAFE_UPDATES = @housing_onboarding_safe_updates;

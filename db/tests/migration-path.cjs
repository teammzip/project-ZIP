const legacyMigrations = [
  '20261031_current_project.sql',
  '20261031_02_event_anniversaries.sql',
  '20261101_housing_and_loan.sql',
]

const incrementalMigrations = [
  '20261102_requirements_hardening.sql',
  '20261107_life_categories.sql',
  '20261108_places_kakao.sql',
  '20261115_kakao_place_favorites.sql',
  '20261115_02_email_verification.sql',
  '20261115_03_place_lists.sql',
  '20261115_04_community_admin.sql',
  '20261115_user_personal_info.sql',
  '20261115_home_contracts.sql',
  '20261118_01_bill_monthly_registration.sql',
  '20261118_02_bill_monthly_memo.sql',
  '20261118_03_bill_document_keys.sql',
  '20261118_04_bill_monthly_delete.sql',
  '20261118_05_contract_auto_register.sql',
  '20261118_06_bill_photo_drafts.sql',
  '20261118_07_contract_payment_changes.sql',
  '20261118_08_contract_payment_effective_from.sql',
  '20261118_09_management_contract_kind.sql',
  '20261119_01_bill_termination.sql',
  '20261119_02_ledger_memos.sql',
  '20261119_03_salary_income.sql',
  '20261120_01_community_post_views.sql',
  '20261121_01_housing_onboarding.sql',
  '20261121_02_salary_record_deletion.sql',
  '20261121_03_ledger_category_label_case.sql',
  '20261121_04_login_lockout.sql',
  '20261121_04_post_list_indexes.sql',
  '20261121_05_trash_schedule_places.sql',
  '20261121_06_trash_schedule_columns.sql',
]

module.exports = { legacyMigrations, incrementalMigrations }

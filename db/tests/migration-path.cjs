const { readdirSync } = require('node:fs')
const { join } = require('node:path')

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
  '20261121_07_notices.sql',
  '20261122_01_terms_sync.sql',
  '20261122_03_place_reviews.sql',
  '20261122_05_place_review_photos.sql',
  '20261122_06_terms_privacy_ai.sql',
  '20261122_07_memo_folders.sql',
  '20261127_01_terms_privacy_transfers.sql',
]

// 표 구조는 안 바꾸고 데이터만 넣는 마이그레이션 (전국 지역 · 쓰레기 배출표 · 주변 동네, db/tools/ 의 변환 스크립트가 만듦).
// 구조 비교 · 19번 업그레이드 묶음에는 넣지 않음 — 구조 변화가 없고, 배출표 파일이 커서(약 850KB) 묶음이 너무 커짐
const dataMigrations = [
  '20261122_01_regions_nationwide.sql',
  '20261122_02_trash_schedules_nationwide.sql',
  '20261122_04_region_neighbors_nationwide.sql', // 주변 동네 (db/tools/region_neighbors_import.py 가 만듦)
]

const flywayMigrations = readdirSync(join(__dirname, '../flyway')).filter(name => name.endsWith('.sql') && name !== 'V1__schema.sql')
  .sort((first, second) => first.localeCompare(second, 'en', { numeric: true }))

module.exports = { legacyMigrations, incrementalMigrations, dataMigrations, flywayMigrations }

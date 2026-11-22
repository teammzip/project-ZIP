// Windows MySQL 9.6 isolated validation. Existing servers are never contacted.
// Run from repository root: node db/tests/run-isolated-mysql.cjs
// Leaves ignored db/private/mysql-validation-* logs for diagnosis. No recursive deletion.
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const { randomUUID } = require('node:crypto')
const assert = require('node:assert/strict')
const { incrementalMigrations } = require('./migration-path.cjs')

const basedir = 'C:/Program Files/MySQL/MySQL Server 9.6'
const serverExe = path.join(basedir, 'bin/mysqld.exe')
const clientExe = path.join(basedir, 'bin/mysql.exe')
const id = randomUUID().replaceAll('-', '')
const work = path.resolve('db/private', `mysql-validation-${id}`)
const data = path.join(work, 'data')
const pipe = `ZSV${id.slice(0, 16)}`
const read = p => fs.readFileSync(p, 'utf8')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const results = []
let server

function mysql(sql, force = false) {
  return cp.spawnSync(clientExe, [
    '--no-defaults', '--no-login-paths', '--protocol=PIPE', '--host=.', `--socket=${pipe}`, '--user=root', '--connect-timeout=3',
    '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names',
    '--init-command=SET SESSION sql_safe_updates=1', ...(force ? ['--force'] : []),
  ], { input: sql, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
}
function successful(name, sql, expectedPasses) {
  const result = mysql(sql)
  assert.equal(result.status, 0, `${name}: ${result.stderr}`)
  assert(!/\tFAIL\b/.test(result.stdout), `${name}: ${result.stdout}`)
  const passes = result.stdout.split(/\r?\n/).filter(line => /\tPASS(?:\t|$)/.test(line)).length
  if (expectedPasses !== undefined) assert.equal(passes, expectedPasses, `${name} PASS rows`)
  results.push({ name, status: 'PASS', checks: passes })
  console.log(`PASS ${name}: ${passes} checks`)
  return result.stdout
}
function rejected(name, filename, prefix, expected) {
  const sql = read(`db/tests/${filename}`)
  const ranges = [...sql.matchAll(new RegExp(`^-- (${prefix}\\d{2})[^\\n]*`, 'gm'))]
    .map(match => ({ label: match[1], line: sql.slice(0, match.index).split('\n').length }))
  const result = mysql(sql, true)
  assert.equal(result.status, 0, `${name}: client failed ${result.stderr}`)
  const errors = [...result.stderr.matchAll(/ERROR (\d+) \([^)]*\) at line (\d+): ([^\r\n]+)/g)]
  assert.equal(errors.length, expected.length, `${name}: ${result.stderr}`)
  const seen = new Set()
  for (const error of errors) {
    const range = ranges.filter(item => item.line <= Number(error[2])).at(-1)
    assert(range, `${name}: error outside test block`)
    const number = Number(range.label.slice(prefix.length))
    assert(number >= 1 && number <= expected.length && !seen.has(number), `${name}: unexpected block ${range.label}`)
    const [code, key] = expected[number - 1]
    assert.equal(Number(error[1]), code, `${name} ${range.label}: ${error[3]}`)
    assert(error[3].includes(key), `${name} ${range.label}: ${error[3]}`)
    seen.add(number)
  }
  assert(!/\tFAIL\b/.test(result.stdout), `${name}: cleanup FAIL`)
  assert(result.stdout.includes(`${prefix}99 `) && result.stdout.includes('\tPASS'), `${name}: no cleanup PASS`)
  results.push({ name, status: 'PASS', checks: expected.length + 1 })
  console.log(`PASS ${name}: ${expected.length} expected errors and cleanup`)
}
async function main() {
  assert.equal(process.platform, 'win32', 'Windows named pipe runner')
  assert(fs.existsSync(serverExe) && fs.existsSync(clientExe), 'MySQL 9.6 binaries missing')
  fs.mkdirSync(data, { recursive: true })
  const init = cp.spawnSync(serverExe, [
    '--no-defaults', '--initialize-insecure', `--basedir=${basedir}`, `--datadir=${data}`,
  ], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
  fs.writeFileSync(path.join(work, 'initialize.log'), (init.stdout || '') + (init.stderr || ''))
  assert.equal(init.status, 0, `Initialization failed; inspect ${work}`)
  server = cp.spawn(serverExe, [
    '--no-defaults', `--basedir=${basedir}`, `--datadir=${data}`, '--skip-networking',
    '--enable-named-pipe', `--socket=${pipe}`, '--mysqlx=OFF', '--skip-log-bin',
    '--innodb-buffer-pool-size=64M', `--secure-file-priv=${work}`,
    `--pid-file=${path.join(work, 'server.pid')}`, `--log-error=${path.join(work, 'server.log')}`,
  ], { windowsHide: true, stdio: 'ignore' })
  server.on('error', error => { fs.writeFileSync(path.join(work, 'spawn-error.log'), String(error)) })
  let connected = false
  let lastConnectionError = ''
  for (let attempt = 0; attempt < 24; attempt++) {
    if (server.exitCode !== null) break
    const result = mysql('SELECT VERSION();')
    lastConnectionError = result.stderr || String(result.error || '')
    if (result.status === 0) {
      console.log(`Isolated MySQL ${result.stdout.trim()} ready; TCP disabled`)
      connected = true
      break
    }
    await delay(500)
  }
  if (!connected) fs.writeFileSync(path.join(work,'connection-error.log'),lastConnectionError)
  assert(connected, `Isolated server unavailable: ${lastConnectionError.trim()}; inspect ${work}`)
  const schema = read('db/schema.sql').replace('CREATE DATABASE IF NOT EXISTS `zip`', 'CREATE DATABASE IF NOT EXISTS `zip_test`').replace('USE `zip`;', 'USE `zip_test`;')
  successful('fresh schema', schema, 0)
  for (const [file, count] of [
    ['01_housing_loan_positive.sql', 10], ['03_auth_terms_positive.sql', 13],
    ['05_life_positive.sql', 17], ['07_ledger_positive.sql', 14],
    ['09_community_positive.sql', 13], ['11_moderation_positive.sql', 14],
    ['13_map_ai_positive.sql', 16], ['22_latest_requirements_positive.sql', 9],
  ]) successful(file, read(`db/tests/${file}`), count)
  const rejectionSuites = [
    ['02_housing_loan_negative.sql','N',[
      [1062,'uk_housing_loans_user'],[1062,'uk_loan_interest_month'],
      ...Array.from({length:3},()=>[3819,'ck_housing_loan_terms']),
      [3819,'ck_loan_interest_snapshot'],[1452,'fk_loan_interest_loan'],[3819,'ck_events_anniversary_flags'],
    ]],
    ['04_auth_terms_negative.sql','B',[
      [1062,'uk_users_login_id'],[1062,'uk_users_email'],[1062,'uk_social_accounts_provider_provider_user_id'],
      [1062,'uk_social_accounts_user_id_provider'],[1062,'uk_auth_sessions_refresh_token_hash'],
      [1062,'uk_password_resets_token_hash'],[1062,'uk_terms_documents_doc_type_version'],
      [1062,'uk_user_term_agreements_user_id_terms_id'],[1451,'fk_user_term_agreements_terms_id'],[1062,'PRIMARY'],
    ]],
    ['06_life_negative.sql','D',[
      [1062,'uk_event_categories_user_name'],[1062,'uk_event_categories_user_system'],[1062,'uk_event_presets_category_title'],
      [1452,'fk_events_category_id'],[3819,'ck_events_anniversary_flags'],[3819,'ck_events_anniversary_flags'],
      [3819,'ck_memos_items_array'],[3140,'items'],[1048,'body'],
    ]],
    ['08_ledger_negative.sql','F',[
      [1062,'uk_ledger_categories_kind_name'],[1452,'fk_incomes_category_id'],[1452,'fk_expenses_category_id'],
      [1062,'uk_bill_payments_bill_item_id_period_ym'],[1062,'uk_rent_payments_user_id_period_ym'],
      [1451,'fk_incomes_category_id'],[1451,'fk_expenses_category_id'],[1452,'fk_bill_payments_bill_item_id'],[1048,'amount'],
    ]],
    ['10_community_negative.sql','H',[
      [1062,'PRIMARY'],[1062,'uk_post_attachments_file_id'],[1062,'uk_post_attachments_post_sort'],
      [1452,'fk_post_likes_post_id'],[1452,'fk_post_attachments_file_id'],[1452,'fk_comments_parent_id'],
      [1451,'fk_posts_region_id'],[1048,'storage_url'],[1452,'fk_comments_post_id'],
    ]],
    ['12_moderation_negative.sql','J',[
      [1452,'fk_user_sanctions_user_id'],[1452,'fk_user_sanctions_report_id'],
      [1452,'fk_reports_reporter_id'],[1452,'fk_support_inquiries_user_id'],[1048,'content'],
    ]],
    ['14_map_ai_negative.sql','L',[
      [1062,'uk_regions_parent_id_name'],[1062,'PRIMARY'],[3819,'ck_trash_day_time'],
      [1062,'uk_place_categories_name'],[1062,'PRIMARY'],[1062,'uk_place_reviews_place_id_user_id'],[1062,'PRIMARY'],
      [1062,'uk_ai_topics_code'],[1451,'fk_places_category_id'],[1451,'fk_regions_parent_id'],
      [1452,'fk_ai_messages_conversation_id'],[3140,'card_data'],[1451,'fk_places_region_id'],
    ]],
    ['17_supplemental_negative.sql','S',[
      [1062,'uk_users_email'],[1062,'uk_email_verifications_verified_token_hash'],[1062,'PRIMARY'],[1062,'PRIMARY'],
      [3819,'ck_survey_flags'],[3819,'ck_survey_loan_rate'],[3819,'ck_survey_loan_day'],
      [3819,'ck_housing_loan_terms'],[3819,'ck_housing_loan_terms'],
      [3819,'ck_loan_interest_snapshot'],[3819,'ck_loan_interest_snapshot'],[3105,'period_ym'],
    ]],
  ]
  for (const [file,prefix,expected] of rejectionSuites) rejected(file,file,prefix,expected)
  rejected('latest rejection rules', '23_latest_requirements_negative.sql', 'W', [
    [1062,'uk_reports_reporter_target'],[1062,'uk_reports_reporter_target'],
    [3819,'ck_survey_address_point'],[3819,'ck_survey_address_point'],
    ...Array.from({length:4},()=>[3819,'ck_settings_region_location']),
    ...Array.from({length:4},()=>[3819,'ck_settings_json_arrays']),
    [3819,'ck_users_home_point'],[3819,'ck_users_home_point'],
    [3819,'ck_places_point'],[3819,'ck_place_review_rating'],[3819,'ck_trash_any_day'],
  ])
  successful('life categories', read('db/tests/24_life_categories_positive.sql'), 5)
  rejected('life categories rejection', '25_life_categories_negative.sql', 'Y', [[3819,'ck_settings_ledger_object']])
  successful('fresh structure audit', read('db/tests/15_schema_audit.sql'), 7)
  successful('legacy schema', read('db/tests/18_legacy_schema.sql'), 0)
  successful('full migration and data preservation', read('db/tests/19_migration_upgrade.sql'), 15)
  successful('migrated structure audit', read('db/tests/20_migration_schema_audit.sql'), 7)
  // Exercise the incremental upgrade independently of the fresh/full-path runs.
  const oldSchema = cp.execFileSync('git', ['show','7bb1c90:db/schema.sql'], {encoding:'utf8'})
    .replace('CREATE DATABASE IF NOT EXISTS `zip`','CREATE DATABASE IF NOT EXISTS `zip_incremental_test`')
    .replace('USE `zip`;','USE `zip_incremental_test`;')
  successful('previous 44-table schema', oldSchema, 0)
  const preflight = read('db/tests/21_latest_requirements_upgrade.sql').split('-- Q02:')[0]
  const cleanPreflight = successful('clean incremental preflight',preflight.replaceAll('USE zip_test;','USE zip_incremental_test;'),0)
  const violations = cleanPreflight.trim().split(/\r?\n/).slice(-8)
  assert.equal(violations.length,8)
  for (const row of violations) assert(row.endsWith('\t0'), `preflight: ${row}`)
  for (const name of incrementalMigrations) {
    if (name === '20261121_01_housing_onboarding.sql') {
      successful('latest upgrade fixtures', `USE zip_incremental_test;
INSERT INTO users(nickname,last_login_at) VALUES ('mig-return',NOW());
SET @returning=LAST_INSERT_ID();
INSERT INTO users(nickname) VALUES ('mig-new');
SET @new_user=LAST_INSERT_ID();
INSERT INTO users(nickname) VALUES ('mig-home');
SET @home_user=LAST_INSERT_ID();
INSERT INTO home_contracts(user_id,contract_kind,deposit) VALUES (@home_user,'monthly',123456);
INSERT INTO incomes(user_id,category_id,amount,income_date)
SELECT @returning,id,2500000,'2026-11-01' FROM ledger_categories WHERE kind='INCOME' AND name='월급';
SET @salary_income=LAST_INSERT_ID();
INSERT INTO salary_records(user_id,period_ym,income_id) VALUES (@returning,'2026-11',@salary_income);
`, 0)
    }
    const migration = read(`db/migrations/${name}`).replaceAll('USE `zip`;', 'USE `zip_incremental_test`;')
    successful(name, 'USE `zip_incremental_test`;\n' + migration, 0)
  }
  successful('latest migration behavior and preservation', `USE zip_incremental_test;
SELECT 'onboarding backfill',IF(
 (SELECT housing_survey_status FROM users WHERE nickname='mig-return')='SKIPPED'
 AND (SELECT housing_survey_status FROM users WHERE nickname='mig-new')='PENDING'
 AND (SELECT housing_survey_status FROM users WHERE nickname='mig-home')='COMPLETED','PASS','FAIL');
SELECT 'contract and salary preserved',IF(
 (SELECT deposit FROM home_contracts h JOIN users u ON h.user_id=u.id WHERE u.nickname='mig-home')=123456
 AND (SELECT i.amount FROM incomes i JOIN users u ON i.user_id=u.id WHERE u.nickname='mig-return')=2500000,'PASS','FAIL');
SET @returning=(SELECT id FROM users WHERE nickname='mig-return');
UPDATE salary_records SET income_id=NULL WHERE user_id=@returning AND period_ym='2026-11';
DELETE FROM incomes WHERE user_id=@returning;
SELECT 'salary deletion tombstone',IF((SELECT COUNT(*) FROM salary_records WHERE user_id=@returning AND period_ym='2026-11' AND income_id IS NULL)=1,'PASS','FAIL');
INSERT INTO ledger_categories(kind,name,color) VALUES ('INCOME','CaseVerify','#123456'),('INCOME','caseverify','#123456');
SELECT 'case-sensitive labels',IF((SELECT COUNT(*) FROM ledger_categories WHERE kind='INCOME' AND name IN ('CaseVerify','caseverify'))=2,'PASS','FAIL');
`, 4)
  successful('login lockout migration defaults and precision', `USE zip_incremental_test;
SELECT 'existing users start unlocked',IF(
 (SELECT COUNT(*) FROM users WHERE nickname IN ('mig-return','mig-new','mig-home') AND login_failures=0 AND login_failure_since IS NULL)=3,'PASS','FAIL');
SET @lockout_user=(SELECT id FROM users WHERE nickname='mig-return');
UPDATE users SET login_failures=5,login_failure_since='2026-11-22 09:00:00.123' WHERE id=@lockout_user;
SELECT 'lockout state and other users preserved',IF(
 (SELECT COUNT(*) FROM users WHERE nickname='mig-return' AND login_failures=5 AND login_failure_since='2026-11-22 09:00:00.123')=1
 AND (SELECT COUNT(*) FROM users WHERE nickname IN ('mig-new','mig-home') AND login_failures=0 AND login_failure_since IS NULL)=2
 AND (SELECT deposit FROM home_contracts h JOIN users u ON h.user_id=u.id WHERE u.nickname='mig-home')=123456,'PASS','FAIL');
`, 2)
  successful('incremental structure audit', read('db/tests/15_schema_audit.sql')
    .replace('USE zip_test;','USE zip_incremental_test;'), 7)
  successful('duplicate upgrade legacy fixture',oldSchema.replaceAll('zip_incremental_test','zip_dirty_upgrade_test'),0)
  const reportsAlter = read('db/migrations/20261102_requirements_hardening.sql').match(/ALTER TABLE `reports`[\s\S]*?;/)[0]
  const duplicate = mysql(`USE zip_dirty_upgrade_test;
INSERT INTO users(nickname) VALUES ('중복이전검증');
SET @dirty_user=LAST_INSERT_ID();
INSERT INTO reports(reporter_id,target_type,target_id,reason) VALUES (@dirty_user,'POST',1,'OTHER'),(@dirty_user,'POST',1,'OTHER');
SELECT COUNT(*) FROM (SELECT reporter_id,target_type,target_id FROM reports GROUP BY reporter_id,target_type,target_id HAVING COUNT(*)>1) duplicates;
${reportsAlter}`)
  assert.notEqual(duplicate.status,0,'duplicate upgrade must fail')
  assert(duplicate.stderr.includes('ERROR 1062') && duplicate.stderr.includes('uk_reports_reporter_target'),duplicate.stderr)
  assert.equal(duplicate.stdout.trim(),'1','duplicate preflight group count')
  const preserved = mysql(`USE zip_dirty_upgrade_test; SELECT COUNT(*) FROM reports;
SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reports' AND COLUMN_NAME='target_text_snapshot';`)
  assert.equal(preserved.status,0,preserved.stderr)
  assert.equal(preserved.stdout.trim().replace(/\r\n/g,'\n'),'2\n0','failed atomic ALTER must preserve both reports and not add columns')
  results.push({name:'duplicate migration blocked without data loss',status:'PASS',checks:3})
  console.log('PASS duplicate migration blocked; both reports preserved; failed ALTER left no columns')
}
;(async () => {
  let failed
  try { await main() } catch (error) { failed = error; console.error(error.message) }
  finally {
    if (server && server.exitCode === null) {
      mysql('SHUTDOWN;')
      for (let index=0; index<30 && server.exitCode===null; index++) await delay(200)
      if (server.exitCode === null) server.kill()
    }
    const summary = { results, failed: failed ? failed.message : null }
    if (fs.existsSync(work)) fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2))
    console.log(`Validation logs: ${work}`)
    if (failed) process.exitCode=1
  }
})()

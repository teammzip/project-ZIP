// Run from repository root: node db/tests/generate-schema-audit.cjs
// Updates metadata in existing audit query templates; does not connect to MySQL.
const fs = require('node:fs')
const schema = fs.readFileSync('db/schema.sql', 'utf8')
const expected = {
  tables: [], columns: [], keys: [], fks: [], checks: [],
  views: [
    { name: 'v_monthly_income', columns: 'user_id,period_ym,total_amount' },
    { name: 'v_monthly_spend_breakdown', columns: 'user_id,period_ym,label,amount' },
  ],
}
for (const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)` \(([\s\S]*?)\) ENGINE=/g)) {
  const [, table, body] = match
  expected.tables.push({ table })
  for (const col of body.matchAll(/^\s*`([^`]+)` (.+)$/gm)) {
    expected.columns.push({
      table, column: col[1],
      type: col[2].match(/^((?:ENUM\([^)]*\)|\w+(?:\([^)]*\))?)(?: UNSIGNED)?)/)[1].toLowerCase(),
      nullable: col[2].includes('NOT NULL') ? 'NO' : 'YES',
      auto: Number(col[2].includes('AUTO_INCREMENT')),
      generated: Number(col[2].includes('GENERATED ALWAYS')),
      charset: col[2].match(/CHARACTER SET (\w+)/)?.[1] || '',
      collation: col[2].match(/COLLATE (\w+)/)?.[1] || '',
    })
  }
  for (const key of body.matchAll(/(?:PRIMARY KEY|UNIQUE KEY `([^`]+)`) \(([^)]+)\)/g)) {
    expected.keys.push({ table, name: key[1] || 'PRIMARY', columns: [...key[2].matchAll(/`([^`]+)`/g)].map(x => x[1]).join(',') })
  }
  for (const fk of body.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\) ON DELETE (CASCADE|SET NULL|RESTRICT)/g)) {
    expected.fks.push({ table, name: fk[1], column: fk[2], target: fk[3], target_column: fk[4], delete_rule: fk[5] })
  }
  for (const check of body.matchAll(/CONSTRAINT `([^`]+)` CHECK /g)) expected.checks.push({ table, name: check[1] })
}
if (!expected.tables.length) throw new Error('No tables parsed')
const literal = JSON.stringify(expected).replace(/\\/g, '\\\\').replace(/'/g, "''")
const path = 'db/tests/15_schema_audit.sql'
let query = fs.readFileSync(path, 'utf8')
if (!/^SET @zip_audit_expected=.*;$/m.test(query)) throw new Error('Missing metadata placeholder')
query = query.replace(/^SET @zip_audit_expected=.*;$/m, () => `SET @zip_audit_expected='${literal}';`)
fs.writeFileSync(path, query)
fs.writeFileSync('db/tests/schema_expected.json', JSON.stringify(expected, null, 2) + '\n')
fs.writeFileSync('db/tests/20_migration_schema_audit.sql',
  '-- 마이그레이션 후 전용 DB 구조 대조. 원본 15번 감사 SQL의 DB명만 변경.\n' + query.replace('USE zip_test;', 'USE zip_migration_test;'))
console.log(Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, value.length])))

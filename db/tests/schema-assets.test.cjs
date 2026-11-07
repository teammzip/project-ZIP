const fs = require('node:fs')
const test = require('node:test')
const assert = require('node:assert/strict')

const read = path => fs.readFileSync(path, 'utf8')
function tables(sql) {
  return new Map([...sql.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)` \(([\s\S]*?)\) ENGINE=/g)]
    .map(match => [match[1], match[2]]))
}
const normalize = text => text.replace(/ COMMENT .*/, '').replace(/[,;]$/, '').trim()
function columns(body) {
  return new Map([...body.matchAll(/^\s*`([^`]+)` (.+)$/gm)].map(match => [match[1], normalize(match[2])]))
}
function definitions(body) {
  return new Map([...body.matchAll(/^\s*(PRIMARY KEY|UNIQUE KEY `([^`]+)`|KEY `([^`]+)`|CONSTRAINT `([^`]+)`) (.+)$/gm)]
    .map(match => [match[2] || match[3] || match[4] || 'PRIMARY', normalize(match[0])]))
}
const schema = read('db/schema.sql')
const current = tables(schema)
const migrations = [
  '20261031_current_project.sql', '20261031_02_event_anniversaries.sql',
  '20261101_housing_and_loan.sql', '20261102_requirements_hardening.sql', '20261107_life_categories.sql',
].map(name => [`db/migrations/${name}`, read(`db/migrations/${name}`)])

test('foreign keys reference existing compatible columns and SET NULL allows NULL', () => {
  const seen = new Set()
  for (const [name, body] of current) {
    seen.add(name)
    for (const fk of body.matchAll(/FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)([^\n]*)/g)) {
      assert(seen.has(fk[2]), `${name}: dependency ${fk[2]} must be created first`)
      const from = columns(body).get(fk[1])
      const to = columns(current.get(fk[2])).get(fk[3])
      assert(from && to, `${name}: missing FK column`)
      const type = value => value.match(/^\w+(?:\([^)]*\))?(?: UNSIGNED)?(?: CHARACTER SET \w+ COLLATE \w+)?/)[0]
      assert.equal(type(from), type(to), `${name}.${fk[1]} type`)
      if (fk[4].includes('SET NULL')) assert(!from.includes('NOT NULL'), `${name}.${fk[1]} nullable`)
    }
  }
})

test('all migrations produce the same columns, named keys and constraints as fresh schema', () => {
  const baseline = tables(read('db/tests/18_legacy_schema.sql'))
  const state = new Map([...baseline].map(([name, body]) => [name, { columns: columns(body), definitions: definitions(body) }]))
  for (const [, migration] of migrations) {
    for (const [name, body] of tables(migration)) {
      assert(!state.has(name), `duplicate new table ${name}`)
      state.set(name, { columns: columns(body), definitions: definitions(body) })
    }
    for (const alter of migration.matchAll(/ALTER TABLE `([^`]+)`\s+([\s\S]*?);/g)) {
      const table = state.get(alter[1])
      assert(table, `unknown table ${alter[1]}`)
      for (const column of alter[2].matchAll(/(?:ADD|MODIFY) COLUMN `([^`]+)` (.+)$/gm)) {
        table.columns.set(column[1], normalize(column[2]))
      }
      const added = alter[2].replace(/^\s*ADD (CONSTRAINT|UNIQUE KEY|KEY) /gm, '$1 ')
      for (const [name, definition] of definitions(added)) table.definitions.set(name, definition)
    }
    if (migration.includes('RENAME TABLE todos TO todos_legacy_20261031')) state.delete('todos')
  }
  assert.equal(state.size, current.size)
  for (const [name, body] of current) {
    assert.deepEqual(state.get(name).columns, columns(body), `${name} columns`)
    assert.deepEqual(state.get(name).definitions, definitions(body), `${name} constraints`)
  }
})

test('schema audit snapshot covers actual tables and the ordered column set', () => {
  const expected = JSON.parse(read('db/tests/schema_expected.json'))
  assert.deepEqual(expected.tables.map(row => row.table), [...current.keys()])
  const actual = [...current].flatMap(([table, body]) => [...columns(body).keys()].map(column => `${table}.${column}`))
  assert.deepEqual(expected.columns.map(row => `${row.table}.${row.column}`), actual)
  const literal = JSON.stringify(expected).replace(/\\/g, '\\\\').replace(/'/g, "''")
  assert(read('db/tests/15_schema_audit.sql').includes(`SET @zip_audit_expected='${literal}';`))
})

test('isolated migration fixture contains current migrations in order and final audit stays synchronized', () => {
  const fixture = read('db/tests/19_migration_upgrade.sql')
  let previous = -1
  for (const [name, migration] of migrations) {
    const position = fixture.indexOf(migration.replace(/USE `zip`;/g, 'USE `zip_migration_test`;'))
    assert(position > previous, `fixture missing/out of order: ${name}`)
    previous = position
  }
  assert(read('db/tests/20_migration_schema_audit.sql').endsWith(
    read('db/tests/15_schema_audit.sql').replace('USE zip_test;', 'USE zip_migration_test;')))
})

test('latest normal and rejection fixtures use schema columns and explicit test DBs', () => {
  for (const path of ['22_latest_requirements_positive.sql', '23_latest_requirements_negative.sql', '24_life_categories_positive.sql', '25_life_categories_negative.sql']) {
    const sql = read(`db/tests/${path}`)
    assert(sql.includes('USE zip_test;') && sql.includes('ROLLBACK;'))
    assert(!/^\s*(COMMIT|CREATE|ALTER|DROP|TRUNCATE)\b/m.test(sql))
    for (const insert of sql.matchAll(/INSERT INTO (\w+)\s*\(([^)]+)\)/g)) {
      const actual = columns(current.get(insert[1]))
      for (const column of insert[2].split(',').map(value => value.trim())) assert(actual.has(column), `${path}: ${column}`)
    }
  }
  const rejects = read('db/tests/23_latest_requirements_negative.sql')
  for (const match of rejects.matchAll(/-- W\d+:.*?\/ ((?:uk|ck)_\w+)/g)) assert(schema.includes(`\`${match[1]}\``))
})

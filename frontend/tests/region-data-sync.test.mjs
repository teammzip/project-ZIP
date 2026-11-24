// 동네 목록 한 곳 기준: frontend 의 regions.ts 를 db/tools 스크립트가 DB 데이터 마이그레이션 · 프론트 주변 동네 목록으로 만들어요.
// 누가 한쪽만 고치면 여기서 실패 → regions.ts 를 고친 뒤 `python db/tools/trash_import.py` · `python db/tools/region_neighbors_import.py` 다시 실행
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
function evaluate(path) {
  const exports = {}
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require })
  return exports
}
const { REGIONS } = evaluate('../src/features/auth/data/regions.ts')
const { normRegion } = evaluate('../src/features/life/locateRegion.ts')
const { NEARBY } = evaluate('../src/features/community/data/neighbors.ts')

// DB 이름(서울특별시 · 마포구) → 프론트 이름('서울 마포구', 세종은 '세종')
const label = (sido, sigungu) => (sigungu === sido ? normRegion(sido) : `${normRegion(sido)} ${sigungu}`)

test('DB 전국 지역(20261122_01)이 regions.ts 와 같음', () => {
  const sql = read('../../db/migrations/20261122_01_regions_nationwide.sql')
  const db = {}
  for (const block of sql.split(/\n-- /).slice(1)) {
    const sido = block.match(/^(\S+) \(\d+\)/)?.[1]
    if (!sido) continue
    db[normRegion(sido)] = [...block.matchAll(/SELECT '([^']+)' AS name/g)].map((m) => m[1]).sort()
  }
  const front = Object.fromEntries(Object.entries(REGIONS).map(([sido, names]) => [sido, [...names].sort()]))
  assert.deepEqual(db, front)
})

test('프론트 주변 동네 목록(neighbors.ts)이 DB 주변 동네(20261122_04)와 같고, 모든 동네에 이웃이 있음', () => {
  const sql = read('../../db/migrations/20261122_04_region_neighbors_nationwide.sql')
  const db = new Set([...sql.matchAll(/^\('([^']+)','([^']+)','([^']+)','([^']+)'\)/gm)].map((m) => `${label(m[1], m[2])} → ${label(m[3], m[4])}`))
  const front = new Set(Object.entries(NEARBY).flatMap(([key, names]) => names.map((n) => `${key} → ${n}`)))
  assert.equal(front.size, db.size)
  assert.deepEqual([...front].sort(), [...db].sort())
  // regions.ts 의 모든 동네가 이웃 목록에 있고, 이웃은 양쪽이 같음
  const all = Object.entries(REGIONS).flatMap(([sido, names]) => names.map((n) => (n === '세종특별자치시' ? '세종' : `${sido} ${n}`)))
  for (const region of all) assert.ok(NEARBY[region]?.length, `이웃이 없는 동네: ${region}`)
  for (const [key, names] of Object.entries(NEARBY)) for (const n of names) assert.ok(NEARBY[n]?.includes(key), `한쪽만 이웃: ${key} → ${n}`)
})

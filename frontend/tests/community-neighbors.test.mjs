// 커뮤니티 "주변 동네" 탭 안내: 서버가 준 내 동네 · 이웃 동네 이름 → "📍 서울 마포구 + 주변 N곳: …"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function evaluate(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(compile(file), { exports, require: (name) => name in mocks ? mocks[name] : require(name) })
  return exports
}
const locate = evaluate('../src/features/life/locateRegion.ts')
const { neighborLabel, serverNearNote } = evaluate('../src/features/community/neighborNote.ts', { '@/features/life/locateRegion': locate })

const mapo = { id: '2', name: '마포구', sido: '서울특별시' }
const r = (id, name, sido) => ({ id, name, sido })

test('같은 시 · 도는 이름만, 다른 시 · 도는 짧은 시 · 도 이름을 붙이고, 세종은 세종', () => {
  assert.equal(neighborLabel(r('3', '용산구', '서울특별시'), '서울특별시'), '용산구')
  assert.equal(neighborLabel(r('21', '고양시', '경기도'), '서울특별시'), '경기 고양시')
  assert.equal(neighborLabel(r('9', '세종특별자치시', '세종특별자치시'), '충청남도'), '세종')
  assert.equal(neighborLabel(mapo, null), '서울 마포구')
})

test('내 동네와 이웃 동네를 모두 보여 줌', () => {
  const note = serverNearNote({ isError: false, data: { region: mapo, neighbors: [r('3', '용산구', '서울특별시'), r('21', '고양시', '경기도')] } })
  assert.equal(note, '📍 서울 마포구 + 주변 2곳: 용산구 · 경기 고양시')
})

test('불러오는 중 · 실패 · 동네 없음 · 이웃 없음 안내', () => {
  assert.equal(serverNearNote({ isError: false }), '주변 동네를 찾고 있어요…')
  assert.match(serverNearNote({ isError: true }), /불러오지 못했어요/)
  assert.match(serverNearNote({ isError: false, data: { region: null, neighbors: [] } }), /주거 설문에서 주소를 고르면 주변 동네를 보여 드려요/)
  assert.equal(serverNearNote({ isError: false, data: { region: mapo, neighbors: [] } }), '📍 서울 마포구 · 아직 이 지역의 주변 동네 정보가 없어요.')
})

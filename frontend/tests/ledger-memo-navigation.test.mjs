import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../src/features/life/ledgerMemoNavigation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
function setup() {
  const exports = {}, records = new Map(), destinations = []
  const location = { href: 'http://localhost:3000/my/budget/expense/spend', search: '', assign: (url) => destinations.push(url) }
  vm.runInNewContext(code, { exports, URL, URLSearchParams, crypto: { randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, window: { location }, sessionStorage: { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) } })
  return { api: exports, records, location, destinations }
}
test('같은 탭으로 이동하며 입력과 출처를 보관하고 돌아오면 제목을 복원한다', () => {
  const s = setup(), key = 'a'.repeat(32)
  s.api.openLedgerMemo({ owner: '1', kind: 'spend', label: '기타 지출 · 식비', values: { amount: '12000', date: '2026-11-19', cat: '식비' } })
  assert.equal(s.destinations[0], `/my/memo?ledgerDraft=${key}`)
  const draft = s.api.readMemoDraft(key, '1')
  assert.equal(draft.values.amount, '12000')
  s.api.writeMemoDraft({ ...draft, memoId: '9', memoTitle: '점심 모임' })
  s.location.search = `?memoReturn=${key}`
  const returned = s.api.returnedMemoDraft('1', 'spend')
  assert.equal(returned.memoTitle, '점심 모임')
  assert.equal(returned.values.cat, '식비')
  assert.equal(s.api.returnedMemoDraft('2', 'spend'), undefined)
  assert.equal(s.api.returnedMemoDraft('1', 'income'), undefined)
  s.api.clearMemoDraft(returned)
  assert.equal(s.api.returnedMemoDraft('1', 'spend'), undefined)
})
test('외부 경로를 가계부 돌아가기 주소로 사용하지 않는다', () => {
  const s = setup(), key = 'a'.repeat(32)
  s.api.writeMemoDraft({ key, owner: '1', kind: 'bill', returnTo: 'https://example.com', label: '고정 지출', values: {} })
  assert.equal(s.api.readMemoDraft(key, '1'), undefined)
})

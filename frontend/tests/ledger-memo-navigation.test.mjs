import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../src/features/life/ledgerMemoNavigation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
function setup() {
  const exports = {}, records = new Map(), destinations = [], removedMemos = []
  const location = { origin: 'http://localhost:3000', href: 'http://localhost:3000/my/budget/expense/spend', search: '', assign: (url) => destinations.push(url) }
  const mocks = {
    '@/features/memo/store': { useMemoStore: { getState: () => ({ update: () => {}, remove: (id) => removedMemos.push(id) }) } },
    '@/lib/apiMode': { isMockApi: true },
    '@/lib/apiClient': {},
    '@/features/auth/store/authStore': { useAuthStore: { getState: () => ({ user: { id: '1' } }) } },
  }
  const require = (name) => {
    assert(Object.hasOwn(mocks, name), `Unexpected import: ${name}`)
    return mocks[name]
  }
  const sessionStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) { records.set(key, value); this[key] = value },
    removeItem(key) { records.delete(key); delete this[key] },
  }
  vm.runInNewContext(code, { exports, require, URL, URLSearchParams, Event, crypto: { randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, window: { location, dispatchEvent() {} }, sessionStorage })
  return { api: exports, records, location, destinations, removedMemos }
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

test('다른 화면으로 이동해도 메모와 가계부 입력을 유지하며 이어 쓰기는 같은 초안을 연다', () => {
  const s = setup(), key = 'a'.repeat(32)
  s.api.openLedgerMemo({ owner: '1', kind: 'spend', label: '기타 지출 · 식비', values: { amount: '12000', cat: '식비' } })
  const draft = s.api.readMemoDraft(key, '1')
  s.api.rememberLedgerMemoInput(draft, { title: '장보기', body: '작성 중', color: '노랑', pinned: false, checklist: false, items: [] })
  s.api.pauseInactiveLedgerMemoDrafts('1', '/my/memo', `?ledgerDraft=${key}`)
  assert.equal(s.api.readMemoDraft(key, '1').paused, false)
  s.api.pauseInactiveLedgerMemoDrafts('1', '/my/calendar', '')
  const paused = s.api.ledgerMemoDrafts('1')[0]
  assert.equal(paused.paused, true)
  assert.equal(paused.memoInput.body, '작성 중')
  assert.equal(paused.values.amount, '12000')
  assert.equal(s.api.ledgerMemoDrafts('2').length, 0)
  s.api.resumeLedgerMemoDraft(paused)
  assert.equal(s.destinations.at(-1), `/my/memo?ledgerDraft=${key}`)
  assert.equal(s.api.readMemoDraft(key, '1').paused, false)
})

test('메모 확정 뒤에 입력을 바꾸고 나가면 복구 시 원래 가계부로 돌아온다', () => {
  const s = setup(), key = 'a'.repeat(32)
  s.api.openLedgerMemo({ owner: '1', kind: 'spend', label: '기타 지출 · 식비', values: { amount: '12000' } })
  const draft = { ...s.api.readMemoDraft(key, '1'), memoId: '9', memoPending: false, memoTitle: '확정된 메모' }
  s.api.writeMemoDraft(draft)
  s.api.rememberLedgerValues(draft, { amount: '13500' })
  s.api.pauseInactiveLedgerMemoDrafts('1', '/my/calendar', '')
  s.location.search = `?memoReturn=${key}`
  assert.equal(s.api.returnedMemoDraft('1', 'spend'), undefined)
  s.api.resumeLedgerMemoDraft(s.api.readMemoDraft(key, '1'))
  assert.equal(s.destinations.at(-1), `/my/budget/expense/spend?memoReturn=${key}`)
  assert.equal(s.api.returnedMemoDraft('1', 'spend').values.amount, '13500')
})

test('임시 입력을 명시적으로 지우면 해당 초안과 새로 만든 메모만 제거한다', async () => {
  const s = setup(), key = 'a'.repeat(32)
  s.api.openLedgerMemo({ owner: '1', kind: 'spend', label: '기타 지출 · 식비', values: { amount: '12000' } })
  const draft = { ...s.api.readMemoDraft(key, '1'), memoId: '9' }
  const existingMemo = { ...draft, key: 'b'.repeat(32), memoId: '10', newMemo: false }
  s.api.writeMemoDraft(draft)
  s.api.writeMemoDraft(existingMemo)
  await s.api.discardMemoDraft(draft)
  assert.equal(s.api.readMemoDraft(key, '1'), undefined)
  assert.equal(s.api.readMemoDraft(existingMemo.key, '1').memoId, '10')
  assert.deepEqual(s.removedMemos, [9])
  await s.api.discardMemoDraft(existingMemo)
  assert.deepEqual(s.removedMemos, [9])
})

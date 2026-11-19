import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText

test('가계부 API는 조회 시간대·유형을 전달하고 등록·수정·삭제 경로를 구분한다', async () => {
  const calls = [], exports = {}
  const apiClient = Object.fromEntries(['get', 'post', 'put', 'delete'].map((method) => [method, async (...args) => { calls.push([method, ...args]); return { data: [] } }]))
  vm.runInNewContext(compile('../src/features/life/ledgerApi.ts'), { exports, require: () => ({ apiClient }) })
  await exports.getLedger('income', '2026-11', 'Asia/Seoul', 'other')
  assert.equal(calls[0][1], '/ledger/income')
  assert.equal(calls[0][2].params.incomeType, 'other')
  assert.equal(calls[0][2].params.timeZone, 'Asia/Seoul')
  const body = { amount: 1000, cat: '식비', date: '2026-11-19', memo: '' }
  await exports.saveLedger('spend', 'Asia/Seoul', body)
  await exports.saveLedger('spend', 'Asia/Seoul', body, '12')
  await exports.deleteLedger('spend', '12')
  assert.deepEqual(calls.slice(1).map((call) => call.slice(0, 2)), [['post', '/ledger/spend'], ['put', '/ledger/spend/12'], ['delete', '/ledger/spend/12']])
})

function view(result = {}, user = '1', kind = 'spend') {
  const exports = {}, options = []
  const card = ({ title, actions, children }) => React.createElement('section', null, React.createElement('h2', null, title), actions, children)
  vm.runInNewContext(compile('../src/features/life/components/ServerMoneyLog.tsx'), { exports, Intl, Date, require: (name) => {
    if (name === 'react') return { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: () => ({ current: false }) }
    if (name === '@tanstack/react-query') return { useQuery: (config) => { options.push(config); return { ...result, refetch() {} } }, useQueryClient: () => ({ invalidateQueries() {} }) }
    if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: user ? { id: user } : null, token: user ? 'session' : null }) }
    if (name === '../useBillingTimeZone') return { useBillingTimeZone: () => ({ choice: { source: 'address', timeZone: 'Asia/Seoul' }, resolving: false }) }
    if (name === '../useLocalMonth') return { useLocalMonth: () => ({ currentMonth: '2026-11', timeZone: 'Asia/Seoul' }) }
    if (name === '../monthlyPeriod') return { selectedMonth: (_, month) => month }
    if (name === '../ledgerCategories') return { useLedgerCategories: () => [{ name: '식비' }] }
    if (name === './LedgerCategoryDialog') return { LedgerCategoryDialog: () => null }
    if (name === '../ledgerApi') return { getLedger() {} }
    if (name === '../ledgerMemoNavigation') return { returnedMemoDraft: () => undefined }
    if (name === '@/components/ui') return { Card: card, Button: ({ children, ...props }) => React.createElement('button', props, children), AmountInput: () => React.createElement('input') }
    if (name === '@/lib/date') return { won: (amount) => `${amount}원` }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '조회 실패' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  return { html: () => renderToStaticMarkup(exports.ServerMoneyLog({ kind })), options }
}

test('서버 월별 기록의 합계·설정 메뉴와 입력 폼을 표시한다', () => {
  const ui = view({ data: [{ id: '1', date: '2026-11-19', cat: '식비', amount: 1200, memo: '점심' }], isPending: false })
  const html = ui.html()
  assert.match(html, /1200원/)
  assert.match(html, /1건/)
  assert.match(html, /기록 설정/)
  assert.match(html, /수정/)
  assert.match(html, /기록 삭제/)
  assert.equal(ui.options[0].queryKey.at(-1), '2026-11')
})

test('조회 실패를 빈 기록으로 숨기지 않고 비로그인 조회를 막는다', () => {
  const failed = view({ isError: true, isPending: false })
  assert.match(failed.html(), /조회 실패/)
  assert.doesNotMatch(failed.html(), /이 달에는 기록이 없어요/)
  const anonymous = view({}, null)
  assert.match(anonymous.html(), /로그인 후/)
  assert.equal(anonymous.options[0].enabled, false)
})

test('자동 월급은 가계부 직접 수정·삭제 대신 내 정보 설정으로 안내한다', () => {
  const ui = view({ data: [{ id: '1', date: '2026-11-01', cat: '월급', amount: 2500000, memo: '', salaryManaged: true }], isPending: false }, '1', 'income')
  const html = ui.html()
  assert.match(html, /수입 정보에서 월급 수정/)
  assert.match(html, /href="\/my\/settings"/)
  assert.doesNotMatch(html, /기록 삭제/)
})

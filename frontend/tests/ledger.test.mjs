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
  const exports = {}, options = [], buttons = [], navigations = []
  const card = ({ title, actions, children }) => React.createElement('section', null, React.createElement('h2', null, title), actions, children)
  vm.runInNewContext(compile('../src/features/life/components/ServerMoneyLog.tsx'), { exports, Intl, Date, require: (name) => {
    if (name === 'react') return { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: () => ({ current: false }) }
    if (name === 'react-router-dom') return {
      Link: ({ to, children }) => React.createElement('a', { href: to }, children),
      useNavigate: () => (to) => navigations.push(to),
    }
    if (name === '@tanstack/react-query') return { useQuery: (config) => { options.push(config); return { ...result, refetch() {} } }, useQueryClient: () => ({ invalidateQueries() {} }) }
    if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: user ? { id: user } : null, sessionKey: user ? 'session' : null }) }
    if (name === '../useBillingTimeZone') return { useBillingTimeZone: () => ({ choice: { source: 'address', timeZone: 'Asia/Seoul' }, resolving: false }) }
    if (name === '../useLocalMonth') return { useLocalMonth: () => ({ currentMonth: '2026-11', timeZone: 'Asia/Seoul' }) }
    if (name === '../monthlyPeriod') return { selectedMonth: (_, month) => month }
    if (name === '../ledgerCategories') return { useLedgerCategorySettings: () => ({ categories: [{ name: '식비' }], loading: false, failed: false }) }
    if (name === './LedgerCategoryDialog') return { LedgerCategoryDialog: () => null }
    if (name === '../ledgerApi') return { getLedger() {} }
    if (name === '../salaryApi') return { getSalary() {} }
    if (name === '../ledgerMemoNavigation') return { returnedMemoDraft: () => undefined }
    if (name === '@/components/ui') return {
      Card: card,
      // block 은 진짜 <button> 에 넘기지 않으려고 꺼내기만 함 (_ = 일부러 안 씀)
      Button: ({ children, variant, block: _block, ...props }) => {
        buttons.push({ children, variant, onClick: props.onClick })
        return React.createElement('button', props, children)
      },
      AmountInput: () => React.createElement('input'),
    }
    if (name === '@/lib/date') return { won: (amount) => `${amount}원` }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '조회 실패' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  return { html: () => renderToStaticMarkup(exports.ServerMoneyLog({ kind })), options, buttons, navigations }
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
  const edit = ui.buttons.find((button) => button.children === '수정')
  assert.equal(edit.variant, 'line')
  edit.onClick()
  assert.deepEqual(ui.navigations, ['/my/settings?section=income&edit=income'])
  assert.match(html, /기록 삭제/)
})

test('급여 기록이 없어도 고정 수입에서 수입 정보 창으로 이동할 수 있다', () => {
  const empty = { data: [], isPending: false }
  assert.match(view(empty, '1', 'income').html(), /href="\/my\/settings\?section=income">월·연 수입 설정/)
  assert.doesNotMatch(view(empty).html(), /월·연 수입 설정/)
})

test('기존에 직접 등록한 고정 월급도 수입 정보 편집으로 연결한다', () => {
  const ui = view({ data: [{ id: '1', date: '2026-11-01', cat: '월급', amount: 2500000, memo: '', salaryManaged: false }] }, '1', 'income')
  const html = ui.html()
  ui.buttons.find((button) => button.children === '수정').onClick()
  assert.deepEqual(ui.navigations, ['/my/settings?section=income&edit=income'])
  assert.match(html, /기록 삭제/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const period = {}
vm.runInNewContext(compile('../src/features/life/monthlyPeriod.ts'), { exports: period, Date, Intl })

function setup() {
  let selection = null, currentMonth = '2026-05', queryOptions, clockZone = 'Asia/Seoul'
  let resolution = { choice: { timeZone: 'Asia/Seoul', source: 'address' }, resolving: false }
  let result = { data: undefined, isPending: true }
  const exports = {}
  const card = ({ title, actions, children }) => React.createElement('section', null, React.createElement('h2', null, title), actions, children)
  vm.runInNewContext(compile('../src/features/life/components/MonthlyFixedExpense.tsx'), { exports, require: (name) => {
    if (name === 'react') return { useState: () => [selection, (value) => { selection = value }] }
    if (name === '@tanstack/react-query') return { useQuery: (options) => { queryOptions = options; return { ...result, refetch: () => {} } } }
    if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: { id: 'a' }, token: 'test-session' }) }
    if (name === '../useLocalMonth') return { useLocalMonth: () => ({ currentMonth, timeZone: clockZone }) }
    if (name === '../useBillingTimeZone') return { useBillingTimeZone: () => resolution }
    if (name === '../monthlyPeriod') return period
    if (name === '../billsApi') return { getMonthlyBills: () => {} }
    if (name === '@/components/ui') return { Card: card, Button: ({ children, ...props }) => React.createElement('button', props, children) }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '조회 실패' }
    if (name === '@/lib/date') return { won: (amount) => amount.toLocaleString('ko-KR') + '원' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  const tree = () => exports.MonthlyFixedExpense()
  const picker = () => tree().props.children.props.actions.props.children.find((child) => child?.type === 'input')
  return { picker, tree, options: () => { tree(); return queryOptions }, setMonth: (value) => { currentMonth = value },
    result: (value) => { result = value }, resolution: (value) => { resolution = value }, zone: (value) => { clockZone = value }, html: () => renderToStaticMarkup(tree()) }
}
test('현재 월을 보고 있으면 새달로 전환하고 과거 선택은 유지한다', () => {
  const s = setup()
  assert.equal(s.picker().props.value, '2026-05')
  assert.equal(s.picker().props.max, '2026-05')
  s.setMonth('2026-06')
  assert.equal(s.picker().props.value, '2026-06')
  s.picker().props.onChange({ target: { value: '2026-04' } })
  s.setMonth('2026-07')
  assert.equal(s.picker().props.value, '2026-04')
  assert.equal(s.options().refetchInterval, false)
  s.picker().props.onChange({ target: { value: '2026-08' } })
  assert.equal(s.picker().props.value, '2026-04')
})
test('조회는 회원·세션·시간대·월로 구분하고 현재 월은 갱신한다', () => {
  const s = setup(), key = s.options().queryKey
  assert.equal(key.at(-2), 'Asia/Seoul')
  assert.equal(key.at(-1), '2026-05')
  assert.equal(s.options().refetchInterval, 60000)
  assert.equal(s.options().enabled, true)
})
test('미납·예정을 합계에 포함하고 로딩·실패·빈 목록을 구분한다', () => {
  const s = setup()
  assert.ok(s.html().includes('불러오는 중'))
  s.result({ isError: true, error: new Error() })
  assert.ok(s.html().includes('조회 실패'))
  const data = { month: '2026-05', timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-01T12:34:56+09:00', queriedAt: '2026-05-01T12:34:56+09:00', items: [] }
  s.result({ data })
  assert.ok(s.html().includes('조회할 고정 지출이 없어요'))
  data.items = [{ id: '9007199254740993', name: '예정전기', tag: '공과금', amount: 40000, paid: false, snapshot: false, active: true },
    { id: '2', name: '납부통신', tag: '통신', amount: 30000, paid: true, paidAt: '2026-05-01T10:00:00+09:00', snapshot: true, active: true }]
  const html = s.html()
  for (const text of ['70,000원', '30,000원', '40,000원', '미납·예정', '납부 완료', '조회 시각']) assert.ok(html.includes(text))
})
test('우선순위 시간대가 확정되고 월 계산이 맞춰지기 전에는 조회하지 않는다', () => {
  const s = setup()
  s.resolution({ choice: undefined, resolving: true })
  assert.equal(s.options().enabled, false)
  assert.ok(s.html().includes('등록 주소와 현재 위치의 시간대를 확인'))
  s.resolution({ choice: { timeZone: 'America/New_York', source: 'location' }, resolving: false })
  assert.equal(s.options().enabled, false)
  s.zone('America/New_York')
  assert.equal(s.options().enabled, true)
  assert.ok(s.html().includes('현재 위치'))
})

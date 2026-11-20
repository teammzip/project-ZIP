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
    if (name === '@/features/loan') return { LoanInterestCard: () => React.createElement('p', null, '전세 대출 이자 설정') }
    if (name === '../useLocalMonth') return { useLocalMonth: () => ({ currentMonth, timeZone: clockZone }) }
    if (name === '../useBillingTimeZone') return { useBillingTimeZone: () => resolution }
    if (name === '../monthlyPeriod') return period
    if (name === '../ledgerMemoNavigation') return { returnedMemoDraft: () => undefined }
    if (name === '../billsApi') return { getMonthlyBills: () => {} }
    if (name === './MonthlyBillEditor') return { MonthlyBillEditor: () => null }
    if (name === './MonthlyBillActions') return { MonthlyBillActions: () => null }
    if (name === '@/components/ui') return { Card: card, Button: ({ children, ...props }) => React.createElement('button', props, children) }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '조회 실패' }
    if (name === '@/lib/date') return { won: (amount) => amount.toLocaleString('ko-KR') + '원' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  const tree = () => exports.MonthlyFixedExpense()
  const picker = () => tree().props.children[0].props.actions.props.children
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
test('고정 지출은 요약 목록과 기록 폼으로 나뉘고 월별 조회라는 화면명을 쓰지 않는다', () => {
  const html = setup().html()
  assert.ok(html.includes('5월 고정 지출'))
  assert.ok(html.includes('고정 지출 기록하기'))
  assert.ok(!html.includes('고정 지출 월별 조회'))
  assert.ok(!html.includes('type="file"'))
})
test('미납·예정을 합계에 포함하고 로딩·실패·빈 목록을 구분한다', () => {
  const s = setup()
  assert.ok(s.html().includes('불러오는 중'))
  s.result({ isError: true, error: new Error() })
  assert.ok(s.html().includes('조회 실패'))
  const data = { month: '2026-05', timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-01T12:34:56+09:00', queriedAt: '2026-05-01T12:34:56+09:00', items: [] }
  s.result({ data })
  assert.ok(s.html().includes('첫 고정 지출을 기록해 보세요'))
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
  assert.ok(s.html().includes('선택한 월을 불러오는 중'))
})


test('서버 계약 항목을 합계에 포함하고 계약 형태와 내 집 정보 안내를 표시한다', () => {
  const s = setup()
  s.result({ data: { contractKind: 'monthly', month: '2026-05', timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-18T00:00:00+09:00', queriedAt: '2026-05-18T00:00:00+09:00', items: [], housingItems: [{ id: 'rent:2026-05', name: '월세', tag: '월세', amount: 550000, paid: false, active: true, snapshot: false, dueDate: '2026-05-31', memo: '계약 기준 예정 금액', source: 'rent' }] } })
  assert.ok(s.html().includes('월세 계약'))
  assert.ok(!s.html().includes('전세 대출 이자 설정'))
  assert.ok(s.html().includes('550,000원'))
  assert.ok(s.html().includes('내 집 정보에서 확인'))
  s.result({ data: { contractKind: 'jeonse', timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-18T00:00:00+09:00', queriedAt: '2026-05-18T00:00:00+09:00', items: [], housingItems: [] } })
  assert.ok(s.html().includes('전세 계약'))
  assert.ok(s.html().includes('전세 대출 이자 설정'))
  assert.ok(!s.html().includes('550,000원'))
})

test('계약 기간 밖이면 제외 사유와 실제 계약 기간을 표시한다', () => {
  const s = setup()
  const data = { contractKind: 'monthly', contractPeriod: { from: '2026-01', through: '2026-04', outside: true }, items: [], housingItems: [], timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-18T00:00:00+09:00', queriedAt: '2026-05-18T00:00:00+09:00' }
  s.result({ data })
  assert.ok(s.html().includes('자동 등록 대상에서 제외'))
  assert.ok(s.html().includes('2026-01'))
  assert.ok(s.html().includes('2026-04'))
  s.result({ data: { ...data, contractPeriod: { ...data.contractPeriod, outside: false } } })
  assert.ok(!s.html().includes('자동 등록 대상에서 제외'))
})

test('계약 기간 밖이면 직접 등록을 제공하지 않고 납부 완료는 수정하지 않는다', () => {
  const s = setup()
  const data = { contractPeriod: { from: '2026-01', through: '2026-04', outside: true }, items: [], housingItems: [], timeZone: 'Asia/Seoul', periodFrom: '2026-05-01T00:00:00+09:00', periodThrough: '2026-05-18T00:00:00+09:00', queriedAt: '2026-05-18T00:00:00+09:00' }
  s.result({ data })
  assert.ok(s.html().includes('현재 날짜와 조회 월이 모두 계약 기간 안이어야'))
  s.result({ data: { ...data, contractPeriod: { ...data.contractPeriod, outside: false }, items: [{ id: 'paid', name: '납부통신', tag: '통신', amount: 30000, paid: true, paidAt: null, snapshot: true, active: true }] } })
  assert.ok(s.html().includes('납부 완료 · 수정 불가'))
})

test('조회 월이 계약 안이어도 현재 날짜가 계약 밖이면 등록과 수정을 차단한다', () => {
  const s = setup()
  s.result({ data: { contractPeriod: { from: '2026-01', through: '2026-04', outside: false, currentOutside: true },
    items: [{ id: 'unpaid', name: '전기', tag: '공과금', amount: 30000, paid: false, snapshot: true, active: true }], housingItems: [],
    timeZone: 'Asia/Seoul', periodFrom: '2026-04-01T00:00:00+09:00', periodThrough: '2026-04-30T23:59:59+09:00', queriedAt: '2026-05-18T00:00:00+09:00' } })
  assert.ok(s.html().includes('현재 날짜가 계약 기간 밖이므로 등록·수정할 수 없어요'))
  assert.ok(s.html().includes('계약 기간 밖 · 수정 불가'))
})

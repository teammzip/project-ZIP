import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/life/validateLifeInfo.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Error })
const valid = { homeAddress: '', rentDay: '31', rent: '500000', deposit: '10000000', mgmtFee: '50000', moveIn: '2026-11', contractEnd: '2028-11', contractFee: '20000000' }
const validate = (patch = {}, monthly = true, included = false) => exports.validateLifeInfo({ ...valid, ...patch }, monthly, included, true)

test('종료월이 입주월보다 빠르면 거부하고 같은 달은 허용한다', () => {
  assert.throws(() => validate({ contractEnd: '2026-10' }), /계약 종료월은 입주월보다/)
  assert.doesNotThrow(() => validate({ contractEnd: valid.moveIn }))
})
test('선택 날짜를 지우면 빈 값이 저장값으로 반환된다', () => {
  const months = validate({ moveIn: '', contractEnd: '' })
  assert.equal(months.moveIn, '')
  assert.equal(months.contractEnd, '')
  assert.doesNotThrow(() => validate({ moveIn: '' }))
  assert.doesNotThrow(() => validate({ contractEnd: '' }))
})
test('잘못된 연월은 거부한다', () => {
  for (const value of ['0000-01', '2026-00', '2026-13', '26-11', '2026-1']) {
    assert.throws(() => validate({ moveIn: value }), /입주월/)
    assert.throws(() => validate({ contractEnd: value }), /계약 종료월/)
  }
})
test('월세 납부일은 1~31 정수만 허용한다', () => {
  for (const rentDay of ['', '0', '32', '1.5', 'NaN']) assert.throws(() => validate({ rentDay }), /납부일/)
  for (const rentDay of ['1', '31']) assert.doesNotThrow(() => validate({ rentDay }))
})
test('금액의 빈 값·음수·소수·상한 초과를 거부하고 0과 상한은 허용한다', () => {
  for (const [key, max] of [['rent', 99990000], ['deposit', 9999990000], ['mgmtFee', 9990000], ['contractFee', 9999990000]]) {
    for (const value of ['', '-1', '1.5', 'Infinity', String(max + 1)]) assert.throws(() => validate({ [key]: value }, key !== 'contractFee'))
    for (const value of ['0', String(max)]) assert.doesNotThrow(() => validate({ [key]: value }, key !== 'contractFee'))
  }
})
test('숨겨진 계약 유형의 입력은 저장을 막지 않는다', () => {
  assert.doesNotThrow(() => validate({ contractFee: '' }))
  assert.doesNotThrow(() => validate({ rent: '', rentDay: '', deposit: '' }, false))
  assert.doesNotThrow(() => validate({ mgmtFee: '' }, true, true))
  assert.throws(() => validate({ mgmtFee: '' }, false, true), /관리비/)
})
test('주소 길이를 검증한다', () => {
  assert.doesNotThrow(() => validate({ homeAddress: '가'.repeat(200) }))
  assert.throws(() => validate({ homeAddress: '가'.repeat(201) }), /200자/)
})

// 실제 폼의 submit을 호출해 검증 실패가 다른 저장소까지 변경하지 않는지 확인한다.
function submitForm(patch = {}, kind = 'monthly', savedRent = 50, serverSave = null) {
  const writes = []
  let error = ''
  let savedSettings
  const settings = { rent: savedRent, rentDay: 15, moveIn: '2026-11', contractEnd: '2028-11', region: '서울 마포구' }
  const state = {
    settings, bills: [],
    saveSettings: (value) => { writes.push('settings'); savedSettings = value },
  }
  const store = (selector) => selector(state)
  store.getState = () => state
  store.setState = (update) => { writes.push('bills'); Object.assign(state, update(state)) }
  let hook = 0
  const react = require('react')
  const component = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/life/components/MyInfo.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: component,
    Error,
    require: (name) => {
      if (name === 'react') return { ...react, useRef: () => ({ current: false }), useState: (initial) => {
        const index = hook++
        const value = index === 5 ? { ...initial, ...patch } : initial
        return [value, (next) => { if (index === 3) error = next }]
      } }
      if (name.endsWith('.css')) return { default: {} }
      if (name === '../validateLifeInfo') return exports
      if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async () => {} }) }
      if (name === '@/features/auth/api') return { isMockApi: !serverSave }
      if (name === '../homeApi') return { saveHomeInfo: async (input) => { writes.push('server'); return serverSave(input) } }
      if (name === '@/lib/apiClient') return { getErrorMessage: (cause) => cause.message }
      if (name === '../store') return { useLifeStore: store }
      if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: { id: 'member-a' } }) }
      if (name === '@/features/onboarding/useHousingContract') return { useHousingContract: () => ({ kind, survey: null }) }
      if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (selector) => selector({ save: () => writes.push('survey') }) }
      if (name === '@/features/loan') return {
        loanToday: () => '2026-11-15', useLoanInterest: () => ({ plan: null }),
        useLoanStore: (selector) => selector({ stopPlan: () => writes.push('loan'), savePlan: () => writes.push('loan') }),
      }
      if (name === '@/components/ui') return { AmountInput: 'input', Button: 'button' }
      if (['../derive', '../payments', '@/lib/date', '@/lib/useToday'].includes(name)) return {}
      return require(name)
    },
  })
  const form = component.LifeInfoFields({ onSaved: () => writes.push('close') })
  const completion = form.props.onSubmit({ preventDefault() {} })
  return { writes, get error() { return error }, savedSettings, completion }
}

test('폼에서 날짜 오류가 나면 설문·대출·설정·관리비를 변경하지 않는다', () => {
  const result = submitForm({ contractEnd: '2026-10' })
  assert.match(result.error, /계약 종료월/)
  assert.deepEqual(result.writes, [])
})
test('폼에서 날짜를 지우면 기존 날짜 대신 빈 값을 저장하고 창을 닫는다', () => {
  const result = submitForm({ moveIn: '', contractEnd: '' })
  assert.equal(result.error, '')
  assert.equal(result.savedSettings.moveIn, '')
  assert.equal(result.savedSettings.contractEnd, '')
  assert.deepEqual(result.writes, ['loan', 'survey', 'settings', 'bills', 'close'])
})
test('만원으로 저장된 월세를 다시 열어도 원 단위 오차 없이 재저장한다', () => {
  for (const won of [3, 6, 12, 29, 500003]) {
    const result = submitForm({}, 'monthly', won / 10000)
    assert.equal(result.error, '')
    assert.equal(result.savedSettings.rent, won / 10000)
  }
})

test('실제 모드 폼은 서버 저장 성공 후에만 닫고 로컬 저장을 먼저 실행하지 않는다', async () => {
  let sent
  const result = submitForm({}, 'monthly', 55.0003, async (input) => { sent = input })
  assert.deepEqual(result.writes, ['server'])
  await result.completion
  assert.deepEqual(result.writes, ['server', 'close'])
  assert.equal(sent.rent, 550003)
  assert.equal(sent.loan, null)
  assert.equal(sent.kind, 'monthly')
})

test('실제 모드 폼은 저장 실패 시 창을 닫거나 로컬 계약을 변경하지 않는다', async () => {
  const result = submitForm({}, 'monthly', 50, async () => { throw new Error('서버 저장 실패') })
  await result.completion
  assert.deepEqual(result.writes, ['server'])
  assert.equal(result.error, '서버 저장 실패')
})

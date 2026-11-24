import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/features/onboarding/SurveyPage.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function setup(kind, failHome = false, overrides = {}) {
  const user = { id: 'member-a', nickname: '검증회원', firstLogin: true }
  const calls = []
  const updates = []
  const { hasLoan = kind === 'jeonse', ...fields } = overrides
  const viewStates = {
    3: '서울 마포구', 7: kind, 8: 'monthly', 9: false, 10: hasLoan,
    11: { birth: '1995-06-01', deposit: '10000000', rent: '550003', mgmtFee: '70000', contractFee: '20000000',
      loanAmount: '120000000', loanAnnualRate: '4', loanPaymentDay: '25', loanStartDate: '2026-11-01',
      income: '2500000', incomePaymentDay: '25', ...fields },
  }
  let stateIndex = 0
  const stores = {
    auth: { user, sessionKey: 'session-a', updateUser(value) { updates.push(value) } },
    life: { settings: {}, saveSettings() {}, addBill: () => assert.fail('로컬 관리비 생성') },
    loan: { savePlan: () => assert.fail('로컬 대출 생성'), stopPlan: () => assert.fail('로컬 대출 중지') },
    survey: { survey: { userId: user.id }, save() {} },
  }
  const selector = (state) => Object.assign((select) => select(state), { getState: () => state })
  const element = (type, props) => ({ type, props })
  const modules = {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = ++stateIndex
        return [viewStates[index] ?? initial, (value) => updates.push([index, value])]
      },
    },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/features/auth': { useAuthStore: selector(stores.auth), authApi: { updateMe: async () => user } },
    '@/features/life': { useLifeStore: selector(stores.life) },
    '@/features/loan': { useLoanStore: selector(stores.loan), loanToday: () => '2026-11-21', validateLoanTerms: (terms) => terms },
    '@/lib/cx': { cx: () => '' },
    '@/lib/useAge': { useAge: () => ({ age: 31, today: '2026-11-21' }) },
    './store': { useHousingSurveyStore: selector(stores.survey) },
    '@/features/life/salaryApi': { saveSalary: async (input) => calls.push(['salary', input]) },
    '@/features/life/billingTimeZone': { resolveBillingTimeZone: async () => ({ timeZone: 'Asia/Seoul' }) },
    '@/features/life/monthlyPeriod': { deviceTimeZone: () => 'Asia/Seoul' },
    '@/lib/apiMode': { isMockApi: false },
    '@/lib/apiClient': { apiClient: { put: async (path, input) => {
      calls.push([path, input])
      if (failHome) throw new Error('주거 설문 저장 실패')
      return { data: { ...user, firstLogin: false, address: input.address } }
    } }, getErrorMessage: (error) => error.message },
    '@/features/life/homeApi': { loadHomeInfo: async () => {} },
  }
  const exports = {}
  vm.runInNewContext(source, { exports, AbortController, require: (id) => modules[id] ?? { default: {} } })
  const form = exports.SurveyPage().props.children[1].props.children
  return { calls, updates, submit: () => form.props.onSubmit({ preventDefault() {} }) }
}

test('서버 설문은 입력을 한 요청으로 저장한다', async () => {
  for (const kind of ['monthly', 'jeonse']) {
    const s = setup(kind)
    await s.submit()
    assert.equal(s.calls.length, 1)
    const [[path, input]] = s.calls
    assert.equal(path, '/me/housing-onboarding')
    assert.equal(input.address, '서울 마포구')
    assert.equal(input.birth, '1995-06-01')
    assert.equal(input.salary.amount, 2500000)
    assert.equal(input.salary.paymentDay, 25)
    assert.equal(input.home.kind, kind)
    assert.equal(input.home.mgmtFee, 70000)
    assert.equal(input.home.rent, kind === 'monthly' ? 550003 : undefined)
    assert.equal(input.home.loan?.principal, kind === 'jeonse' ? 120000000 : undefined)
    assert.ok(s.updates.some((update) => update.firstLogin === false))
  }
})

test('생략한 항목을 채우지 않고 불완전한 수입·대출 정보도 전송한다', async () => {
  const s = setup('jeonse', false, { birth: '', incomePaymentDay: '', mgmtFee: '', contractFee: '', loanAnnualRate: '', loanPaymentDay: '', loanStartDate: '' })
  await s.submit()
  const [[, input]] = s.calls
  assert.equal(input.birth, undefined)
  assert.equal(input.home.mgmtFee, undefined)
  assert.equal(input.home.contractFee, undefined)
  assert.equal(input.salary.paymentDay, undefined)
  assert.equal(input.home.loan.principal, 120000000)
  assert.equal(input.home.loan.annualRate, undefined)
})

test('설문 저장 실패 시 완료 상태로 전환되지 않는다', async () => {
  const s = setup('jeonse', true)
  await s.submit()
  assert.ok(s.updates.some((update) => Array.isArray(update) && update[1] === '주거 설문 저장 실패'))
  assert.ok(!s.updates.some((update) => update.firstLogin === false))
})

test('전세 대출이 없으면 설문 요청에서 loan 필드를 생략한다', async () => {
  const s = setup('jeonse', false, { hasLoan: false })
  await s.submit()
  const [[, input]] = s.calls
  assert.equal(input.home.kind, 'jeonse')
  assert.equal(Object.hasOwn(input.home, 'loan'), false)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/features/onboarding/SurveyPage.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function setup(kind, failHome = false) {
  const user = { id: 'member-a', nickname: '검증회원', firstLogin: true }
  const calls = []
  const updates = []
  const viewStates = {
    3: '서울 마포구', 7: kind, 8: 'monthly', 9: false, 10: kind === 'jeonse',
    11: { birth: '1995-06-01', deposit: '10000000', rent: '550003', mgmtFee: '70000', contractFee: '20000000',
      loanAmount: '120000000', loanAnnualRate: '4', loanPaymentDay: '25', loanStartDate: '2026-11-01',
      income: '2500000', incomePaymentDay: '25' },
  }
  let stateIndex = 0
  const stores = {
    auth: { user, token: 'session-a', updateUser() {} },
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
    '@/lib/apiClient': { apiClient: { patch: async (_, input) => calls.push(['profile', input]) }, getErrorMessage: (error) => error.message },
    '@/features/life/homeApi': { saveHomeInfo: async (input) => {
      calls.push(['home', input])
      if (failHome) throw new Error('주거 계약 저장 실패')
    } },
  }
  const exports = {}
  vm.runInNewContext(source, { exports, AbortController, require: (id) => modules[id] ?? { default: {} } })
  const form = exports.SurveyPage().props.children[1].props.children
  return { calls, updates, submit: () => form.props.onSubmit({ preventDefault() {} }) }
}

test('서버 설문은 월세와 전세를 내 집 정보에 저장하고 생년월일과 수입은 각각의 API에 보낸다', async () => {
  for (const kind of ['monthly', 'jeonse']) {
    const s = setup(kind)
    await s.submit()
    assert.deepEqual(s.calls.map(([name]) => name), ['profile', 'salary', 'home'])
    assert.equal(s.calls[0][1].birth, '1995-06-01')
    assert.equal(s.calls[1][1].amount, 2500000)
    const home = s.calls[2][1]
    assert.equal(home.kind, kind)
    assert.equal(home.homeAddress, '서울 마포구')
    assert.equal(home.mgmtFee, 70000)
    assert.equal(home.rent, kind === 'monthly' ? 550003 : 0)
    assert.equal(home.loan?.principal ?? null, kind === 'jeonse' ? 120000000 : null)
    assert.ok(s.updates.some(([index, value]) => index === 1 && value === true))
  }
})

test('주거 계약 서버 저장 실패 시 설문이 완료 상태로 전환되지 않는다', async () => {
  const s = setup('jeonse', true)
  await s.submit()
  assert.ok(s.updates.some(([, value]) => value === '주거 계약 저장 실패'))
  assert.ok(!s.updates.some(([index, value]) => index === 1 && value === true))
})

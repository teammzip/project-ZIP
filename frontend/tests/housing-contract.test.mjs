import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const policy = {}
vm.runInNewContext(compile('../src/features/onboarding/housingContract.ts'), { exports: policy })
const date = {}
vm.runInNewContext(compile('../src/lib/date.ts'), { exports: date })
const interest = {}
vm.runInNewContext(compile('../src/features/loan/interest.ts'), { exports: interest })
const cssVars = {}
vm.runInNewContext(compile('../src/lib/cssVar.ts'), { exports: cssVars })
const payments = {}
vm.runInNewContext(compile('../src/features/life/payments.ts'), { exports: payments })
const currentMonth = date.todayStr().slice(0, 7)
const settings = { rent: 55, rentDay: 25, region: '서울 마포구', notiOn: true, moveIn: currentMonth, contractEnd: currentMonth }
const survey = { userId: 'member-a', kind: 'jeonse', contractFee: 20000000 }

function setup(kind) {
  const contract = { kind, isMonthly: kind === 'monthly', isJeonse: kind === 'jeonse', survey: { ...survey, kind } }
  const life = { settings, bills: [{ id: 1, name: '관리비', tag: '관리비', amount: 70000, paidMonth: null }], events: [], rentPaid: {}, saveSettings: () => {} }
  const loan = { plan: { id: 'loan-a', userId: 'member-a', active: true, principal: 120000000, annualRate: 4, paymentDay: 25, startDate: `${currentMonth}-01` }, charges: [] }
  const derivatives = {}
  const info = {}
  const loanFields = {}
  const lifeStore = (selector) => selector(life)
  lifeStore.getState = () => life
  const ui = {
    Card: ({ title, actions, children }) => React.createElement('article', null, React.createElement('h2', null, title), actions, children),
    Button: ({ children, type }) => React.createElement('button', { type }, children),
    AmountInput: ({ value }) => React.createElement('input', { value, readOnly: true }),
    Modal: ({ open, children }) => open ? React.createElement('div', null, children) : null,
  }
  const mocks = (name) => {
    if (name.endsWith('.module.css')) return { __esModule: true, default: {} }
    if (name === '@/components/ui') return ui
    if (name === '@/lib/date') return date
    if (name === '@/lib/cssVar') return cssVars
    if (name === '../payments') return payments
    if (name === './interest') return interest
    if (name === './MyInfo') return info
    if (name === '../ledgerCategories') return { useLedgerCategories: () => [{ name: '공과금' }, { name: '관리비' }] }
    if (name === '../useCategoryDrag') return { useCategoryDrag: () => () => ({}) }
    if (name === './LedgerCategoryDialog') return { LedgerCategoryDialog: () => null }
    if (name === '@/lib/useToday') return { useToday: () => new Date() }
    if (name === '@/lib/cx') return { cx: (...values) => values.filter(Boolean).join(' ') }
    if (name === '@/features/onboarding/useHousingContract') return { useHousingContract: () => contract }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (selector) => selector({ save: () => {} }) }
    if (name === '@/features/auth/store/authStore' || name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: { id: 'member-a' } }) }
    if (name === '../store' || name === './store') return { useLifeStore: lifeStore }
    if (name === '../types') return { BILL_TAGS: ['공과금', '관리비'] }
    if (name === './data/catalog') return { TRASH: [], trashIco: () => '🗑️' }
    if (name === './regionVerification') return { VERIFY_DAYS: 30 }
    if (name === '../derive') return derivatives
    if (name === '@/features/loan') return {
      ...interest,
      useLoanInterest: () => loan,
      useLoanStore: (selector) => selector({ savePlan: () => {}, stopPlan: () => {} }),
      ...loanFields,
      LoanInterestCard: () => React.createElement('p', null, '전세 대출 이자 설정'),
    }
    return require(name)
  }
  vm.runInNewContext(compile('../src/features/loan/LoanFields.tsx'), { exports: loanFields, require: mocks })
  vm.runInNewContext(compile('../src/features/life/derive.ts'), { exports: derivatives, require: mocks })
  const fixed = {}
  vm.runInNewContext(compile('../src/features/life/components/FixedExpense.tsx'), { exports: fixed, require: mocks })
  vm.runInNewContext(compile('../src/features/life/components/MyInfo.tsx'), { exports: info, require: mocks })
  const render = (Component) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component)))
  return { ...derivatives, fixed: () => render(fixed.FixedExpense), info: () => render(info.LifeInfoForm) }
}

test('현재 회원의 계약 유형을 우선하고 다른 회원의 설문을 표시하지 않는다', () => {
  assert.equal(policy.housingContractKind(survey, 'member-a'), 'jeonse')
  assert.equal(policy.housingContractKind({ ...survey, kind: 'monthly' }, 'member-a', true), 'monthly')
  assert.equal(policy.housingContractKind(survey, 'member-b'), 'monthly')
  assert.equal(policy.housingContractKind(null, 'member-a', true), 'jeonse')
})

test('월세 가계부는 월세만 표시하고 전세 대출 카드·이자 예정액은 표시하지 않는다', () => {
  const html = setup('monthly').fixed()
  assert.match(html, /월세 납부/)
  assert.match(html, /다음 월세/)
  assert.match(html, /620,000원/)
  assert.doesNotMatch(html, /전세|대출 이자/)
})

test('전세 가계부는 대출 설정을 표시하고 월세 금액·납부 체크·납부일을 숨긴다', () => {
  const html = setup('jeonse').fixed()
  assert.match(html, /전세 대출 이자 설정/)
  assert.match(html, /470,000원/)
  assert.doesNotMatch(html, /월세/)
  assert.match(html, /관리비/)
})

test('생활 정보도 계약 유형별 입력칸만 표시한다', () => {
  const monthly = setup('monthly').info()
  assert.match(monthly, /<option value="monthly" selected="">월세<\/option>/)
  assert.match(monthly, /월세 납부일/)
  assert.doesNotMatch(monthly, /전세 계약금|대출 금액 \(원\)|이자 납부일/)
  const jeonse = setup('jeonse').info()
  assert.match(jeonse, /<option value="jeonse" selected="">전세<\/option>/)
  assert.match(jeonse, /전세 계약금/)
  assert.match(jeonse, /전세 대출을 받았나요/)
  assert.match(jeonse, /대출 금액 \(원\)/)
  assert.match(jeonse, /이자 납부일/)
  assert.doesNotMatch(jeonse, /월세 납부일|월세 \(원\)|월세에 관리비/)
})

test('전세 알림에는 월세 납부 알림이 없다', () => {
  const ctx = setup('jeonse')
  assert.equal(ctx.buildNotis([], settings, 'jeonse').some((n) => n.id === 'n2'), false)
  assert.equal(ctx.buildNotis([], settings, 'monthly').some((n) => n.id === 'n2'), true)
})

test('전세는 남아 있는 예전 월세 설정을 집계하지 않고 실제 이자 내역은 보존한다', () => {
  const ctx = setup('jeonse')
  const charges = [{ date: `${currentMonth}-01`, amount: 400000 }]
  const total = ctx.spendBreakdown(0, [], [{ amount: 70000 }], settings, charges, 'jeonse')
  assert.equal(total.total, 470000)
  assert.equal(total.rows.some(([name]) => name === '월세'), false)
  assert.equal(total.rows.find(([name]) => name === '대출 이자')[1], 400000)
  assert.equal(charges.length, 1)
})

test('월세 계약은 이자 자동 기록을 실행하지 않고 전세 계약만 실행한다', () => {
  for (const kind of ['monthly', 'jeonse']) {
    const effects = []
    let count = 0
    let timers = 0
    const state = { plans: [], syncDue: () => { count++ } }
    const exports = {}
    vm.runInNewContext(compile('../src/features/loan/useLoanInterest.ts'), {
      exports,
      window: { setInterval: () => { timers++; return 1 }, addEventListener: () => {}, clearInterval: () => {}, removeEventListener: () => {} },
      document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
      require: (name) => {
        if (name === 'react') return { useEffect: (fn) => effects.push(fn) }
        if (name === '@/features/onboarding/useHousingContract') return { useHousingContract: () => ({ isJeonse: kind === 'jeonse' }) }
        if (name === '@/features/auth/store/authStore') return { useAuthStore: (selector) => selector({ user: { id: 'member-a' }, token: 'test-token' }) }
        if (name === './store') return { useLoanStore: (selector) => selector(state) }
        return require(name)
      },
    })
    exports.LoanInterestSync()
    effects.forEach((fn) => fn())
    assert.equal(count, kind === 'jeonse' ? 1 : 0)
    assert.equal(timers, kind === 'jeonse' ? 1 : 0)
  }
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const interestCode = compile('../src/features/loan/interest.ts')
const storeCode = compile('../src/features/loan/store.ts')
const member = { id: 'member-a', role: 'USER' }
const terms = { principal: 120000000, annualRate: 4, paymentDay: 25, startDate: '2026-10-01' }
const plan = { ...terms, id: 'loan-a', userId: member.id, active: true }

function setup(date = '2026-10-24', initialSaved = null) {
  let now = Date.parse(`${date}T00:00:00+09:00`)
  let auth = { user: member, token: 'test-token' }
  let saved = initialSaved
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const interest = {}
  vm.runInNewContext(interestCode, { exports: interest, Date: ClockDate })
  const exports = {}
  const authStore = { getState: () => auth }
  vm.runInNewContext(storeCode, {
    exports, crypto: { randomUUID },
    require: (name) => {
      if (name === './interest') return interest
      if (name === '@/features/auth/store/authStore') return { useAuthStore: authStore }
      if (name === 'zustand/middleware') return { persist: (initializer, options) => require(name).persist(initializer, {
        ...options, storage: {
          getItem: () => saved,
          setItem: (_key, value) => { saved = JSON.parse(JSON.stringify(value)) },
          removeItem: () => { saved = null },
        },
      }) }
      return require(name)
    },
  })
  const dateExports = {}
  vm.runInNewContext(compile('../src/lib/date.ts'), { exports: dateExports, Date: ClockDate })
  const derived = {}
  vm.runInNewContext(compile('../src/features/life/derive.ts'), {
    exports: derived, Date: ClockDate,
    require: (name) => {
      if (name === '@/lib/date') return dateExports
      if (name === './store') return {}
      if (name === './data/catalog') return {}
      if (name === './regionVerification') return { VERIFY_DAYS: 30 }
      if (name === '@/features/auth/store/authStore') return { useAuthStore: authStore }
      return require(name)
    },
  })
  return {
    ...interest, ...derived, store: exports.useLoanStore,
    advance: (next) => { now = Date.parse(`${next}T00:00:00+09:00`) },
    login: (user) => { auth = { user, token: user ? 'test-token' : null } },
    saved: () => saved,
  }
}

test('원금 유지형 월 이자 계산, 원 단위 반올림, 잘못된 조건 검증', () => {
  const ctx = setup()
  assert.equal(ctx.monthlyInterest(120000000, 4), 400000)
  assert.equal(ctx.monthlyInterest(100000000, 3.25), 270833)
  assert.equal(ctx.monthlyInterest(100000000, 0), 0)
  for (const invalid of [{ principal: -1 }, { principal: 0 }, { annualRate: NaN }, { annualRate: 101 }, { annualRate: 3.125 }, { paymentDay: 0 }, { paymentDay: 32 }, { startDate: '2026-02-30' }]) {
    assert.throws(() => ctx.validateLoanTerms({ ...terms, ...invalid }))
  }
})

test('납부일 전에는 미기록, 당일에는 한 번만 기록, 다음 실행 시 지난 달도 반영', () => {
  const ctx = setup()
  assert.equal(ctx.collectLoanCharges([plan], [], member.id, '2026-10-24').length, 0)
  const first = ctx.collectLoanCharges([plan], [], member.id, '2026-10-25')
  assert.equal(first.length, 1)
  assert.equal(first[0].date, '2026-10-25')
  assert.equal(first[0].amount, 400000)
  assert.equal(ctx.collectLoanCharges([plan], first, member.id, '2026-10-31').length, 0)
  const later = ctx.collectLoanCharges([plan], first, member.id, '2027-01-25')
  assert.equal(later.length, 3)
  assert.equal(later.at(-1).date, '2027-01-25')
})

test('31일이 없는 달·윤년·시작일 이후 첫 납부일을 처리한다', () => {
  const ctx = setup()
  assert.equal(ctx.loanPaymentDate('2027-02', 31), '2027-02-28')
  assert.equal(ctx.loanPaymentDate('2028-02', 31), '2028-02-29')
  assert.equal(ctx.loanPaymentDate('2026-11', 31), '2026-11-30')
  assert.equal(ctx.collectLoanCharges([{ ...plan, startDate: '2026-10-26' }], [], member.id, '2026-11-24').length, 0)
  assert.equal(ctx.collectLoanCharges([{ ...plan, startDate: '2026-10-26' }], [], member.id, '2026-11-25')[0].date, '2026-11-25')
  assert.equal(ctx.loanToday(Date.parse('2026-10-31T15:00:00Z')), '2026-11-01')
})

test('설정 저장·반복 동기화·새로고침 후에도 같은 달 중복 기록이 없다', () => {
  const ctx = setup('2026-10-25')
  ctx.store.getState().savePlan(terms)
  ctx.store.getState().syncDue()
  ctx.store.getState().syncDue()
  assert.equal(ctx.store.getState().charges.length, 1)
  const reloaded = setup('2026-10-31', ctx.saved())
  reloaded.store.getState().syncDue()
  assert.equal(reloaded.store.getState().charges.length, 1)
  reloaded.advance('2026-11-25')
  reloaded.store.getState().syncDue()
  assert.equal(reloaded.store.getState().charges.length, 2)
})

test('금리 변경 전 지난 이자는 이전 금리로 보존하고 다음 납부일부터 적용한다', () => {
  const ctx = setup('2026-10-01')
  ctx.store.getState().savePlan(terms)
  ctx.advance('2026-10-26')
  ctx.store.getState().savePlan({ ...terms, annualRate: 6, paymentDay: 20 })
  let charges = ctx.store.getState().charges
  assert.equal(charges.length, 1)
  assert.equal(charges[0].annualRate, 4)
  assert.equal(charges[0].amount, 400000)
  ctx.advance('2026-11-20')
  ctx.store.getState().syncDue()
  charges = ctx.store.getState().charges
  assert.equal(charges.length, 2)
  assert.equal(charges[1].date, '2026-11-20')
  assert.equal(charges[1].amount, 600000)
})

test('자동 기록을 중지하면 과거 기록은 유지하고 이후에는 추가하지 않는다', () => {
  const ctx = setup('2026-10-25')
  ctx.store.getState().savePlan(terms)
  ctx.store.getState().stopPlan()
  ctx.advance('2027-02-25')
  ctx.store.getState().syncDue()
  assert.equal(ctx.store.getState().charges.length, 1)
  assert.equal(ctx.store.getState().plans[0].active, false)
})

test('다른 회원의 납부를 생성하지 않고 회원별 초기화만 수행한다', () => {
  const ctx = setup('2026-10-25')
  ctx.store.getState().savePlan(terms)
  ctx.login({ id: 'member-b', role: 'USER' })
  ctx.store.getState().savePlan({ ...terms, principal: 60000000 })
  ctx.advance('2026-11-25')
  ctx.store.getState().syncDue()
  assert.equal(ctx.store.getState().charges.filter((q) => q.userId === member.id).length, 1)
  ctx.store.getState().resetCurrentUser()
  assert.equal(ctx.store.getState().plans.length, 1)
  assert.equal(ctx.store.getState().charges[0].userId, member.id)
  ctx.login(null)
  assert.throws(() => ctx.store.getState().savePlan(terms), /로그인/)
})

test('중지 후 다시 켜도 같은 달을 두 번 기록하거나 중지 기간을 소급하지 않는다', () => {
  const ctx = setup('2026-10-25')
  ctx.store.getState().savePlan(terms)
  ctx.store.getState().stopPlan()
  ctx.store.getState().savePlan({ ...terms, startDate: '2026-10-25' })
  assert.equal(ctx.store.getState().charges.length, 1)
  ctx.store.getState().stopPlan()
  ctx.advance('2027-01-01')
  ctx.store.getState().savePlan({ ...terms, startDate: '2027-01-01' })
  ctx.advance('2027-01-25')
  ctx.store.getState().syncDue()
  assert.equal(ctx.store.getState().charges.length, 2)
  assert.equal(ctx.store.getState().charges.at(-1).date, '2027-01-25')
})

test('예정액과 기록액을 구분하고 지출 구성에는 기록한 이자를 한 번만 합산한다', () => {
  const ctx = setup('2026-10-24')
  const pending = ctx.loanMonthSummary(plan, [], '2026-10')
  assert.equal(pending.expectedAmount, 400000)
  assert.equal(pending.recordedAmount, 0)
  const settings = { rent: 0 }
  assert.equal(ctx.spendBreakdown(0, [], [], settings, []).total, 0)
  const charges = ctx.collectLoanCharges([plan], [], member.id, '2026-10-25')
  const recorded = ctx.loanMonthSummary({ ...plan, annualRate: 6 }, charges, '2026-10')
  assert.equal(recorded.expectedAmount, 400000)
  assert.equal(recorded.recordedAmount, 400000)
  const totals = ctx.spendBreakdown(0, [{ date: '2026-10-01', cat: '식비', amount: 10000 }], [{ amount: 70000 }], settings, charges)
  assert.equal(totals.total, 480000)
  assert.equal(totals.fixed, 470000)
  assert.equal(totals.variable, 10000)
  assert.equal(ctx.spendBreakdown(1, [], [], settings, charges).total, 0)
})

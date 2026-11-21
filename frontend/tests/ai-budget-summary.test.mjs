import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, modules) {
  const exports = {}
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: (name) => modules[name] ?? {} })
  return exports
}

const derive = { sumAmount: (rows) => rows.reduce((sum, row) => sum + row.amount, 0) }
const { summarizeMonthlyBudget } = load('../src/features/life/monthlyBudget.ts', { './derive': derive })
const { incomeComparison, budgetSummaryText } = load('../src/features/ai/budgetSummary.ts', {
  '@/lib/date': { won: (amount) => amount.toLocaleString('ko-KR') + '원' },
})

test('수입 대비 지출 초과액과 지출이 큰 항목을 표시한다', () => {
  const budget = summarizeMonthlyBudget('2026-11', 1_000_000,
    [{ cat: '월세', amount: 850_000 }],
    [{ cat: '식비', amount: 120_000 }, { cat: '식비', amount: 80_000 }, { cat: '교통', amount: 50_000 }])
  assert.equal(budget.total, 1_100_000)
  assert.equal(JSON.stringify(budget.rows), JSON.stringify([['월세', 850_000], ['식비', 200_000], ['교통', 50_000]]))
  assert.match(budgetSummaryText(budget), /지출률 110%.*100,000원 더 썼어요/)
})

test('수입 범위 안에서는 남은 금액을 표시하고 수입이 없으면 초과 판단을 보류한다', () => {
  assert.match(incomeComparison(650_000, 1_000_000), /지출률 65%.*350,000원 남았어요/)
  assert.match(incomeComparison(100_000, 0), /수입 기록이 없어.*계산할 수 없어요/)
})

test('서버 모드에서 기록된 수입과 기타 지출에 납부한 고정 지출만 합산한다', async () => {
  const session = { user: { id: 'owner', address: '' }, token: 'demo-token' }
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)
  const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10)
  const key = today.slice(0, 7)
  const { loadMonthlyBudget } = load('../src/features/life/monthlyBudget.ts', {
    '@/features/auth/store/authStore': { useAuthStore: { getState: () => session } },
    '@/lib/apiMode': { isMockApi: false },
    './billingTimeZoneApi': { koreanAddressTimeZone: () => null },
    './store': { useLifeStore: { getState: () => ({ settings: {} }) } },
    './monthlyPeriod': { deviceTimeZone: () => 'UTC' },
    './derive': derive,
    './ledgerApi': {
      getIncomeSummary: async () => ({ [key]: 800_000 }),
      getLedger: async () => [
        { date: today, cat: '식비', amount: 120_000 },
        { date: tomorrow, cat: '식비', amount: 1_000_000 },
      ],
    },
    './billsApi': { readMonthlyBills: async () => ({
      housingItems: [{ paid: true, tag: '월세', amount: 700_000 }],
      items: [{ paid: false, tag: '공과금', amount: 50_000 }],
    }) },
  })
  const summary = await loadMonthlyBudget()
  assert.equal(summary.income, 800_000)
  assert.equal(summary.total, 820_000)
  assert.equal(summary.fixed, 700_000)
})

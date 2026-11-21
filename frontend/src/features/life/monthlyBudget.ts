import { useAuthStore } from '@/features/auth/store/authStore'
import { getHousingContractKind } from '@/features/onboarding/useHousingContract'
import { isMockApi } from '@/lib/apiMode'
import { koreanAddressTimeZone } from './billingTimeZoneApi'
import { readMonthlyBills } from './billsApi'
import { sumAmount } from './derive'
import { getIncomeSummary, getLedger } from './ledgerApi'
import { deviceTimeZone } from './monthlyPeriod'
import { billPaidInMonth } from './payments'
import { useLifeStore } from './store'

type Expense = { cat: string; amount: number }

function groupAmounts(entries: Expense[]): Array<[string, number]> {
  const totals = new Map<string, number>()
  for (const { cat, amount } of entries) totals.set(cat, (totals.get(cat) ?? 0) + amount)
  return [...totals].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])
}

export function summarizeMonthlyBudget(month: string, income: number, fixed: Expense[], variable: Expense[]) {
  const fixedTotal = sumAmount(fixed)
  return {
    month: Number(month.slice(5)),
    income,
    total: fixedTotal + sumAmount(variable),
    fixed: fixedTotal,
    rows: groupAmounts([...fixed, ...variable]).slice(0, 5),
    top: groupAmounts(variable)[0] ?? null,
  }
}

export async function loadMonthlyBudget() {
  const { user, token } = useAuthStore.getState()
  if (!user || !token) throw new Error('로그인 후 가계부를 조회해 주세요.')
  const { incomes, spends, bills, settings, rentPaid } = useLifeStore.getState()
  const timeZone = koreanAddressTimeZone(settings.homeAddresses?.[user.id] || user.address) ?? deviceTimeZone()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const month = today.slice(0, 7)
  const recorded = (entry: { date: string }) => entry.date.startsWith(month) && entry.date <= today

  if (isMockApi) {
    const fixed = bills.filter((bill) => billPaidInMonth(bill, month)).map((bill) => ({ cat: bill.tag, amount: bill.amount }))
    if (getHousingContractKind() === 'monthly' && rentPaid[month]) {
      fixed.push({ cat: '월세', amount: (Number(settings.rent) || 0) * 10000 })
    }
    return summarizeMonthlyBudget(month, sumAmount(incomes.filter(recorded)), fixed, spends.filter(recorded))
  }

  const [monthlyIncome, expenses, monthlyBills] = await Promise.all([
    getIncomeSummary(timeZone),
    getLedger('spend', month, timeZone),
    readMonthlyBills(month, timeZone),
  ])
  const current = useAuthStore.getState()
  if (current.user?.id !== user.id || current.token !== token) throw new Error('로그인 상태가 변경됐어요.')
  const fixed = [...(monthlyBills.housingItems ?? []), ...monthlyBills.items]
    .filter((bill) => bill.paid)
    .map((bill) => ({ cat: bill.tag, amount: bill.amount }))
  return summarizeMonthlyBudget(month, monthlyIncome[month] ?? 0, fixed, expenses.filter(recorded))
}

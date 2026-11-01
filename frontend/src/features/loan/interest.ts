export type LoanTerms = { principal: number; annualRate: number; paymentDay: number; startDate: string }
export type HousingLoan = LoanTerms & { id: string; userId: string; active: boolean }
export type LoanCharge = { id: string; loanId: string; userId: string; date: string; amount: number; principal: number; annualRate: number }

export const loanToday = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10)
export const monthlyInterest = (principal: number, annualRate: number) => Math.round(principal * annualRate / 1200)

export function validateLoanTerms(terms: LoanTerms): LoanTerms {
  const { principal, annualRate, paymentDay, startDate } = terms
  if (!Number.isSafeInteger(principal) || principal <= 0 || principal > 9999990000) throw new Error('대출 금액을 1~9,999,990,000원으로 입력해 주세요.')
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100 || Math.abs(annualRate * 100 - Math.round(annualRate * 100)) > 0.00001) throw new Error('연 이율을 0~100% 사이, 소수 둘째 자리까지 입력해 주세요.')
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) throw new Error('납부일을 1~31일로 입력해 주세요.')
  const date = new Date(`${startDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate || startDate < '2000-01-01' || startDate > '2100-12-31') throw new Error('기록 시작일을 올바르게 입력해 주세요.')
  return terms
}

/** 29~31일이 없는 달은 말일로 기록. 영업일 이동·일할 계산은 하지 않는다. */
export function loanPaymentDate(month: string, day: number) {
  const [year, number] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

/** 기존 기록은 금리 변경 후에도 보존하고, 회원·대출·월별로 한 번만 생성한다. */
export function collectLoanCharges(plans: HousingLoan[], recorded: LoanCharge[], userId: string, today = loanToday()): LoanCharge[] {
  const seen = new Set(recorded.map((record) => record.id))
  const added: LoanCharge[] = []
  for (const plan of plans) {
    if (!plan.active || plan.userId !== userId) continue
    validateLoanTerms(plan)
    const [year, month] = plan.startDate.slice(0, 7).split('-').map(Number)
    const end = Math.min(Number(today.slice(0, 4)), 2100) * 12 + Number(today.slice(5, 7)) - 1
    for (let index = year * 12 + month - 1; index <= end; index++) {
      const key = `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
      const date = loanPaymentDate(key, plan.paymentDay)
      const id = `${plan.id}:${key}`
      if (date < plan.startDate || date > today || seen.has(id)) continue
      added.push({ id, loanId: plan.id, userId, date, amount: monthlyInterest(plan.principal, plan.annualRate), principal: plan.principal, annualRate: plan.annualRate })
      seen.add(id)
    }
  }
  return added
}

export function loanMonthSummary(plan: HousingLoan | undefined, charges: LoanCharge[], month: string) {
  const records = charges.filter((record) => record.date.startsWith(month))
  const dueDate = plan ? loanPaymentDate(month, plan.paymentDay) : null
  const pending = !!(plan?.active && dueDate && dueDate >= plan.startDate && !records.some((record) => record.loanId === plan.id))
  const recordedAmount = records.reduce((sum, record) => sum + record.amount, 0)
  const pendingAmount = pending && plan ? monthlyInterest(plan.principal, plan.annualRate) : 0
  return { dueDate, recordedAmount, pendingAmount, expectedAmount: recordedAmount + pendingAmount, recordedCount: records.length, scheduledCount: records.length + Number(pending) }
}

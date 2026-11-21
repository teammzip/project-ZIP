import { won } from '@/lib/date'
import type { SpendCard } from './store'

export function incomeComparison(total: number, income: number) {
  if (income <= 0) return '이번 달 수입 기록이 없어 지출률과 초과 여부를 계산할 수 없어요.'
  const rate = (total / income * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
  const delta = income - total
  const balance = delta < 0 ? `수입보다 ${won(-delta)} 더 썼어요.` : `수입에서 ${won(delta)} 남았어요.`
  return `수입 대비 지출률 ${rate}% · ${balance}`
}

export function budgetSummaryText(summary: SpendCard & { income: number }) {
  const { month, income, total, rows } = summary
  return [
    `${month}월 수입·지출 요약`,
    `총수입 ${won(income)} · 총지출 ${won(total)}`,
    incomeComparison(total, income),
    ...(rows.length ? ['', '지출이 큰 항목', ...rows.map(([name, amount]) => `• ${name} ${won(amount)}`)] : []),
    '',
    '기록된 기타 지출과 납부 완료된 고정 지출 기준이에요.',
  ].join('\n')
}

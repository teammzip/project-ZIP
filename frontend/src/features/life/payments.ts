import type { Bill } from './types'

/** 기존 단일 월 기록도 읽되, 월별 기록에 저장된 체크 해제를 우선한다. */
export function billPaidInMonth(bill: Bill, month: string): boolean {
  return bill.paidMonths?.[month] ?? bill.paidMonth === month
}

export function updateBillPayment(bill: Bill, month: string, paid: boolean, currentMonth: string): Bill {
  const paidMonths = { ...(bill.paidMonth ? { [bill.paidMonth]: true } : {}), ...bill.paidMonths, [month]: paid }
  return { ...bill, paidMonths, paidMonth: paidMonths[currentMonth] ? currentMonth : null }
}

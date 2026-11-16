import { apiClient } from '@/lib/apiClient'

export type ServerBill = {
  id: string; name: string; tag: string; month: string
  amount: number; defaultAmount: number; paid: boolean; paidAt: string | null
  active: boolean; snapshot: boolean
}
export type MonthlyBills = {
  month: string; currentMonth: string; timeZone: string
  periodFrom: string; periodThrough: string; queriedAt: string
  items: ServerBill[]
}
export async function getMonthlyBills(month: string, timeZone: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<MonthlyBills>('/bills/monthly', { params: { month, timeZone }, signal })
  return data
}

import { apiClient } from '@/lib/apiClient'

export type ServerBill = {
  id: string; name: string; tag: string; month: string
  amount: number; defaultAmount: number; paid: boolean; paidAt: string | null
  active: boolean; snapshot: boolean; dueDate: string | null; memo: string
}
export type MonthlyBillInput = { name?: string; tag: string; amount: number; dueDate: string; memo?: string }
export async function registerMonthlyBill(month: string, timeZone: string, input: MonthlyBillInput) {
  return (await apiClient.post<ServerBill>('/bills/monthly', input, { params: { month, timeZone } })).data
}
export async function updateMonthlyBill(id: string, month: string, timeZone: string, input: Pick<MonthlyBillInput, 'amount' | 'dueDate' | 'memo'>) {
  return (await apiClient.patch<ServerBill>(`/bills/monthly/${id}`, input, { params: { month, timeZone } })).data
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

export async function deleteMonthlyBill(id: string, month: string, timeZone: string) {
  await apiClient.delete(`/bills/monthly/${id}`, { params: { month, timeZone } })
}

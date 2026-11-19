import { apiClient } from '@/lib/apiClient'

export type SalaryInput = { amount: number; incomePeriod: 'monthly' | 'annual'; paymentDay: number }
export type SalarySettings = SalaryInput & { monthlyAmount: number; startMonth: string }
export async function getSalary(signal?: AbortSignal) {
  return (await apiClient.get<SalarySettings>('/me/salary', { signal })).data
}
export async function saveSalary(input: SalaryInput, timeZone: string) {
  return (await apiClient.put<SalarySettings>('/me/salary', input, { params: { timeZone } })).data
}

import { apiClient } from '@/lib/apiClient'

export type LedgerKind = 'income' | 'spend'
export type LedgerRow = { id: string; amount: number; date: string; cat: string; memo: string; memoId?: string; memoTitle?: string; salaryManaged?: boolean; salaryCategory?: boolean }
export type LedgerInput = Omit<LedgerRow, 'id'> & { incomeType?: 'fixed' | 'other' }
export async function getLedger(kind: LedgerKind, month: string, timeZone: string, incomeType: 'fixed' | 'other' = 'fixed', signal?: AbortSignal) {
  return (await apiClient.get<LedgerRow[]>(`/ledger/${kind}`, { params: { month, timeZone, incomeType }, signal })).data
}
export async function saveLedger(kind: LedgerKind, timeZone: string, body: LedgerInput, id?: string) {
  if (id) await apiClient.put(`/ledger/${kind}/${id}`, body, { params: { timeZone } })
  else await apiClient.post(`/ledger/${kind}`, body, { params: { timeZone } })
}
export async function deleteLedger(kind: LedgerKind, id: string) { await apiClient.delete(`/ledger/${kind}/${id}`) }
export async function getIncomeSummary(timeZone: string, signal?: AbortSignal) { return (await apiClient.get<Record<string, number>>('/ledger/income-summary', { params: { timeZone }, signal })).data }

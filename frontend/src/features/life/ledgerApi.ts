import { apiClient } from '@/lib/apiClient'

export type LedgerKind = 'income' | 'spend'
type IncomeType = 'fixed' | 'other'
export type LedgerRow = { id: string; amount: number; date: string; cat: string; memo: string; memoId?: string; memoTitle?: string; salaryManaged: boolean; salaryCategory: boolean }
type LedgerWriteFields = { amount: number; date: string; cat: string; memo?: string; memoId?: string }
type LedgerWrite =
  | [kind: 'income', timeZone: string, body: LedgerWriteFields & { incomeType: IncomeType }, id?: string]
  | [kind: 'spend', timeZone: string, body: LedgerWriteFields & { incomeType?: never }, id?: string]

export async function getLedger(kind: LedgerKind, month: string, timeZone: string, incomeType: IncomeType = 'fixed', signal?: AbortSignal) {
  const params = { month, timeZone, ...(kind === 'income' ? { incomeType } : {}) }
  return (await apiClient.get<LedgerRow[]>(`/ledger/${kind}`, { params, signal })).data
}
export async function saveLedger(...[kind, timeZone, body, id]: LedgerWrite) {
  if (id) await apiClient.put(`/ledger/${kind}/${id}`, body, { params: { timeZone } })
  else await apiClient.post(`/ledger/${kind}`, body, { params: { timeZone } })
}
export async function deleteLedger(kind: LedgerKind, id: string) { await apiClient.delete(`/ledger/${kind}/${id}`) }
export async function getIncomeSummary(timeZone: string, signal?: AbortSignal) { return (await apiClient.get<Record<string, number>>('/ledger/income-summary', { params: { timeZone }, signal })).data }

export type LedgerMemoDraft = {
  key: string; owner: string; kind: 'income' | 'spend' | 'bill'; incomeType?: 'fixed' | 'other'; month?: string
  recordId?: string; label: string; returnTo: string; values: Record<string, string>; row?: unknown
  memoId?: string; memoTitle?: string
}
const prefix = 'zip-ledger-memo-draft:'
export function readMemoDraft(key: string | null, owner: string | undefined): LedgerMemoDraft | undefined {
  if (!key || !owner || typeof window === 'undefined') return
  try {
    const draft = JSON.parse(sessionStorage.getItem(prefix + key) ?? 'null') as LedgerMemoDraft | null
    if (draft?.owner === owner && draft.key === key && draft.returnTo.startsWith('/my/budget/')) return draft
  } catch { /* 다른 계정 또는 지워진 임시 입력은 사용하지 않는다. */ }
}
export function returnedMemoDraft(owner: string | undefined, kind: LedgerMemoDraft['kind'], incomeType?: string) {
  if (typeof window === 'undefined') return
  const draft = readMemoDraft(new URLSearchParams(window.location.search).get('memoReturn'), owner)
  return draft?.kind === kind && (!incomeType || draft.incomeType === incomeType) ? draft : undefined
}
export function writeMemoDraft(draft: LedgerMemoDraft) { sessionStorage.setItem(prefix + draft.key, JSON.stringify(draft)) }
export function clearMemoDraft(draft?: LedgerMemoDraft) { if (draft) sessionStorage.removeItem(prefix + draft.key) }
export function openLedgerMemo(input: Omit<LedgerMemoDraft, 'key' | 'returnTo'> & { key?: string }) {
  const key = input.key ?? crypto.randomUUID().replaceAll('-', '')
  const url = new URL(window.location.href)
  url.searchParams.delete('memoReturn')
  const draft = { ...input, key, returnTo: url.pathname + url.search }
  writeMemoDraft(draft)
  window.location.assign(`/my/memo?ledgerDraft=${key}`)
}

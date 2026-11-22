import { useMemoStore } from '@/features/memo/store'
import { isMockApi } from '@/lib/apiMode'
import { apiClient } from '@/lib/apiClient'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/authStore'
import { withoutMemoSync } from '@/features/memo/sync'

export type LedgerMemoDraft = {
  key: string; owner: string; kind: 'income' | 'spend' | 'bill'; incomeType?: 'fixed' | 'other'; month?: string
  recordId?: string; label: string; returnTo: string; values: Record<string, string>; row?: unknown
  memoId?: string; memoTitle?: string
  newMemo?: boolean
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
export function clearMemoDraft(draft?: LedgerMemoDraft) {
  if (!draft) return
  if (isMockApi && draft.memoId) useMemoStore.getState().update(Number(draft.memoId), { draft: false })
  sessionStorage.removeItem(prefix + draft.key)
}
export function openLedgerMemo(input: Omit<LedgerMemoDraft, 'key' | 'returnTo'> & { key?: string }) {
  const key = input.key ?? crypto.randomUUID().replaceAll('-', '')
  const url = new URL(window.location.href)
  url.searchParams.delete('memoReturn')
  const previous = readMemoDraft(key, input.owner)
  const draft = { ...input, newMemo: previous?.newMemo ?? !input.memoId, key, returnTo: url.pathname + url.search }
  writeMemoDraft(draft)
  window.location.assign(`/my/memo?ledgerDraft=${key}`)
}

const discarding = new Set<string>()
export async function discardMemoDraft(draft: LedgerMemoDraft) {
  if (discarding.has(draft.key)) return
  discarding.add(draft.key)
  try {
    if (!isMockApi) await apiClient.delete(`/memos/ledger-draft/${draft.key}`)
    if (useAuthStore.getState().user?.id !== draft.owner) return
    if (draft.newMemo && draft.memoId) withoutMemoSync(() => useMemoStore.getState().remove(Number(draft.memoId)))
    sessionStorage.removeItem(prefix + draft.key)
    window.dispatchEvent(new Event('zip-memos-refresh'))
  } finally { discarding.delete(draft.key) }
}

/** 작성 화면과 원래 가계부 사이에서는 유지하고, 기록 없이 벗어난 초안만 정리한다. */
export function useLedgerMemoCleanup() {
  const { pathname, search } = useLocation()
  const owner = useAuthStore((state) => state.user?.id)
  useEffect(() => {
    if (!owner) return
    const params = new URLSearchParams(search)
    for (const storageKey of Object.keys(sessionStorage)) {
      if (!storageKey.startsWith(prefix)) continue
      const draft = readMemoDraft(storageKey.slice(prefix.length), owner)
      if (!draft) continue
      const inMemo = pathname === '/my/memo' && params.get('ledgerDraft') === draft.key
      const inLedger = pathname === new URL(draft.returnTo, window.location.origin).pathname && params.get('memoReturn') === draft.key
      if (!inMemo && !inLedger) void discardMemoDraft(draft).catch(() => { /* 다음 화면 이동이나 재접속 시 재시도한다. */ })
    }
  }, [pathname, search, owner])
}

import { useMemoStore } from '@/features/memo/store'
import { isMockApi } from '@/lib/apiMode'
import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { Memo } from '@/features/memo'

export type LedgerMemoInput = Pick<Memo, 'title' | 'body' | 'color' | 'pinned' | 'checklist' | 'items' | 'folderId'>

export type LedgerMemoDraft = {
  key: string; owner: string; kind: 'income' | 'spend' | 'bill'; incomeType?: 'fixed' | 'other'; month?: string
  recordId?: string; label: string; returnTo: string; values: Record<string, string>; row?: unknown
  memoId?: string; memoTitle?: string
  newMemo?: boolean
  memoInput?: LedgerMemoInput
  memoPending?: boolean
  paused?: boolean
  updatedAt?: number
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
  return draft?.kind === kind && !draft.paused && (!incomeType || draft.incomeType === incomeType) ? draft : undefined
}
export function writeMemoDraft(draft: LedgerMemoDraft) {
  sessionStorage.setItem(prefix + draft.key, JSON.stringify({ ...draft, updatedAt: Date.now() }))
}

export function ledgerMemoDrafts(owner: string | undefined): LedgerMemoDraft[] {
  if (!owner || typeof window === 'undefined') return []
  try {
    return Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => readMemoDraft(key.slice(prefix.length), owner))
      .filter((draft): draft is LedgerMemoDraft => !!draft)
      .sort((first, second) => (second.updatedAt ?? 0) - (first.updatedAt ?? 0))
  } catch { return [] }
}

export const ledgerMemoPending = (draft: LedgerMemoDraft) => draft.memoPending ?? !draft.memoTitle

export function ledgerMemoReturnUrl(draft: LedgerMemoDraft) {
  const url = new URL(draft.returnTo, window.location.origin)
  url.searchParams.set('memoReturn', draft.key)
  return url.pathname + url.search
}

export function resumeLedgerMemoDraft(draft: LedgerMemoDraft) {
  writeMemoDraft({ ...draft, paused: false })
  window.location.assign(ledgerMemoPending(draft) ? `/my/memo?ledgerDraft=${draft.key}` : ledgerMemoReturnUrl(draft))
}

export function rememberLedgerMemoInput(draft: LedgerMemoDraft, { title, body, color, pinned, checklist, items, folderId }: LedgerMemoInput) {
  const latest = readMemoDraft(draft.key, draft.owner)
  if (!latest) return
  writeMemoDraft({ ...latest, memoPending: true, memoInput: { title, body, color, pinned, checklist, items, folderId } })
}

export function rememberLedgerValues(draft: LedgerMemoDraft | undefined, values: Record<string, string>) {
  if (!draft) return
  const latest = readMemoDraft(draft.key, draft.owner)
  if (latest && Object.entries(values).some(([field, value]) => latest.values[field] !== value)) {
    try { writeMemoDraft({ ...latest, values: { ...latest.values, ...values } }) }
    catch { /* 기존에 보관한 입력은 다음 저장 때까지 유지된다. */ }
  }
}
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
  const draft = { ...previous, ...input, newMemo: previous?.newMemo ?? !input.memoId, key, returnTo: url.pathname + url.search, memoPending: true }
  resumeLedgerMemoDraft(draft)
}

const discarding = new Set<string>()
export async function discardMemoDraft(draft: LedgerMemoDraft) {
  if (discarding.has(draft.key)) return
  discarding.add(draft.key)
  try {
    if (!isMockApi) await apiClient.delete(`/memos/ledger-draft/${draft.key}`)
    if (useAuthStore.getState().user?.id !== draft.owner) return
    if (isMockApi && draft.newMemo && draft.memoId) useMemoStore.getState().remove(Number(draft.memoId))
    sessionStorage.removeItem(prefix + draft.key)
    window.dispatchEvent(new Event('zip-memos-refresh'))
  } finally { discarding.delete(draft.key) }
}

export function isActiveLedgerMemoRoute(draft: LedgerMemoDraft, pathname: string, search: string) {
  const params = new URLSearchParams(search)
  return (pathname === '/my/memo' && params.get('ledgerDraft') === draft.key)
    || (pathname === new URL(draft.returnTo, window.location.origin).pathname && params.get('memoReturn') === draft.key)
}

export function pauseInactiveLedgerMemoDrafts(owner: string | undefined, pathname: string, search: string) {
  for (const draft of ledgerMemoDrafts(owner)) {
    if (draft.paused || isActiveLedgerMemoRoute(draft, pathname, search)) continue
    // 화면 이동 순서로 초안의 최근 편집 시각을 바꾸지 않는다.
    try { sessionStorage.setItem(prefix + draft.key, JSON.stringify({ ...draft, paused: true })) }
    catch { /* 저장 공간이 부족해도 다른 기능으로 이동할 수 있다. */ }
  }
}

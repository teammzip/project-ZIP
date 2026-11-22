import { MemoBoard, useMemoStore } from '@/features/memo'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { Button } from '@/components/ui'
import { readMemoDraft, writeMemoDraft } from '@/features/life/ledgerMemoNavigation'
import common from '@/styles/common.module.css'
import { isMockApi } from '@/lib/apiMode'
import { useSearchParams } from 'react-router-dom'

export function MemoPage() {
  const owner = useAuthStore((state) => state.user?.id)
  const [params] = useSearchParams()
  return <AccountMemoPage key={`${owner}:${params.get('ledgerDraft') ?? ''}`} owner={owner} />
}

function AccountMemoPage({ owner }: { owner?: string }) {
  const [, setParams] = useSearchParams()
  const [draft, setDraft] = useState(() => readMemoDraft(new URLSearchParams(window.location.search).get('ledgerDraft'), owner))
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(!draft)
  const memos = useMemoStore((state) => state.memos)
  const pending = useRef(false)
  useEffect(() => { window.dispatchEvent(new Event('zip-memos-refresh')) }, [])
  useEffect(() => {
    if (!draft) return
    let alive = true
    const prepare = async () => {
      try {
        let data: { id: string }
        if (isMockApi) {
          const existing = readMemoDraft(draft.key, owner)?.memoId
          const store = useMemoStore.getState()
          const folderName = draft.kind === 'bill' ? '고정 지출' : draft.kind === 'spend' ? '기타 지출' : draft.incomeType === 'other' ? '기타 수입' : '고정 수입'
          let folderId = store.folders.find((folder) => folder.name === folderName)?.id
          if (!existing && !folderId) {
            folderId = crypto.randomUUID()
            store.setFolders([...store.folders, { id: folderId, name: folderName }])
          }
          const id = existing ? Number(existing) : store.add('', false, folderId)
          if (!existing) useMemoStore.getState().update(id, { title: draft.label.slice(0, 60), ledgerContext: draft.label, draft: true })
          data = { id: String(id) }
        } else data = (await apiClient.post<{ id: string }>('/memos/ledger-draft', { key: draft.key, kind: draft.kind, incomeType: draft.incomeType, label: draft.label, memoId: draft.memoId })).data
        if (!alive) return
        writeMemoDraft({ ...draft, memoId: data.id })
        setDraft((previous) => previous?.memoId === data.id ? previous : previous ? { ...previous, memoId: data.id } : previous)
        setParams((previous) => { const next = new URLSearchParams(previous); next.set('id', data.id); return next }, { replace: true })
        window.dispatchEvent(new Event('zip-memos-refresh'))
        setReady(true)
      } catch (cause) { if (alive) setError(getErrorMessage(cause, '메모를 열지 못했어요.')) }
    }
    void prepare()
    return () => { alive = false }
  }, [draft, owner, setParams])
  const current = draft?.memoId ? memos.find((memo) => String(memo.id) === draft.memoId) : undefined
  const saveAction = draft ? <Button disabled={busy || !current || !ready} onClick={async () => {
      if (!current || pending.current) return
      pending.current = true; setBusy(true); setError('')
      try {
        if (!isMockApi) await apiClient.patch(`/memos/${draft.memoId}`, { title: current.title, body: current.body, color: current.color, pinned: current.pinned, checklist: current.checklist, items: current.items, folderId: current.folderId ?? '', complete: true })
        useMemoStore.getState().update(current.id, { draft: false })
        writeMemoDraft({ ...draft, memoTitle: current.title.trim() || '제목 없는 메모' })
        const url = new URL(draft.returnTo, window.location.origin); url.searchParams.set('memoReturn', draft.key)
        window.location.assign(url.pathname + url.search)
      } catch (cause) { setError(getErrorMessage(cause, '메모를 저장하지 못했어요.')) }
      finally { pending.current = false; setBusy(false) }
    }}>{busy ? '저장 중' : '저장'}</Button> : undefined
  return <div className={common.stack}>
    {error && <p role="alert">{error}</p>}
    {ready && (!draft || current) ? <MemoBoard editableLedgerMemoId={draft?.memoId} saveAction={saveAction} /> : <p role="status">메모를 여는 중이에요.</p>}
  </div>
}

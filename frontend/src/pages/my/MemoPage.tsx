import { MemoBoard, useMemoStore, type Memo } from '@/features/memo'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { ledgerMemoReturnUrl, prepareLedgerMemo, readMemoDraft, rememberLedgerMemoInput, writeMemoDraft } from '@/features/life/ledgerMemoNavigation'
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
  const [error, setError] = useState(''), [ready, setReady] = useState(!draft)
  const [restored, setRestored] = useState(!draft?.memoInput)
  const memos = useMemoStore((state) => state.memos)
  useEffect(() => { window.dispatchEvent(new Event('zip-memos-refresh')) }, [])
  useEffect(() => {
    if (!draft || draft.paused) return
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
        } else data = await prepareLedgerMemo(draft)
        if (!alive) return
        const latest = readMemoDraft(draft.key, owner)
        if (!latest) return
        if (latest.memoId !== data.id) writeMemoDraft({ ...latest, memoId: data.id })
        setDraft((previous) => previous?.memoId === data.id ? previous : previous ? { ...previous, memoId: data.id } : previous)
        if (new URLSearchParams(window.location.search).get('id') !== data.id) {
          setParams((previous) => { const next = new URLSearchParams(previous); next.set('id', data.id); return next }, { replace: true })
        }
        window.dispatchEvent(new Event('zip-memos-refresh'))
        setReady(true)
      } catch (cause) { if (alive) setError(getErrorMessage(cause, '메모를 열지 못했어요.')) }
    }
    void prepare()
    return () => { alive = false }
  }, [draft, owner, setParams])
  const current = draft?.memoId ? memos.find((memo) => String(memo.id) === draft.memoId) : undefined
  const memoId = current?.id
  useEffect(() => {
    if (restored || memoId === undefined || !draft?.memoInput) return
    useMemoStore.getState().update(memoId, draft.memoInput)
    setRestored(true)
  }, [draft, memoId, restored])
  const returnToLedger = draft ? (saved: Memo) => {
    try {
      const latest = readMemoDraft(draft.key, owner)
      if (!latest) return
      writeMemoDraft({ ...latest, memoInput: undefined, memoPending: false, memoTitle: saved.title.trim() || '제목 없는 메모' })
      if (window.location.pathname === '/my/memo' && new URLSearchParams(window.location.search).get('ledgerDraft') === draft.key) {
        window.location.assign(ledgerMemoReturnUrl(draft))
      }
    } catch {
      throw new Error('메모는 저장했지만 가계부로 돌아가지 못했어요. 다시 저장을 눌러 주세요.')
    }
  } : undefined
  return <div className={common.stack}>
    {error && <p role="alert">{error}</p>}
    {ready && restored && (!draft || current)
      ? <MemoBoard editableLedgerMemoId={draft?.memoId} onLedgerMemoSaved={returnToLedger} onLedgerMemoEdit={draft ? (memo) => rememberLedgerMemoInput(draft, memo) : undefined} />
      : <p role="status">메모를 여는 중이에요.</p>}
  </div>
}

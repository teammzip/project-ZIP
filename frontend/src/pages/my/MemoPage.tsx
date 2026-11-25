import { MemoBoard, useMemoStore, type Memo } from '@/features/memo'
import { useEffect, useEffectEvent, useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { ledgerMemoReturnUrl, prepareLedgerMemo, readMemoDraft, rememberLedgerMemoInput, writeMemoDraft } from '@/features/life/ledgerMemoNavigation'
import common from '@/styles/common.module.css'
import { isMockApi } from '@/lib/apiMode'
import { useSearchParams } from 'react-router-dom'

export function MemoPage() {
  const owner = useAuthStore((state) => state.user?.id)
  const [params] = useSearchParams()
  const draftKey = params.get('ledgerDraft')
  return <AccountMemoPage key={`${owner}:${draftKey ?? ''}`} owner={owner} draftKey={draftKey} />
}

function AccountMemoPage({ owner, draftKey }: { owner?: string; draftKey: string | null }) {
  const [params, setParams] = useSearchParams()
  const [draft] = useState(() => readMemoDraft(draftKey, owner))
  const [error, setError] = useState('')
  const [memoId, setMemoId] = useState<string>()
  const memoExists = useMemoStore((state) => !!memoId && state.memos.some((memo) => String(memo.id) === memoId))
  const openMemo = useEffectEvent((id: string) => {
    if (params.get('id') === id) return
    const next = new URLSearchParams(params)
    next.set('id', id)
    setParams(next, { replace: true })
  })
  useEffect(() => { window.dispatchEvent(new Event('zip-memos-refresh')) }, [])
  useEffect(() => {
    if (!draft || draft.paused) return
    let alive = true
    let stopWaiting: (() => void) | undefined
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
        if (!alive || useAuthStore.getState().user?.id !== owner) return
        const latest = readMemoDraft(draft.key, owner)
        if (!latest) return
        if (latest.memoId !== data.id) writeMemoDraft({ ...latest, memoId: data.id })
        const memo = await new Promise<Memo | undefined>((resolve) => {
          const check = ({ memos }: ReturnType<typeof useMemoStore.getState>) => {
            const found = memos.find((entry) => String(entry.id) === data.id)
            if (!found) return
            unsubscribe()
            resolve(found)
          }
          const unsubscribe = useMemoStore.subscribe(check)
          stopWaiting = () => {
            unsubscribe()
            resolve(undefined)
          }
          check(useMemoStore.getState())
          window.dispatchEvent(new Event('zip-memos-refresh'))
        })
        if (!alive || !memo || useAuthStore.getState().user?.id !== owner) return
        // 목록 동기화가 스토어 쓰기를 마친 뒤 보관한 입력을 복구한다.
        if (latest.memoInput) useMemoStore.getState().update(memo.id, latest.memoInput)
        openMemo(data.id)
        setMemoId(data.id)
      } catch (cause) { if (alive) setError(getErrorMessage(cause, '메모를 열지 못했어요.')) }
    }
    void prepare()
    return () => {
      alive = false
      stopWaiting?.()
    }
  }, [draft, owner])
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
    {(!draft || memoExists)
      ? <MemoBoard editableLedgerMemoId={memoId} onLedgerMemoSaved={returnToLedger} onLedgerMemoEdit={draft ? (memo) => rememberLedgerMemoInput(draft, memo) : undefined} />
      : <p role="status">메모를 여는 중이에요.</p>}
  </div>
}

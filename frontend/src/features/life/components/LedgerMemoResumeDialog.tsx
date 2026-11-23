import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import common from '@/styles/common.module.css'
import {
  discardMemoDraft, isActiveLedgerMemoRoute, ledgerMemoDrafts, ledgerMemoPending,
  pauseInactiveLedgerMemoDrafts, resumeLedgerMemoDraft,
} from '../ledgerMemoNavigation'

export function LedgerMemoResumeDialog() {
  const owner = useAuthStore((state) => state.user?.id)
  const location = useLocation()
  return <ResumePrompt key={`${owner}:${location.key}`} owner={owner} />
}

function ResumePrompt({ owner }: { owner?: string }) {
  const { pathname, search, state } = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(search)
  const hasDraftLink = params.has('ledgerDraft') || params.has('memoReturn')
  const draft = ledgerMemoDrafts(owner).find((entry) => {
    if (hasDraftLink) return entry.paused && isActiveLedgerMemoRoute(entry, pathname, search)
    if (pathname === '/my/memo') return !params.has('id') && !params.has('compose') && ledgerMemoPending(entry)
    return pathname === new URL(entry.returnTo, window.location.origin).pathname
  })
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  useEffect(() => pauseInactiveLedgerMemoDrafts(owner, pathname, search), [owner, pathname, search])

  if (!draft || dismissed || state?.skipLedgerMemoPrompt) return null

  const close = () => {
    if (pending.current) return
    setDismissed(true)
    if (hasDraftLink) {
      const clean = new URLSearchParams(search)
      clean.delete('ledgerDraft')
      clean.delete('memoReturn')
      if (pathname === '/my/memo') clean.delete('id')
      navigate({ pathname, search: clean.toString() }, { replace: true, state: { skipLedgerMemoPrompt: true } })
    }
  }

  const discard = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await discardMemoDraft(draft)
    } catch (cause) {
      setError(getErrorMessage(cause, '작성 중인 내용을 지우지 못했어요. 다시 시도해 주세요.'))
      return
    } finally {
      pending.current = false
      setBusy(false)
    }
    close()
  }

  return <Modal open onClose={close} title="이어서 작성할까요?" dismissible={!busy}>
    <div className={common.stack}>
      <h3>이어서 작성할까요?</h3>
      <p>작성 중인 내용이 있어요. {draft.label}</p>
      {error && <p role="alert">{error}</p>}
      <div className={common.actions}>
        <Button onClick={() => {
          try { resumeLedgerMemoDraft(draft) }
          catch (cause) { setError(getErrorMessage(cause, '작성 중인 내용을 열지 못했어요.')) }
        }} disabled={busy}>이어서 작성</Button>
        <Button variant="line" onClick={close} disabled={busy}>나중에</Button>
        <Button variant="danger" onClick={() => void discard()} disabled={busy}>{busy ? '지우는 중' : '임시 입력 지우기'}</Button>
      </div>
    </div>
  </Modal>
}

import { useRef, useState, type FormEvent } from 'react'
import { Button, Modal } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import common from '@/styles/common.module.css'
import { useLedgerCategorySettings, type LedgerScope } from '../ledgerCategories'

type Props = {
  scope: LedgerScope
  onClose: () => void
  onAdded: (name: string) => void
  onRenamed?: (oldName: string, newName: string) => void
}

export function LedgerCategoryDialog({ scope, onClose, onAdded, onRenamed }: Props) {
  const { categories, loading, failed, retry, change } = useLedgerCategorySettings(scope)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const run = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await work() }
    catch (cause) { setError(getErrorMessage(cause, cause instanceof Error && cause.name === 'Error' ? cause.message : '카테고리를 저장하지 못했어요.')) }
    finally { pending.current = false; setBusy(false) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized) return
    void run(async () => {
      if (editing) {
        await change({ action: 'rename', name: editing, target: normalized })
        onRenamed?.(editing, normalized)
      } else {
        await change({ action: 'add', name: normalized })
        onAdded(normalized)
        onClose()
      }
      setEditing(undefined)
      setName('')
    })
  }

  return <Modal open onClose={onClose} title="카테고리 관리" dismissible={!busy}>
    <div className={common.stack}>
      <h3>카테고리 관리</h3>
      {loading ? <p role="status">카테고리를 불러오는 중이에요.</p> : failed ? (
        <div role="alert">카테고리를 불러오지 못했어요. <Button variant="line" onClick={() => void retry()}>다시 조회</Button></div>
      ) : <>
        <p className={common.note}>이름을 바꾸면 기존 거래의 분류명도 바뀌어요. 카테고리를 삭제해도 기존 거래는 남아요.</p>
        {categories.length > 0 ? <ol className={common.stack} aria-label="카테고리 표시 순서">
          {categories.map(({ name: category }, index) => <li key={category}>
            <b>{category}</b>
            <div className={common.actions}>
              <Button variant="line" disabled={busy || index === 0} aria-label={category + ' 위로 이동'} onClick={() => void run(() => change({ action: 'move', name: category, target: categories[index - 1].name }))}>↑</Button>
              <Button variant="line" disabled={busy || index === categories.length - 1} aria-label={category + ' 아래로 이동'} onClick={() => void run(() => change({ action: 'move', name: category, target: categories[index + 1].name }))}>↓</Button>
              <Button variant="line" disabled={busy} aria-label={category + ' 이름 수정'} onClick={() => { setEditing(category); setName(category); setError('') }}>수정</Button>
              <Button variant="line" disabled={busy} aria-label={category + ' 삭제'} onClick={() => {
                if (!window.confirm(`‘${category}’ 카테고리를 삭제할까요?`)) return
                void run(async () => {
                  await change({ action: 'delete', name: category })
                  if (editing === category) { setEditing(undefined); setName('') }
                })
              }}>삭제</Button>
            </div>
          </li>)}
        </ol> : <p>등록된 카테고리가 없어요.</p>}
        <form className={common.form} onSubmit={submit}>
          <label>{editing ? '카테고리 이름 수정' : '새 카테고리 이름'}<input value={name} onChange={(event) => { setName(event.target.value); setError('') }} maxLength={24} placeholder="예) 반려동물, 장학금" required disabled={busy} /></label>
          <div className={common.actions}>
            <Button type="submit" disabled={busy || !name.trim()}>{editing ? '이름 저장' : '추가'}</Button>
            {editing && <Button variant="line" disabled={busy} onClick={() => { setEditing(undefined); setName(''); setError('') }}>수정 취소</Button>}
          </div>
        </form>
      </>}
      {error && <p className={common.formError} role="alert">{error}</p>}
    </div>
  </Modal>
}

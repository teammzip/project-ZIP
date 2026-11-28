import { useState, type ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Button, Modal } from '@/components/ui'
import { isMockApi } from '@/lib/apiMode'
import { cx } from '@/lib/cx'
import type { SyncId } from '@/lib/listSync'
import { saveRejection, type createSaveRecovery } from '@/lib/saveRecovery'
import styles from './SaveRecovery.module.css'

type Props<T extends { id: SyncId }> = {
  name: string
  className?: string
  store: ReturnType<typeof createSaveRecovery<T>>
  titleOf: (item: T) => string
  retry: (item: T, target: SyncId | null) => Promise<void>
  renderEditor: (item: T, change: (patch: Partial<T>) => void, saving: boolean) => ReactNode
}

export function SaveRecovery<T extends { id: SyncId }>(props: Props<T>) {
  const session = useAuthStore((s) => s.sessionKey)
  return !isMockApi && session && <AccountSaveRecovery key={session} {...props} session={session} />
}

function AccountSaveRecovery<T extends { id: SyncId }>({ name, className, store, titleOf, retry, renderEditor, session }: Props<T> & { session: string }) {
  const drafts = store.useStore((s) => s.drafts)
  const saving = store.useStore((s) => !!s.saving)
  const [selected, setSelected] = useState<string | null>(null)
  const draft = drafts.find((entry) => entry.key === selected)
  const close = () => setSelected(null)

  const save = async () => {
    if (!draft || useAuthStore.getState().sessionKey !== session || !store.begin(draft)) return
    const target = draft.missing ? null : draft.target
    try {
      await retry(draft.item, target)
      if (useAuthStore.getState().sessionKey === session && store.useStore.getState().drafts.includes(draft)) {
        store.discard(draft.key)
        close()
      }
    } catch (error) {
      if (useAuthStore.getState().sessionKey === session && store.useStore.getState().drafts.includes(draft)) {
        const failure = saveRejection(error)
        store.put({ ...draft, message: failure.message, missing: draft.missing || failure.missing })
      }
    } finally {
      store.finish(draft)
    }
  }

  if (!drafts.length) return null
  return (
    <section className={cx(styles.recovery, className)} aria-label={`저장하지 못한 ${name}`}>
      <h3 role="status">저장하지 못한 {name} {drafts.length}개</h3>
      <ul>
        {drafts.map((entry) => (
          <li key={entry.key}>
            <strong>{titleOf(entry.item)}</strong>
            <p>{entry.message}</p>
            <Button variant="line" disabled={saving} onClick={() => setSelected(entry.key)}>초안 열기<span className="sr-only"> · {titleOf(entry.item)}</span></Button>
          </li>
        ))}
      </ul>
      <Modal open={!!draft} onClose={close} title={`${name} 초안 복구`} dismissible={!saving}>
        {draft && <div className={styles.dialog}>
          <h3>{name} 초안 복구</h3>
          <p role="alert">{draft.message}</p>
          {renderEditor(draft.item, (patch) => {
            if (!saving && useAuthStore.getState().sessionKey === session) store.put({ ...draft, item: { ...draft.item, ...patch } })
          }, saving)}
          <div className={styles.actions}>
            <Button variant="line" disabled={saving} onClick={close}>나중에</Button>
            <Button variant="danger" disabled={saving} onClick={() => { store.discard(draft.key); close() }}>초안 삭제</Button>
            <Button loading={saving} onClick={() => void save()}>{draft.missing && draft.target !== null ? '새 항목으로 저장' : '다시 저장'}</Button>
          </div>
        </div>}
      </Modal>
    </section>
  )
}

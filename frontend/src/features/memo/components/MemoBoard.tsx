import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { cx } from '@/lib/cx'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useToday } from '@/lib/useToday'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { MEMO_COLORS } from '../constants'
import { colorOf, previewLines, searchText, sortMemos, titleOf, whenText } from '../lib'
import { useMemoStore } from '../store'
import type { Memo } from '../types'
import styles from './Memo.module.css'

/** 메모장: PC 는 왼쪽 목록 | 오른쪽 쓰기, 모바일은 목록 → 누르면 쓰기 화면.
 * 열린 메모는 주소의 ?id= 로 정해서 홈 위젯에서 바로 열 수 있음. 쓰는 대로 자동 저장 */
export function MemoBoard({ editableLedgerMemoId, saveAction }: { editableLedgerMemoId?: string; saveAction?: ReactNode } = {}) {
  const memos = useMemoStore((s) => s.memos)
  const add = useMemoStore((s) => s.add)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const composing = useRef(false)
  useEffect(() => {
    if (params.get('compose') !== '1' || composing.current) return
    composing.current = true
    const id = add()
    setParams({ id: String(id) }, { replace: true })
  }, [params, setParams, add])
  const isMobile = useMediaQuery('(max-width: 900px)')
  const now = useToday().getTime()

  const sorted = sortMemos(memos)
  const asked = Number(params.get('id')) || null
  // PC 는 고른 메모가 없으면 맨 위 메모를 바로 보여 줌, 모바일은 목록부터
  const current = editableLedgerMemoId
    ? memos.find((m) => String(m.id) === editableLedgerMemoId)
    : memos.find((m) => m.id === asked) ?? (isMobile ? undefined : sorted[0])
  const open = (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('id', String(id)); else next.delete('id')
    setParams(next, { replace: true })
  }

  const q = query.trim().toLowerCase()
  const list = q ? sorted.filter((m) => searchText(m).includes(q)) : sorted

  return (
    <div className={cx(styles.app, !!asked && !!current && styles.editing)}>
      <aside className={styles.side}>
        <div className={styles.sideHead}>
          <h2>
            메모 <small>{memos.length}개</small>
          </h2>
          <Button
            onClick={() => {
              setQuery('')
              open(add())
            }}
          >
            + 새 메모
          </Button>
        </div>
        <input type="search" className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="메모 검색" aria-label="메모 검색" />
        <div className={styles.list}>
          {list.length === 0 && <p className={styles.none}>{q ? '찾는 메모가 없어요.' : '아직 메모가 없어요. 새 메모를 만들어 보세요.'}</p>}
          {list.map((m) => {
            const c = colorOf(m.color)
            const preview = previewLines(m, (d) => (d ? '✓ ' : '· ')).join('  ')
            return (
              <button
                key={m.id}
                type="button"
                className={cx(styles.item, current?.id === m.id && styles.on)}
                style={{ '--memo-bg': c.bg, '--memo-line': c.line } as CSSProperties}
                onClick={() => open(m.id)}
              >
                <span className={styles.itemTop}>
                  <b>
                    {m.pinned && '📌 '}
                    {titleOf(m)}
                  </b>
                  <time>{whenText(m.updatedAt, now)}</time>
                </span>
                {preview && <small>{preview}</small>}
                {m.ledgerContext && <small>가계부 · {m.ledgerContext}</small>}
                {m.checklist && m.items.length > 0 && (
                  <span className={styles.progress}>
                    {m.items.filter((i) => i.done).length} / {m.items.length} 완료
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      <section className={styles.editor} style={current ? ({ '--memo-bg': colorOf(current.color).bg } as CSSProperties) : undefined} aria-label="메모 쓰기">
        {current?.ledgerContext && !editableLedgerMemoId && <p>가계부 · {current.ledgerContext}</p>}
        {current ? (
          <MemoEditor key={current.id} memo={current} onBack={() => open(null)} onDeleted={() => open(null)} saveAction={saveAction} />
        ) : (
          <div className={styles.empty}>
            <span aria-hidden="true">📝</span>
            <b>메모를 골라 보세요</b>
            <p>왼쪽 목록에서 메모를 누르거나 새 메모를 만들어요.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function MemoEditor({ memo, onBack, onDeleted, saveAction }: { memo: Memo; onBack: () => void; onDeleted: () => void; saveAction?: ReactNode }) {
  const update = useMemoStore((s) => s.update)
  const remove = useMemoStore((s) => s.remove)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const pendingSave = useRef(false)
  const itemRefs = useRef<Array<HTMLInputElement | null>>([])
  const now = useToday().getTime()
  const set = (patch: Partial<Memo>) => { setSaved(false); update(memo.id, patch) }
  const save = async () => {
    if (pendingSave.current) return
    pendingSave.current = true; setSaving(true); setSaveError(''); setSaved(false)
    try {
      if (!isMockApi) await apiClient.patch(`/memos/${memo.id}`, { title: memo.title, body: memo.body, color: memo.color, pinned: memo.pinned, checklist: memo.checklist, items: memo.items })
      setSaved(true)
    } catch (cause) { setSaveError(getErrorMessage(cause, '메모를 저장하지 못했어요.')) }
    finally { pendingSave.current = false; setSaving(false) }
  }

  // 항목을 더하거나 지운 뒤 그 줄에 커서를 옮김 (다시 그려진 다음에)
  const setItems = (items: Memo['items'], focus?: number) => {
    set({ items })
    if (focus != null) requestAnimationFrame(() => itemRefs.current[focus]?.focus())
  }

  const toggleChecklist = () => {
    if (memo.checklist) set({ checklist: false, body: memo.items.map((i) => i.text).filter(Boolean).join('\n') })
    else {
      const items = memo.body
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text, done: false }))
      set({ checklist: true, items: items.length ? items : [{ text: '', done: false }] })
    }
  }

  return (
    <div className={styles.edit}>
      <div className={styles.tools}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="목록으로">
          ‹ 목록
        </button>
        <div className={styles.colors} role="group" aria-label="메모 색">
          {MEMO_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={cx(styles.color, memo.color === c.name && styles.colorOn)}
              style={{ background: c.bg, borderColor: c.line }}
              aria-label={c.name}
              aria-pressed={memo.color === c.name}
              onClick={() => set({ color: c.name })}
            />
          ))}
        </div>
        <span className={styles.grow} />
        <button type="button" className={styles.tool} aria-pressed={memo.pinned} onClick={() => set({ pinned: !memo.pinned })} title="맨 위에 고정">
          📌 <span>고정</span>
        </button>
        <button type="button" className={styles.tool} aria-pressed={memo.checklist} onClick={toggleChecklist} title="체크리스트로 바꾸기">
          ☑️ <span>{memo.checklist ? '글로 바꾸기' : '체크리스트'}</span>
        </button>
        <button type="button" className={cx(styles.tool, styles.danger)} onClick={() => setConfirmDel(true)} title="메모 삭제">
          🗑️ <span>삭제</span>
        </button>
        {saveAction ?? (memo.ledgerContext ? <Button disabled={saving} onClick={() => void save()}>{saving ? '저장 중' : '저장'}</Button> : null)}
      </div>
      {saveError && <p role="alert">{saveError}</p>}
      {saved && <p role="status">저장했어요.</p>}

      <input className={styles.title} value={memo.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="제목" aria-label="메모 제목" />

      {memo.checklist ? (
        <div className={styles.items}>
          {memo.items.map((it, i) => (
            <div key={i} className={cx(styles.checkRow, it.done && styles.done)}>
              <input
                type="checkbox"
                checked={it.done}
                aria-label={`${it.text || '항목'} 완료`}
                onChange={(e) => setItems(memo.items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
              />
              <input
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                className={styles.checkText}
                value={it.text}
                maxLength={100}
                placeholder="할 일"
                onChange={(e) => setItems(memo.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    setItems([...memo.items.slice(0, i + 1), { text: '', done: false }, ...memo.items.slice(i + 1)], i + 1)
                  }
                  if (e.key === 'Backspace' && !it.text && memo.items.length > 1) {
                    e.preventDefault()
                    setItems(
                      memo.items.filter((_, j) => j !== i),
                      Math.max(0, i - 1),
                    )
                  }
                }}
              />
              <button type="button" className={styles.checkX} aria-label="항목 지우기" onClick={() => setItems(memo.items.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className={styles.checkAdd} onClick={() => setItems([...memo.items, { text: '', done: false }], memo.items.length)}>
            + 항목 추가
          </button>
        </div>
      ) : (
        <textarea className={styles.body} value={memo.body} onChange={(e) => set({ body: e.target.value })} maxLength={5000} placeholder="내용을 적어 보세요" aria-label="메모 내용" />
      )}

      <p className={styles.saved} aria-live="polite">
        자동 저장됨 · {whenText(memo.updatedAt, now)}
      </p>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="메모 삭제" className={styles.confirm}>
        <h3>메모를 지울까요?</h3>
        <p>“{titleOf(memo)}” 메모를 지우면 되돌릴 수 없어요.</p>
        <div className={styles.confirmActions}>
          <Button variant="line" onClick={() => setConfirmDel(false)}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              remove(memo.id)
              setConfirmDel(false)
              onDeleted()
            }}
          >
            지우기
          </Button>
        </div>
      </Modal>
    </div>
  )
}

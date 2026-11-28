import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { SaveRecovery } from '@/components/SaveRecovery'
import { cx } from '@/lib/cx'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useToday } from '@/lib/useToday'
import { getErrorMessage } from '@/lib/apiClient'
import { MEMO_COLORS } from '../constants'
import { colorOf, previewLines, searchText, sortMemos, titleOf, whenText } from '../lib'
import { useMemoStore } from '../store'
import { completeLedgerMemo, memoRecovery, retryMemoDraft } from '../sync'
import type { Memo, MemoFolder } from '../types'
import { useMemoFolders } from '../folders'
import styles from './Memo.module.css'

/** 메모장: PC 는 왼쪽 목록 | 오른쪽 쓰기, 모바일은 목록 → 누르면 쓰기 화면.
 * 열린 메모는 주소의 ?id= 로 정해서 홈 위젯에서 바로 열 수 있음. 쓰는 대로 자동 저장 */
export function MemoBoard({ editableLedgerMemoId, onLedgerMemoSaved, onLedgerMemoEdit }: {
  editableLedgerMemoId?: string
  onLedgerMemoSaved?: (memo: Memo) => void
  onLedgerMemoEdit?: (memo: Memo) => void
} = {}) {
  const memos = useMemoStore((s) => s.memos)
  const add = useMemoStore((s) => s.add)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('all')
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const selectedMemos = memos.filter((memo) => selectedIds.includes(memo.id))
  const toggleSelected = (id: number) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])
  const cancelSelection = () => { setSelecting(false); setSelectedIds([]) }
  const folders = useMemoFolders()
  const composing = useRef(false)
  useEffect(() => {
    if (params.get('compose') !== '1' || composing.current) return
    composing.current = true
    const id = add()
    setParams({ id: String(id) }, { replace: true })
  }, [params, setParams, add])
  const isMobile = useMediaQuery('(max-width: 900px)')
  const now = useToday().getTime()

  const sorted = sortMemos(memos.filter((m) => folder === 'all' || (folder === 'pinned' ? m.pinned : folder === 'unfiled' ? !m.folderId : m.folderId === folder)))
  const asked = Number(params.get('id')) || null
  // PC 는 고른 메모가 없으면 맨 위 메모를 바로 보여 줌, 모바일은 목록부터
  const current = editableLedgerMemoId
    ? memos.find((m) => String(m.id) === editableLedgerMemoId)
    : sorted.find((m) => m.id === asked) ?? (isMobile ? undefined : sorted[0])
  const open = (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('id', String(id)); else next.delete('id')
    setParams(next, { replace: true })
  }

  const q = query.trim().toLowerCase()
  const list = q ? sorted.filter((m) => searchText(m).includes(q)) : sorted

  return (
    <div className={cx(styles.app, !!asked && !!current && styles.editing)}>
      {!editableLedgerMemoId && <SaveRecovery name="메모" className={styles.recoveryRow} store={memoRecovery} titleOf={titleOf} retry={retryMemoDraft}
        renderEditor={(memo, change, saving) => <MemoEditor memo={memo} folders={folders.folders} foldersReady={!folders.loading && !folders.error} recovery={{ change, saving }} />}
      />}
      <aside className={styles.side}>
        <div className={styles.sideHead}>
          <h2>
            {folder === 'all' ? '전체 메모' : folder === 'pinned' ? '고정 메모' : folder === 'unfiled' ? '미분류' : folders.folders.find((f) => f.id === folder)?.name ?? '폴더'} <small>{sorted.length}개</small>
          </h2>
          <Button
            disabled={selecting}
            onClick={() => {
              setQuery('')
              const id = add('', false, folders.folders.some((f) => f.id === folder) ? folder : null)
              if (folder === 'pinned') useMemoStore.getState().update(id, { pinned: true })
              open(id)
            }}
          >
            + 새 메모
          </Button>
        </div>
        <div className={styles.folderActions}>
          <FolderPanel folders={folders} memos={memos} selected={folder} onSelect={(id) => { cancelSelection(); setFolder(id); setQuery(''); open(null) }} />
          {folder !== 'all' && <Button variant="line" onClick={() => { cancelSelection(); setFolder('all'); setQuery(''); open(null) }}>전체 메모</Button>}
          <button type="button" className={cx(styles.folderSettings, styles.deleteSelection)} aria-label="메모 선택 삭제" title="메모 선택 삭제" aria-pressed={selecting} disabled={!memos.length} onClick={() => { if (selecting) cancelSelection(); else { setSelecting(true); open(null) } }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
          </button>
        </div>
        {selecting && <div className={styles.selectionActions}>
          <span role="status">{selectedMemos.length}개 선택</span>
          <Button variant="line" onClick={cancelSelection}>취소</Button>
          <Button variant="danger" disabled={!selectedMemos.length} onClick={() => setConfirmDeleteAll(true)}>선택 삭제</Button>
        </div>}
        <input type="search" className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="메모 검색" aria-label="메모 검색" />
        <div className={styles.list}>
          {list.length === 0 && <p className={styles.none}>{q ? '찾는 메모가 없어요.' : '아직 메모가 없어요. 새 메모를 만들어 보세요.'}</p>}
          {list.map((m) => {
            const c = colorOf(m.color)
            const preview = previewLines(m, (d) => (d ? '✓ ' : '· ')).join('  ')
            return (
              <div key={m.id} className={cx(selecting && styles.selectableMemo)}>
              {selecting && <input type="checkbox" aria-label={`${titleOf(m)} 삭제 선택`} checked={selectedIds.includes(m.id)} onChange={() => toggleSelected(m.id)} />}
              <button
                type="button"
                className={cx(styles.item, current?.id === m.id && styles.on)}
                style={{ '--memo-bg': c.bg, '--memo-line': c.line } as CSSProperties}
                onClick={() => selecting ? toggleSelected(m.id) : open(m.id)}
                aria-label={selecting ? `${titleOf(m)} ${selectedIds.includes(m.id) ? '선택 해제' : '삭제 선택'}` : undefined}
              >
                <span className={styles.itemTop}>
                  <b>
                    {m.pinned && '📌 '}
                    {m.draft && <span className={styles.draftBadge}>작성 중 · 임시 메모 </span>}
                    {titleOf(m)}
                  </b>
                  <time>{whenText(m.updatedAt, now)}</time>
                </span>
                {preview && <small>{preview}</small>}
                <small>📁 {folders.folders.find((f) => f.id === m.folderId)?.name ?? (m.folderId ? '폴더 확인 중' : '미분류')}</small>
                {m.ledgerContext && <small>가계부 · {m.ledgerContext}</small>}
                {m.checklist && m.items.length > 0 && (
                  <span className={styles.progress}>
                    {m.items.filter((i) => i.done).length} / {m.items.length} 완료
                  </span>
                )}
              </button>
              </div>
            )
          })}
        </div>
      </aside>

      <section className={styles.editor} style={current ? ({ '--memo-bg': colorOf(current.color).bg } as CSSProperties) : undefined} aria-label="메모 쓰기">
        {current?.draft && <p role="status">작성 중인 임시 메모예요. ‘저장’을 누르면 일반 메모로 전환돼요.</p>}
        {current?.ledgerContext && !editableLedgerMemoId && <p>가계부 · {current.ledgerContext}</p>}
        {current ? (
          <MemoEditor key={current.id} memo={current} folders={folders.folders} foldersReady={!folders.loading && !folders.error} onBack={() => open(null)} onDeleted={() => open(null)} onSaved={onLedgerMemoSaved} onEdit={onLedgerMemoEdit} />
        ) : (
          <div className={styles.empty}>
            <span aria-hidden="true">📝</span>
            <b>메모를 골라 보세요</b>
            <p>왼쪽 목록에서 메모를 누르거나 새 메모를 만들어요.</p>
          </div>
        )}
      </section>
      <Modal open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} title="선택 메모 삭제" className={styles.confirm}>
        <h3>선택한 메모 {selectedMemos.length}개를 삭제할까요?</h3>
        <p>선택한 메모만 삭제돼요. 가계부에 연결된 메모도 포함되며, 삭제한 메모는 되돌릴 수 없어요.</p>
        <div className={styles.confirmActions}>
          <Button variant="line" onClick={() => setConfirmDeleteAll(false)}>취소</Button>
          <Button variant="danger" disabled={!selectedMemos.length} onClick={() => {
            const store = useMemoStore.getState()
            selectedMemos.forEach((memo) => store.remove(memo.id))
            setConfirmDeleteAll(false)
            cancelSelection()
            open(null)
          }}>선택 삭제</Button>
        </div>
      </Modal>
    </div>
  )
}

function MemoEditor({ memo, folders, foldersReady, onBack, onDeleted, onSaved, onEdit, recovery }: {
  memo: Memo; folders: MemoFolder[]; foldersReady: boolean; onBack?: () => void; onDeleted?: () => void
  onSaved?: (memo: Memo) => void; onEdit?: (memo: Memo) => void
  recovery?: { change: (patch: Partial<Memo>) => void; saving: boolean }
}) {
  const update = useMemoStore((s) => s.update)
  const remove = useMemoStore((s) => s.remove)
  const [confirmDel, setConfirmDel] = useState(false)
  const [moving, setMoving] = useState(false)
  const [completing, setSaving] = useState(false)
  const saving = completing || !!recovery?.saving
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const pendingSave = useRef(false)
  const itemRefs = useRef<Array<HTMLInputElement | null>>([])
  const now = useToday().getTime()
  const set = (patch: Partial<Memo>) => {
    if (recovery) return recovery.change(patch)
    if (pendingSave.current) return
    setSaved(false)
    update(memo.id, patch)
    const edited = useMemoStore.getState().memos.find((entry) => entry.id === memo.id)
    if (edited && onEdit) {
      try { onEdit(edited) }
      catch { setSaveError('작성 중인 내용을 이 탭에 보관하지 못했어요. 화면을 이동하기 전에 저장해 주세요.') }
    }
  }
  const save = async () => {
    if (pendingSave.current) return
    pendingSave.current = true; setSaving(true); setSaveError(''); setSaved(false)
    try {
      const completed = await completeLedgerMemo(memo.id)
      onSaved?.(completed)
      setSaved(true)
    } catch (cause) { setSaveError(getErrorMessage(cause, '메모를 저장하지 못했어요. 다시 시도해 주세요.')) }
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
    <div className={cx(styles.edit, recovery && styles.recoveryEdit)}>
      <div className={styles.tools}>
        {onBack && <button type="button" className={styles.back} disabled={saving} onClick={onBack} aria-label="목록으로">
          ‹ 목록
        </button>}
        <div className={styles.colors} role="group" aria-label="메모 색">
          {MEMO_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={cx(styles.color, memo.color === c.name && styles.colorOn)}
              style={{ background: c.bg, borderColor: c.line }}
              aria-label={c.name}
              aria-pressed={memo.color === c.name}
              disabled={saving}
              onClick={() => set({ color: c.name })}
            />
          ))}
        </div>
        <span className={styles.grow} />
        <button type="button" className={styles.tool} disabled={saving || !foldersReady} onClick={() => setMoving(true)} aria-label="폴더로 이동" aria-haspopup="dialog" aria-expanded={moving} title="폴더로 이동">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10V7a2 2 0 0 0-2-2h-6l-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
            <path d="M13 16h9m-4-4 4 4-4 4" />
          </svg>
        </button>
        <button type="button" className={styles.tool} aria-pressed={memo.pinned} disabled={saving} onClick={() => set({ pinned: !memo.pinned })} title="맨 위에 고정">
          📌 <span>고정</span>
        </button>
        <button type="button" className={styles.tool} aria-pressed={memo.checklist} disabled={saving} onClick={toggleChecklist} title="체크리스트로 바꾸기">
          ☑️ <span>{memo.checklist ? '글로 바꾸기' : '체크리스트'}</span>
        </button>
        {onDeleted && <button type="button" className={cx(styles.tool, styles.danger)} disabled={saving} onClick={() => setConfirmDel(true)} title="메모 삭제">
          🗑️ <span>삭제</span>
        </button>}
        {!recovery && (onSaved || memo.ledgerContext) && <Button disabled={saving} onClick={() => void save()}>{saving ? '저장 중' : '저장'}</Button>}
      </div>
      {saveError && <p role="alert">{saveError}</p>}
      {saved && <p role="status">저장했어요.</p>}

      <input className={styles.title} value={memo.title} readOnly={saving} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="제목" aria-label="메모 제목" />

      {memo.checklist ? (
        <div className={styles.items}>
          {memo.items.map((it, i) => (
            <div key={i} className={cx(styles.checkRow, it.done && styles.done)}>
              <input
                type="checkbox"
                checked={it.done}
                disabled={saving}
                aria-label={`${it.text || '항목'} 완료`}
                onChange={(e) => setItems(memo.items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
              />
              <input
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                className={styles.checkText}
                value={it.text}
                readOnly={saving}
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
              <button type="button" className={styles.checkX} aria-label="항목 지우기" disabled={saving} onClick={() => setItems(memo.items.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className={styles.checkAdd} disabled={saving} onClick={() => setItems([...memo.items, { text: '', done: false }], memo.items.length)}>
            + 항목 추가
          </button>
        </div>
      ) : (
        <textarea className={styles.body} value={memo.body} readOnly={saving} onChange={(e) => set({ body: e.target.value })} maxLength={5000} placeholder="내용을 적어 보세요" aria-label="메모 내용" />
      )}

      {!recovery && <p className={styles.saved} aria-live="polite">
        {saving ? '저장 중…' : saveError ? '위의 저장 상태를 확인해 주세요.' : `${memo.draft ? '임시 편집' : '자동 저장됨'} · ${whenText(memo.updatedAt, now)}`}
      </p>}

      <Modal open={moving} onClose={() => setMoving(false)} title="폴더로 이동">
        <h3>폴더로 이동</h3>
        <p>“{titleOf(memo)}” 메모를 이동할 폴더를 선택해 주세요.</p>
        <div className={styles.folders}>
          <nav aria-label="이동할 폴더">
            {[{ id: '', name: '미분류' }, ...folders].map((folder) => <button type="button" key={folder.id} disabled={!foldersReady} aria-pressed={(memo.folderId ?? '') === folder.id} onClick={() => {
              setMoving(false)
              if ((memo.folderId ?? '') !== folder.id) set({ folderId: folder.id || null })
            }}>
              <span>📁 {folder.name}</span>{(memo.folderId ?? '') === folder.id && <b>현재 폴더</b>}
            </button>)}
          </nav>
          {!folders.length && <p>‘폴더’ 버튼에서 폴더를 먼저 만들어 주세요.</p>}
        </div>
      </Modal>
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
              onDeleted?.()
            }}
          >
            지우기
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function FolderPanel({ folders, memos, selected, onSelect }: { folders: ReturnType<typeof useMemoFolders>; memos: Memo[]; selected: string; onSelect: (id: string) => void }) {
  const [showFolders, setShowFolders] = useState(false)
  const [managing, setManaging] = useState(false)
  const [editing, setEditing] = useState<MemoFolder | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MemoFolder | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const entries = [
    { id: 'all', name: '모든 메모', count: memos.length },
    { id: 'pinned', name: '고정 메모', count: memos.filter((m) => m.pinned).length },
    { id: 'unfiled', name: '미분류', count: memos.filter((m) => !m.folderId).length },
  ]
  return <>
    <Button variant="line" aria-haspopup="dialog" aria-expanded={showFolders} onClick={() => { setManaging(false); setShowFolders(true) }}>📁 폴더</Button>
    <Modal open={showFolders} onClose={() => setShowFolders(false)} title="메모 폴더">
      <h3>메모 폴더</h3>
      <div className={styles.folders}>
    <div className={styles.folderToolbar}>
      <Button onClick={() => { setName(''); setError(''); setEditing('new') }}>+ 폴더 만들기</Button>
      <button type="button" className={styles.folderSettings} aria-label="폴더 수정·삭제" title="폴더 수정·삭제" aria-pressed={managing} onClick={() => setManaging((value) => !value)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="9" cy="18" r="2" fill="white" />
        </svg>
      </button>
    </div>
    <nav aria-label="메모 폴더">{entries.map((f) => <button type="button" key={f.id} aria-pressed={selected === f.id} onClick={() => { onSelect(f.id); setShowFolders(false) }}>
      <span>📁 {f.name}</span><b>{f.count}</b>
    </button>)}
    {folders.folders.map((f) => <div className={cx(styles.folderRow, managing && styles.folderRowManaging)} key={f.id}>
      <button type="button" aria-pressed={selected === f.id} onClick={() => { onSelect(f.id); setShowFolders(false) }}>
        <span>📁 {f.name}</span><b>{memos.filter((m) => m.folderId === f.id).length}</b>
      </button>
      {managing && <>
        <button type="button" aria-label={`${f.name} 폴더 수정`} title="폴더 이름 수정" onClick={() => { setName(f.name); setError(''); setEditing(f) }}>수정</button>
        <button type="button" aria-label={`${f.name} 폴더 삭제`} title="폴더 삭제" onClick={() => { setError(''); setDeleting(f) }}>삭제</button>
      </>}
    </div>)}
    </nav>
    {folders.loading && <p role="status">폴더를 불러오는 중이에요.</p>}
    {folders.error && <p role="alert">{folderErrorMessage(folders.error)} <button type="button" onClick={() => void folders.retry()}>다시 시도</button></p>}
    {!folders.loading && !folders.error && !folders.folders.length && <p>아직 만든 폴더가 없어요. 위의 ‘폴더 만들기’로 추가해 주세요.</p>}
      </div>
    </Modal>
    <Modal open={!!editing} onClose={() => { if (!busy) setEditing(null) }} title={editing === 'new' ? '폴더 만들기' : '폴더 이름 변경'}>
      <form onSubmit={async (e) => {
        e.preventDefault()
        if (!editing || pending.current) return
        pending.current = true; setBusy(true); setError('')
        try { await folders.save(name, editing === 'new' ? undefined : editing.id); setEditing(null) }
        catch (cause) { setError(folderErrorMessage(cause)) }
        finally { pending.current = false; setBusy(false) }
      }}>
        <h3>{editing === 'new' ? '폴더 만들기' : '폴더 이름 변경'}</h3>
        <label className={styles.folderSelect}>폴더 이름<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required disabled={busy} /></label>
        {error && <p role="alert">{error}</p>}
        <div className={styles.confirmActions}>
          <Button type="button" variant="line" disabled={busy} onClick={() => setEditing(null)}>취소</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? '저장 중' : editing === 'new' ? '만들기' : '수정 저장'}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={!!deleting} onClose={() => { if (!busy) setDeleting(null) }} title="폴더 삭제">
      <h3>“{deleting?.name}” 폴더를 삭제할까요?</h3><p>안에 있는 메모는 삭제되지 않고 미분류로 옮겨져요.</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.confirmActions}>
      <Button variant="line" disabled={busy} onClick={() => setDeleting(null)}>취소</Button>
      <Button variant="danger" disabled={busy} onClick={async () => {
        if (!deleting || pending.current) return
        pending.current = true; setBusy(true); setError('')
        try { await folders.remove(deleting.id); if (selected === deleting.id) onSelect('unfiled'); setDeleting(null) }
        catch (cause) { setError(folderErrorMessage(cause)) }
        finally { pending.current = false; setBusy(false) }
      }}>{busy ? '삭제 중' : '폴더 삭제'}</Button>
      </div>
    </Modal>
  </>
}

function folderErrorMessage(cause: unknown) {
  const status = (cause as { response?: { status?: number } })?.response?.status
  if (status === 404 || status === 405) return '폴더 기능을 서버에서 찾지 못했어요. 변경된 백엔드를 재시작한 후 다시 시도해 주세요.'
  return getErrorMessage(cause, '폴더 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
}

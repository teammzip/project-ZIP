import { useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { cx } from '@/lib/cx'
import { useToday } from '@/lib/useToday'
import { colorOf, previewLines, sortMemos, titleOf, whenText } from '../lib'
import { HOME_MAX, useMemoStore } from '../store'
import type { Memo } from '../types'
import styles from './MemoWidget.module.css'

/** 홈 메모 위젯 (팀장님 시안 views/memo.js): 고른 메모 최대 3개를 쪽지로 나란히 + 빠른 메모.
 * - "메모 고르기"로 홈에 보여 줄 메모를 체크한 순서대로 고름 (안 고르면 고정 → 최근 수정 순 3개)
 * - 쪽지를 꾹 눌렀다가(0.35초) 옆 쪽지 위로 끌어다 놓으면 두 쪽지 자리가 바뀜 (마우스 · 터치)
 * - 체크리스트 메모는 쪽지에서 바로 체크. 쪽지를 누르면 마이페이지 메모장에서 그 메모를 엶 */
export function MemoWidget() {
  const { memos, homeIds, add, setHomeIds } = useMemoStore()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const shown = homeIds ? homeIds.map((id) => memos.find((m) => m.id === id)).filter((m): m is Memo => !!m) : sortMemos(memos).slice(0, HOME_MAX)
  const go = (id: number) => navigate(`/my/memo?id=${id}`)
  const swap = (from: number, to: number) => {
    const ids = shown.map((m) => m.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    setHomeIds(ids) // 자동 상태였다면 이때부터 직접 고른 상태
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    add(text.trim(), true)
    setText('')
  }

  return (
    <section className={styles.widget} aria-labelledby="memo-widget-title">
      <header className={styles.head}>
        <span className={styles.ico} aria-hidden="true">
          📝
        </span>
        <h2 id="memo-widget-title">메모</h2>
        <small>{memos.length}개</small>
        <button type="button" className={cx(styles.open, styles.pick)} onClick={() => setPicking(true)} disabled={!memos.length}>
          메모 고르기
        </button>
        <Link to="/my/memo" className={styles.open}>
          전체 보기 ›
        </Link>
      </header>

      <NoteGrid shown={shown} onOpen={go} onSwap={swap}>
        {/* 남는 칸은 눌러서 메모를 고르는 빈 쪽지 */}
        {Array.from({ length: HOME_MAX - shown.length }, (_, i) => (
          <button key={i} type="button" className={styles.emptyNote} onClick={() => (memos.length ? setPicking(true) : inputRef.current?.focus())}>
            <span aria-hidden="true">＋</span>
            {memos.length ? '메모 고르기' : '메모 만들기'}
          </button>
        ))}
      </NoteGrid>

      <form className={styles.add} onSubmit={submit}>
        <span aria-hidden="true">✏️</span>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="빠른 메모 남기기" aria-label="빠른 메모" />
        <button type="submit" aria-label="메모 저장">
          ＋
        </button>
      </form>

      <MemoPicker
        open={picking}
        initial={shown.map((m) => m.id)}
        onClose={() => setPicking(false)}
        onDone={(ids) => {
          setHomeIds(ids)
          setPicking(false)
        }}
        onAuto={() => {
          setHomeIds(null)
          setPicking(false)
        }}
      />
    </section>
  )
}

/** 쪽지 줄. 꾹 눌러 끌어다 놓으면 자리를 바꿈 */
function NoteGrid({ shown, onOpen, onSwap, children }: { shown: Memo[]; onOpen: (id: number) => void; onSwap: (from: number, to: number) => void; children: ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ timer: 0, active: false, sx: 0, sy: 0, from: -1, to: -1, justDragged: false })
  const [lifting, setLifting] = useState(-1)
  const [over, setOver] = useState(-1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const blockScroll = (e: TouchEvent) => e.preventDefault() // 끄는 동안 터치 화면이 스크롤되지 않게
  const reset = () => {
    clearTimeout(drag.current.timer)
    drag.current.active = false
    document.removeEventListener('touchmove', blockScroll)
    setLifting(-1)
    setOver(-1)
    setOffset({ x: 0, y: 0 })
  }
  const down = (i: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('input, label')) return // 체크박스는 그대로 체크
    const el = e.currentTarget
    const pid = e.pointerId
    Object.assign(drag.current, { sx: e.clientX, sy: e.clientY, from: i, to: -1 })
    drag.current.timer = window.setTimeout(() => {
      drag.current.active = true
      setLifting(i)
      try {
        el.setPointerCapture(pid)
      } catch {
        /* 무시 */
      }
      document.addEventListener('touchmove', blockScroll, { passive: false })
    }, 350)
  }
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) clearTimeout(d.timer)
      return
    }
    setOffset({ x: e.clientX - d.sx, y: e.clientY - d.sy })
    const notes = [...(gridRef.current?.querySelectorAll<HTMLElement>('[data-note]') ?? [])]
    d.to = notes.findIndex((n, k) => {
      if (k === d.from) return false
      const r = n.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    })
    setOver(d.to)
  }
  const up = () => {
    const { active, from, to } = drag.current
    reset()
    if (!active) return
    drag.current.justDragged = true // 끌고 난 직후의 클릭(메모 열기)을 막음
    setTimeout(() => (drag.current.justDragged = false), 0)
    if (to >= 0 && from >= 0 && to !== from) onSwap(from, to)
  }
  const open = (id: number) => !drag.current.justDragged && onOpen(id)

  return (
    <div ref={gridRef} className={styles.grid}>
      {shown.map((m, i) => (
        <article
          key={m.id}
          data-note
          className={cx(styles.note, lifting === i && styles.lifting, over === i && styles.drop)}
          style={{ '--memo-bg': colorOf(m.color).bg, '--memo-line': colorOf(m.color).line, ...(lifting === i ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(1.04)` } : {}) } as CSSProperties}
          onPointerDown={down(i)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => drag.current.active && e.preventDefault()}
        >
          <NoteBody memo={m} onOpen={() => open(m.id)} />
        </article>
      ))}
      {children}
    </div>
  )
}

function NoteBody({ memo: m, onOpen }: { memo: Memo; onOpen: () => void }) {
  const update = useMemoStore((s) => s.update)
  const now = useToday().getTime()
  const left = m.items.filter((i) => i.text && !i.done).length
  return (
    <>
      <button type="button" className={styles.noteHead} onClick={onOpen}>
        <b>
          {m.pinned && '📌 '}
          {titleOf(m)}
        </b>
        <time>{whenText(m.updatedAt, now)}</time>
      </button>
      {m.checklist ? (
        <>
          <ul className={styles.checks}>
            {m.items.slice(0, 5).map((it, i) =>
              it.text ? (
                <li key={i} className={cx(it.done && styles.done)}>
                  <label>
                    <input type="checkbox" checked={it.done} onChange={(e) => update(m.id, { items: m.items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} />
                    <span>{it.text}</span>
                  </label>
                </li>
              ) : null,
            )}
          </ul>
          <small className={styles.left}>{left ? `${left}개 남았어요` : '모두 끝냈어요 🎉'}</small>
        </>
      ) : (
        <p className={styles.text} onClick={onOpen}>
          {previewLines(m).join('\n') || titleOf(m)}
        </p>
      )}
    </>
  )
}

/** 메모 고르기 창: 체크한 순서대로 최대 3개 (홈에는 이 순서로 나옴) */
function MemoPicker({ open, initial, onClose, onDone, onAuto }: { open: boolean; initial: number[]; onClose: () => void; onDone: (ids: number[]) => void; onAuto: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="홈에 보여 줄 메모">
      {/* 열 때마다 지금 홈에 보이는 메모로 새로 시작 */}
      {open && <PickerBody initial={initial} onDone={onDone} onAuto={onAuto} />}
    </Modal>
  )
}

function PickerBody({ initial, onDone, onAuto }: { initial: number[]; onDone: (ids: number[]) => void; onAuto: () => void }) {
  const memos = useMemoStore((s) => s.memos)
  const [ids, setIds] = useState(initial)
  return (
    <div className={styles.picker}>
      <h3>홈에 보여 줄 메모</h3>
      <p>
        최대 {HOME_MAX}개까지 골라요. <b>{ids.length}</b>/{HOME_MAX}
      </p>
      <div className={styles.pickList}>
        {sortMemos(memos).map((m) => {
          const on = ids.includes(m.id)
          const full = !on && ids.length >= HOME_MAX
          return (
            <label key={m.id} className={cx(styles.pickItem, full && styles.pickOff)} style={{ '--memo-bg': colorOf(m.color).bg, '--memo-line': colorOf(m.color).line } as CSSProperties}>
              <input type="checkbox" checked={on} disabled={full} onChange={(e) => setIds(e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id))} />
              <span>
                {m.pinned && '📌 '}
                {titleOf(m)}
              </span>
            </label>
          )
        })}
      </div>
      <div className={styles.pickActions}>
        <Button variant="line" onClick={onAuto}>
          최근 메모로 자동
        </Button>
        <Button onClick={() => onDone(ids)}>완료</Button>
      </div>
    </div>
  )
}

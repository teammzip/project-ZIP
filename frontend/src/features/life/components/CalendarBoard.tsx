import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card, Segmented } from '@/components/ui'
import { cx } from '@/lib/cx'
import { DOW, fmt, monthDay, pad, todayStr } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { trashIco } from '../data/catalog'
import { UNCATEGORIZED, evColor } from '../data/presets'
import { isTrash, sortEvents, trashEventsBetween, weekRange } from '../derive'
import { useLifeStore } from '../store'
import type { CalEvent, TrashEvent } from '../types'
import cal from './calendar.module.css'
import { CategorySelect, RecordCard, type Picked } from './RecordCard'
import styles from './life.module.css'

/** 목록 보기: 오늘 할 일 · 이번 주 할 일 · 선택한 날 · 전체 (백엔드 담당 시안 PR #12) */
export type CalMode = 'today' | 'week' | 'day' | 'all'
const MODES: CalMode[] = ['today', 'week', 'day', 'all']

/** 일정 = 할 일 (팀장님 시안 variants/app 의 캘린더와 같은 구성)
 * - 왼쪽: 큰 달력(월간 · 주간, 칸 안에 일정 막대)
 * - 오른쪽: 일정 기록하기(카테고리 항목 버튼 → 달력에서 날짜 누르기 / 직접 입력) + 할 일 목록
 * ?mode=today|week|day|all 로 열면 그 목록 보기로 시작 (홈 카드에서 씀) */
export function CalendarBoard() {
  const { events, addEvent, categories } = useLifeStore(useShallow((s) => ({ events: s.events, addEvent: s.addEvent, categories: s.categories })))
  const now = useToday()
  const today = todayStr()
  const [params] = useSearchParams()
  const initialMode = params.get('mode') as CalMode | null
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [calView, setCalView] = useState<'month' | 'week'>('month')
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<CalMode>(initialMode && MODES.includes(initialMode) ? initialMode : 'today')
  const [query, setQuery] = useState('')
  // 일정 기록하기에서 골라 둔 항목 (달력에서 날짜를 누르면 이 이름 · 카테고리로 추가)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pickTime, setPickTime] = useState('')
  const [pickNote, setPickNote] = useState('')

  /** 날짜를 고르면 그 달로 이동하고 '선택한 날' 목록을 보여줌 */
  const pick = (date: string, nextMode: CalMode = 'day') => {
    setSelected(date)
    setView({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 })
    setMode(nextMode)
    setQuery('')
  }
  /** 오늘 할 일 · 이번 주 할 일 보기는 오늘로 돌아감 */
  const changeMode = (m: CalMode) => {
    if (m === 'today' || m === 'week') pick(today, m)
    else {
      setMode(m)
      setQuery('')
    }
  }
  /** 일정 하나 저장 후 그 날짜로 달력 · 목록을 맞춤 (직접 입력과 항목 버튼이 같이 씀) */
  const add = (title: string, date: string, time: string, category?: string) => {
    addEvent({ title, date, time, ...(category ? { category } : {}) })
    const week = weekRange(now)
    pick(date, date === today ? 'today' : mode === 'week' && date >= week.start && date <= week.end ? 'week' : 'day')
  }
  const addPicked = (date: string) => {
    if (!picked) return
    const label = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`
    if (events.some((ev) => ev.date === date && ev.title === picked.title && (ev.category ?? '') === picked.category)) return setPickNote(`${label}에 이미 있어요.`)
    add(picked.title, date, pickTime, picked.category)
    setPickNote(`${label}에 추가했어요. 다른 날짜도 눌러 추가할 수 있어요.`)
  }
  const choose = (p: Picked | null) => {
    setPicked(p)
    setPickNote('')
  }
  /** 이전 · 다음: 월간은 한 달, 주간은 한 주 */
  const shift = (dir: number) => {
    if (calView === 'week') {
      const d = new Date(`${selected}T00:00:00`)
      d.setDate(d.getDate() + 7 * dir)
      setSelected(fmt(d))
      setView({ y: d.getFullYear(), m: d.getMonth() })
    } else {
      const d = new Date(view.y, view.m + dir, 1)
      setView({ y: d.getFullYear(), m: d.getMonth() })
    }
  }
  const changeCalView = (v: 'month' | 'week') => {
    setCalView(v)
    if (v === 'month') setView({ y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 })
  }

  return (
    <div className={cal.layout}>
      <div className={common.col}>
        <BigCalendar
          events={events}
          view={view}
          calView={calView}
          onCalView={changeCalView}
          selected={selected}
          picking={!!picked}
          categoryNames={categories.map((c) => c.name)}
          onDay={(d) => (picked ? addPicked(d) : pick(d))}
          onShift={shift}
          onToday={() => pick(today)}
        />
      </div>
      <div className={common.col}>
        <RecordCard
          picked={picked}
          onChoose={choose}
          pickNote={pickNote}
          pickTime={pickTime}
          onPickTime={setPickTime}
          onAddToday={() => addPicked(today)}
          onAddWeek={() => addPicked(weekRange(now).end)}
          date={selected}
          onAdd={add}
        />
        <EventList events={events} selected={selected} mode={mode} setMode={changeMode} query={query} setQuery={setQuery} onMoved={(d) => pick(d)} viewMonth={view} />
      </div>
    </div>
  )
}

type GridProps = {
  events: CalEvent[]
  view: { y: number; m: number }
  calView: 'month' | 'week'
  onCalView: (v: 'month' | 'week') => void
  selected: string
  picking: boolean
  categoryNames: string[]
  onDay: (date: string) => void
  onShift: (dir: number) => void
  onToday: () => void
}

/** 큰 달력: 월간은 그 달 전체(앞뒤 달 날짜는 흐리게), 주간은 선택한 날이 든 한 주.
 * 칸마다 날짜 + 일정 막대(월간 최대 3개, 넘으면 "+N개 더", 주간은 전부). 좁은 화면은 막대 대신 점 */
function BigCalendar({ events, view, calView, onCalView, selected, picking, categoryNames, onDay, onShift, onToday }: GridProps) {
  const { y, m } = view
  const today = todayStr()
  let start: Date
  let count: number
  let title: string
  if (calView === 'week') {
    start = new Date(`${selected}T00:00:00`)
    start.setDate(start.getDate() - start.getDay())
    count = 7
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    title = `${start.getFullYear()}.${pad(start.getMonth() + 1)}.${pad(start.getDate())} ~ ${pad(end.getMonth() + 1)}.${pad(end.getDate())}`
  } else {
    const first = new Date(y, m, 1)
    start = new Date(y, m, 1 - first.getDay())
    count = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7) * 7
    title = `${y}.${pad(m + 1)}`
  }
  const dates = Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const trash = trashEventsBetween(fmt(dates[0]), fmt(dates[dates.length - 1]))
  const days = layoutSlots(dates, events, trash)
  const maxChips = calView === 'week' ? 12 : 3

  return (
    <Card>
      <h2 className={cal.heading}>내 일정</h2>
      <div className={cal.toolbar}>
        <div className={cal.pills} role="group" aria-label="보기 방식">
          <button type="button" className={cx(cal.pill, calView === 'week' && cal.pillOn)} aria-pressed={calView === 'week'} onClick={() => onCalView('week')}>
            주간
          </button>
          <button type="button" className={cx(cal.pill, calView === 'month' && cal.pillOn)} aria-pressed={calView === 'month'} onClick={() => onCalView('month')}>
            월간
          </button>
        </div>
        <div className={cal.nav}>
          <button type="button" onClick={() => onShift(-1)} aria-label="이전">
            ‹
          </button>
          <span className={cal.ym}>{title}</span>
          <button type="button" onClick={() => onShift(1)} aria-label="다음">
            ›
          </button>
        </div>
        <button type="button" className={cal.todayBtn} onClick={onToday}>
          오늘
        </button>
      </div>
      <div className={cx(cal.grid, calView === 'week' && cal.week, picking && cal.picking)}>
        {DOW.map((d, i) => (
          <div key={d} className={cx(cal.dow, i === 0 && cal.sun)}>
            {d}
          </div>
        ))}
        {days.map(({ date: d, ds, evs, slots }) => {
          return (
            <div
              key={ds}
              role="button"
              tabIndex={0}
              className={cx(cal.day, calView === 'month' && d.getMonth() !== m && cal.out, d.getDay() === 0 && cal.sun, ds === today && cal.today, ds === selected && cal.sel)}
              onClick={() => onDay(ds)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onDay(ds))}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${evs.length ? `, 일정 ${evs.length}개` : ''}${picking ? ', 눌러서 추가' : ''}`}
              aria-pressed={ds === selected}
            >
              <span className={cal.dn}>{d.getDate()}</span>
              <div className={cal.chips}>
                {slots.slice(0, maxChips).map((slot, q) => {
                  if (!slot) return <div key={`gap${q}`} className={cx(cal.cev, cal.gap)} aria-hidden="true" />
                  const { ev, joinPrev, joinNext } = slot
                  const trashEv = isTrash(ev)
                  return (
                    <div
                      key={ev.id}
                      className={cx(cal.cev, !trashEv && ev.done && cal.cevDone, joinPrev && cal.joinPrev, joinNext && cal.joinNext)}
                      style={{ '--c': evColor(ev.title, trashEv, trashEv ? undefined : ev.category, categoryNames) } as CSSProperties}
                      title={`${ev.time ? `${ev.time} ` : ''}${ev.title}`}
                    >
                      {/* 이어지는 막대에는 제목을 다시 쓰지 않음 */}
                      {joinPrev ? '\u00a0' : (
                        <>
                          {ev.time && !trashEv && <i>{ev.time}</i>}
                          {ev.title}
                        </>
                      )}
                    </div>
                  )
                })}
                {slots.length > maxChips && <div className={cal.more}>+{slots.length - maxChips}개 더</div>}
              </div>
              <span className={cal.mark}>
                {evs.slice(0, 3).map((ev) => (
                  <i key={ev.id} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

type Slot = { ev: CalEvent | TrashEvent; joinPrev: boolean; joinNext: boolean } | null

/** 달력 칸마다 일정을 줄(slot)에 배치. 같은 제목의 일정이 이어지는 날(예: 병원 예약 8~10일)은
 * 앞날과 같은 줄에 놓고 막대를 이어 붙임 (일요일은 줄이 바뀌니 잇지 않음, 쓰레기 배출은 잇지 않음) */
function layoutSlots(dates: Date[], events: CalEvent[], trash: TrashEvent[]) {
  const out: Array<{ date: Date; ds: string; evs: Array<CalEvent | TrashEvent>; slots: Slot[] }> = []
  dates.forEach((date, n) => {
    const ds = fmt(date)
    const evs: Array<CalEvent | TrashEvent> = [...sortEvents(events.filter((ev) => ev.date === ds)), ...trash.filter((t) => t.date === ds)]
    const slots: Slot[] = []
    const prev = out[n - 1]
    const placed = new Set<CalEvent | TrashEvent>()
    if (prev && date.getDay() !== 0) {
      for (const ev of evs) {
        if (isTrash(ev)) continue
        const q = prev.slots.findIndex((p) => p && !p.joinNext && !isTrash(p.ev) && p.ev.title === ev.title)
        if (q >= 0 && !slots[q]) {
          prev.slots[q] = { ...prev.slots[q]!, joinNext: true }
          slots[q] = { ev, joinPrev: true, joinNext: false }
          placed.add(ev)
        }
      }
    }
    for (const ev of evs) {
      if (placed.has(ev)) continue
      let q = 0
      while (slots[q]) q++
      slots[q] = { ev, joinPrev: false, joinNext: false }
    }
    for (let q = 0; q < slots.length; q++) slots[q] ??= null
    out.push({ date, ds, evs, slots })
  })
  return out
}

type ListProps = {
  events: CalEvent[]
  selected: string
  mode: CalMode
  setMode: (m: CalMode) => void
  query: string
  setQuery: (q: string) => void
  onMoved: (date: string) => void
  viewMonth: { y: number; m: number }
}

const LIST_TITLE: Record<CalMode, string> = { today: '오늘 할 일', week: '이번 주 할 일', day: '', all: '전체 일정' }

function EventList({ events, selected, mode, setMode, query, setQuery, onMoved, viewMonth }: ListProps) {
  const { removeEvent, toggleEvent } = useLifeStore(useShallow((s) => ({ removeEvent: s.removeEvent, toggleEvent: s.toggleEvent })))
  const now = useToday()
  const today = todayStr()
  const [editingId, setEditingId] = useState<CalEvent['id'] | null>(null)

  // 검색어가 있으면 전체에서 찾음
  const effective: CalMode = query ? 'all' : mode
  const week = weekRange(now)
  const lastDay = new Date(viewMonth.y, viewMonth.m + 1, 0).getDate()
  const monthStart = `${viewMonth.y}-${pad(viewMonth.m + 1)}-01`
  const monthEnd = `${viewMonth.y}-${pad(viewMonth.m + 1)}-${pad(lastDay)}`
  const [from, to] =
    effective === 'today' ? [today, today] : effective === 'week' ? [week.start, week.end] : effective === 'day' ? [selected, selected] : [monthStart, monthEnd]
  const mine = effective === 'all' ? events : events.filter((ev) => ev.date >= from && ev.date <= to)
  let items: Array<CalEvent | TrashEvent> = [...mine, ...trashEventsBetween(from, to)]
  if (query) items = items.filter((ev) => ev.title.toLowerCase().includes(query.toLowerCase()))
  items = sortEvents(items)
  const title = (effective === 'day' ? `${monthDay(selected)} 일정` : LIST_TITLE[effective]) + (query ? ` · 검색: ${query}` : '')
  const showDate = effective === 'all' || effective === 'week'

  return (
    <Card title={title}>
      <Segmented
        label="일정 보기"
        value={effective}
        onChange={(v) => {
          setEditingId(null)
          setQuery('')
          setMode(v)
        }}
        options={[
          { value: 'today', label: '오늘 할 일' },
          { value: 'week', label: '이번 주 할 일' },
          { value: 'day', label: '선택한 날' },
          { value: 'all', label: '전체' },
        ]}
      />
      <input type="search" className={cx(common.input, styles.search)} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="일정 제목 검색" aria-label="일정 검색" />
      <p className={common.note}>요일별 쓰레기 배출은 날짜에 맞춰 정기 일정으로 보여요. 실제 배출 일정은 사는 동네 안내를 확인하세요.</p>
      <ul className={styles.evList}>
        {items.map((ev) => {
          if (isTrash(ev))
            return (
              <li key={ev.id} className={cx(styles.ev, styles.evTrash)}>
                <span className={styles.evWhen}>
                  {showDate && `${ev.date.slice(5).replace('-', '/')} `}
                  {ev.time}
                </span>
                <span className={styles.evName} title={ev.detail}>
                  {trashIco(ev.title)} {ev.title}
                </span>
                <small className={styles.evDetail}>{ev.detail}</small>
              </li>
            )
          if (ev.id === editingId)
            return (
              <EditRow
                key={ev.id}
                ev={ev}
                onDone={(saved) => {
                  setEditingId(null)
                  if (saved) onMoved(saved.date) // 날짜를 바꿨으면 그 날로 따라감
                }}
              />
            )
          return (
            <li
              key={ev.id}
              className={cx(styles.ev, ev.done && styles.evDone, cal.evRow)}
              tabIndex={0}
              onPointerUp={(e) => e.pointerType === 'touch' && !(e.target as HTMLElement).closest('button, input') && e.currentTarget.classList.toggle(cal.showActions)}
            >
              <input type="checkbox" className={common.checkbox} checked={!!ev.done} onChange={(e) => toggleEvent(ev.id, e.target.checked)} aria-label={`${ev.title} 완료`} />
              <span className={styles.evWhen}>
                {showDate && `${ev.date.slice(5).replace('-', '/')} `}
                {ev.time || '종일'}
              </span>
              <span className={styles.evName}>
                {ev.category && <small className={cal.evCategory}>{ev.category}</small>}
                {ev.title}
              </span>
              <span className={cal.evActions}>
              <button type="button" className={styles.evEdit} onClick={() => setEditingId(ev.id)} aria-label={`${ev.title} 일정 수정`}>
                수정
              </button>
              <button type="button" className={common.del} onClick={() => removeEvent(ev.id)} aria-label={`${ev.title} 일정 삭제`} title="삭제">
                ×
              </button>
              </span>
            </li>
          )
        })}
        {!items.length && <li className={common.empty}>{query ? '검색 결과가 없어요.' : '등록된 일정이 없어요.'}</li>}
      </ul>
    </Card>
  )
}

/** 일정 한 줄을 입력칸으로 바꿔 제목·날짜·시간을 고침 (Enter 저장, Esc 취소) */
function EditRow({ ev, onDone }: { ev: CalEvent; onDone: (saved: CalEvent | null) => void }) {
  const updateEvent = useLifeStore((s) => s.updateEvent)
  const [draft, setDraft] = useState(ev)

  const save = () => {
    const title = draft.title.trim()
    if (!title || !draft.date) return
    const next = { ...draft, title }
    updateEvent(next)
    onDone(next)
  }
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'SELECT') return
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') onDone(null)
  }

  return (
    <li className={cx(styles.ev, styles.evEditing)} onKeyDown={onKey}>
      <div className={styles.evFields}>
        <input className={common.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={60} aria-label="일정 제목" autoFocus />
        <div className={cal.editCategory}>
          <CategorySelect value={draft.category || UNCATEGORIZED} onChange={(category) => setDraft({ ...draft, category })} label="카테고리 (선택)" />
          <Button variant="line" onClick={() => setDraft({ ...draft, category: UNCATEGORIZED })}>
            카테고리 삭제
          </Button>
        </div>
        <div className={common.two}>
          <input type="date" className={common.input} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="날짜" />
          <input type="time" className={common.input} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-label="시간 (선택)" />
        </div>
      </div>
      <div className={styles.evBtns}>
        <Button onClick={save}>저장</Button>
        <Button variant="line" onClick={() => onDone(null)}>
          취소
        </Button>
      </div>
    </li>
  )
}

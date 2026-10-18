import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card, Segmented } from '@/components/ui'
import { cx } from '@/lib/cx'
import { DOW, dayDiff, fmt, monthDay, pad, todayStr } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { trashIco } from '../data/catalog'
import { nextRentDate, sortEvents, todayTrash } from '../derive'
import { useLifeStore } from '../store'
import type { CalEvent } from '../types'
import styles from './life.module.css'

type Mode = 'day' | 'all'

/** 일정: 달력 · 일정 추가 · 수정 · 삭제 · 검색, 달력 아래 다가오는 알림 */
export function CalendarBoard() {
  const { events, addEvent } = useLifeStore(useShallow((s) => ({ events: s.events, addEvent: s.addEvent })))
  const now = useToday()
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(todayStr())
  const [mode, setMode] = useState<Mode>('day')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ title: '', date: todayStr(), time: '' })

  /** 날짜를 고르면 그 달로 이동하고 '선택한 날' 목록을 보여줌 */
  const pick = (date: string) => {
    setSelected(date)
    setView({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 })
    setForm((f) => ({ ...f, date }))
    setMode('day')
    setQuery('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    if (!title || !form.date) return
    addEvent({ title, date: form.date, time: form.time })
    pick(form.date)
    setForm((f) => ({ ...f, title: '', time: '' }))
  }

  return (
    <div className={common.layout}>
      <div className={common.col}>
        <MonthGrid events={events} view={view} setView={setView} selected={selected} onPick={pick} />
        <UpcomingCard />
      </div>
      <div className={common.col}>
        <Card title="일정 기록하기">
          <form className={common.form} onSubmit={submit}>
            <label>
              일정 제목
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} placeholder="예) 월세 이체, 집주인 통화" required />
            </label>
            <div className={common.two}>
              <label>
                날짜
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label>
                시간 (선택)
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
            </div>
            <Button type="submit" block>
              일정 추가
            </Button>
          </form>
        </Card>
        <EventList events={events} selected={selected} mode={mode} setMode={setMode} query={query} setQuery={setQuery} onMoved={pick} />
      </div>
    </div>
  )
}

type GridProps = {
  events: CalEvent[]
  view: { y: number; m: number }
  setView: (v: { y: number; m: number }) => void
  selected: string
  onPick: (date: string) => void
}

function MonthGrid({ events, view, setView, selected, onPick }: GridProps) {
  const { y, m } = view
  const first = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const today = todayStr()
  const move = (delta: number) => {
    const d = new Date(y, m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <Card
      title={`${y}년 ${m + 1}월`}
      actions={
        <div className={styles.calNav}>
          <button type="button" onClick={() => move(-1)} aria-label="이전 달">
            ‹
          </button>
          <button type="button" className={styles.todayBtn} onClick={() => onPick(today)}>
            오늘
          </button>
          <button type="button" onClick={() => move(1)} aria-label="다음 달">
            ›
          </button>
        </div>
      }
    >
      <div className={styles.calGrid}>
        {DOW.map((d) => (
          <div key={d} className={styles.calDow}>
            {d}
          </div>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const ds = `${y}-${pad(m + 1)}-${pad(i + 1)}`
          const count = events.filter((ev) => ev.date === ds).length
          return (
            <button
              key={ds}
              type="button"
              className={cx(styles.calDay, ds === today && styles.calToday, ds === selected && styles.calSel)}
              onClick={() => onPick(ds)}
              aria-label={`${m + 1}월 ${i + 1}일${count ? `, 일정 ${count}개` : ''}`}
              aria-pressed={ds === selected}
            >
              <span>{i + 1}</span>
              <span className={styles.mark}>
                {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

type ListProps = {
  events: CalEvent[]
  selected: string
  mode: Mode
  setMode: (m: Mode) => void
  query: string
  setQuery: (q: string) => void
  onMoved: (date: string) => void
}

function EventList({ events, selected, mode, setMode, query, setQuery, onMoved }: ListProps) {
  const removeEvent = useLifeStore((s) => s.removeEvent)
  const [editingId, setEditingId] = useState<number | null>(null)

  // 검색어가 있으면 전체 일정에서 찾음
  const effectiveMode: Mode = query ? 'all' : mode
  let items = effectiveMode === 'day' ? events.filter((ev) => ev.date === selected) : events
  if (query) items = items.filter((ev) => ev.title.toLowerCase().includes(query.toLowerCase()))
  items = sortEvents(items)
  const title = (effectiveMode === 'day' ? `${monthDay(selected)} 일정` : '전체 일정') + (query ? ` · 검색: ${query}` : '')

  return (
    <Card
      title={title}
      actions={
        <Segmented
          label="일정 보기"
          value={effectiveMode}
          onChange={(v) => {
            setEditingId(null)
            setQuery('')
            setMode(v)
          }}
          options={[
            { value: 'day', label: '선택한 날' },
            { value: 'all', label: '전체' },
          ]}
        />
      }
    >
      <input
        type="search"
        className={cx(common.input, styles.search)}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="일정 제목 검색"
        aria-label="일정 검색"
      />
      <ul className={styles.evList}>
        {items.map((ev) =>
          ev.id === editingId ? (
            <EditRow
              key={ev.id}
              ev={ev}
              onDone={(saved) => {
                setEditingId(null)
                if (saved) onMoved(saved.date) // 날짜를 바꿨으면 그 날로 따라감
              }}
            />
          ) : (
            <li key={ev.id} className={styles.ev}>
              <span className={styles.evWhen}>
                {effectiveMode === 'all' && `${ev.date.slice(5).replace('-', '/')} `}
                {ev.time || '종일'}
              </span>
              <span className={styles.evName}>{ev.title}</span>
              <button type="button" className={styles.evEdit} onClick={() => setEditingId(ev.id)} aria-label={`${ev.title} 수정`}>
                수정
              </button>
              <button type="button" className={common.del} onClick={() => removeEvent(ev.id)} aria-label={`${ev.title} 삭제`} title="삭제">
                ×
              </button>
            </li>
          ),
        )}
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
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') onDone(null)
  }

  return (
    <li className={cx(styles.ev, styles.evEditing)} onKeyDown={onKey}>
      <div className={styles.evFields}>
        <input className={common.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={60} aria-label="일정 제목" autoFocus />
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

/** 달력 아래 "알림": 오늘 쓰레기 배출 + 월세 + 7일 안의 일정 */
function UpcomingCard() {
  const { events, settings } = useLifeStore(useShallow((s) => ({ events: s.events, settings: s.settings })))
  const td = todayTrash()
  const rdiff = dayDiff(fmt(nextRentDate(settings.rentDay)))
  const rows = [
    td
      ? { key: 'trash', ico: trashIco(td.t), t: `${td.t} 배출`, s: `오늘 ${td.d}`, b: '오늘', hot: true }
      : { key: 'trash', ico: '🗑️', t: '오늘은 쓰레기 배출 없음', s: '쓰레기는 모아 두세요', b: '오늘', hot: false },
    { key: 'rent', ico: '💸', t: '월세 납부', s: `매월 ${settings.rentDay}일 · ${settings.rent}만원`, b: rdiff === 0 ? '오늘' : `D-${rdiff}`, hot: rdiff <= 3 },
    ...sortEvents(events)
      .map((ev) => ({ ev, diff: dayDiff(ev.date) }))
      .filter(({ diff }) => diff >= 0 && diff <= 7)
      .map(({ ev, diff }) => ({ key: `ev${ev.id}`, ico: '📌', t: ev.title, s: `${monthDay(ev.date)} ${ev.time || '종일'}`, b: diff === 0 ? '오늘' : `D-${diff}`, hot: diff <= 1 })),
  ]

  return (
    <Card title="다가오는 일">
      {rows.map((r) => (
        <div key={r.key} className={common.noti}>
          <div className={common.notiIco}>{r.ico}</div>
          <div className={common.notiText}>
            <b>{r.t}</b>
            <small>{r.s}</small>
          </div>
          <span className={cx(common.badge, r.hot && common.badgeHot)}>{r.b}</span>
        </div>
      ))}
    </Card>
  )
}

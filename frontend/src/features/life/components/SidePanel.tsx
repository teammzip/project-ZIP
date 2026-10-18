import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'
import { DOW, monthKeyOf } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { TRASH, trashIco } from '../data/catalog'
import { monthsBetween, nextRentDate } from '../derive'
import { useLifeStore } from '../store'
import styles from './SidePanel.module.css'

type Props = {
  /** 닉네임은 로그인 정보(auth)에 있어서 쓰는 쪽이 넘겨 줌 */
  name: string
  onLogout: () => void
  logoutPending?: boolean
  className?: string
}

/** 오른쪽 패널: 프로필 · 월세/거주/계약 남음 · 이번 주 할 일 · 다가오는 알림 (기존 시안의 .panel) */
export function SidePanel({ name, onLogout, logoutPending, className }: Props) {
  const { settings, todos, addTodo, toggleTodo, removeTodo } = useLifeStore(
    useShallow((s) => ({ settings: s.settings, todos: s.todos, addTodo: s.addTodo, toggleTodo: s.toggleTodo, removeTodo: s.removeTodo })),
  )
  const now = useToday()
  const [text, setText] = useState('')
  const thisMonth = monthKeyOf(now)
  const lived = Math.max(0, monthsBetween(settings.moveIn, thisMonth))
  const left = Math.max(0, monthsBetween(thisMonth, settings.contractEnd))
  const done = todos.filter((t) => t.done).length

  const td = TRASH[now.getDay()]
  const rent = nextRentDate(settings.rentDay)
  // 다음 재활용 배출 요일 (내일부터 7일 안)
  const nextRecycle = [1, 2, 3, 4, 5, 6, 7].map((k) => ({ k, idx: (now.getDay() + k) % 7 })).find(({ idx }) => TRASH[idx]?.t === '재활용')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    addTodo(v)
    setText('')
  }

  return (
    <aside className={cx(styles.panel, className)} aria-label="내 요약">
      <div className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">
          {name.charAt(0)}
        </span>
        <div className={styles.who}>
          <b>{name}</b>
          <small>📍 {settings.region || '지역 미설정'}</small>
        </div>
        <button type="button" className={styles.logout} onClick={onLogout} disabled={logoutPending}>
          로그아웃
        </button>
      </div>

      <div className={styles.miniStats}>
        <div>
          <b>{settings.rent}만</b>
          <small>월세</small>
        </div>
        <div>
          <b>{lived}개월</b>
          <small>거주</small>
        </div>
        <div>
          <b>{left}개월</b>
          <small>계약 남음</small>
        </div>
      </div>

      <section>
        <h3>
          이번 주 할 일 {todos.length > 0 && <span className={common.count}>{done}/{todos.length}</span>}
        </h3>
        {todos.map((t) => (
          <label key={t.id} className={cx(styles.todo, t.done && styles.done)}>
            <input type="checkbox" className={common.checkbox} checked={t.done} onChange={(e) => toggleTodo(t.id, e.target.checked)} />
            <span>{t.text}</span>
            <button type="button" className={common.del} onClick={() => removeTodo(t.id)} aria-label={`${t.text} 삭제`} title="삭제">
              ×
            </button>
          </label>
        ))}
        {!todos.length && <p className={common.empty}>할 일이 없어요.</p>}
        <form className={common.inline} onSubmit={submit}>
          <input className={common.input} value={text} onChange={(e) => setText(e.target.value)} maxLength={40} placeholder="할 일 추가" aria-label="할 일 추가" />
          <Button type="submit">추가</Button>
        </form>
      </section>

      <section>
        <h3>다가오는 알림</h3>
        <div className={styles.sched}>
          <span className={styles.ico}>{td ? trashIco(td.t) : '🗑️'}</span>
          <div className={styles.t}>
            <b>{td ? `${td.t} 배출` : '오늘은 배출 없음'}</b>
            <small>{td ? `오늘 ${td.d}` : '쓰레기는 모아 두세요'}</small>
          </div>
          <time>오늘</time>
        </div>
        <div className={styles.sched}>
          <span className={styles.ico}>💸</span>
          <div className={styles.t}>
            <b>월세 납부</b>
            <small>{settings.rent}만원 · 이체</small>
          </div>
          <time>
            {rent.getMonth() + 1}/{rent.getDate()}
          </time>
        </div>
        <div className={styles.sched}>
          <span className={styles.ico}>♻️</span>
          <div className={styles.t}>
            <b>재활용 배출</b>
            <small>{nextRecycle ? TRASH[nextRecycle.idx]!.d : '배출 일정 없음'}</small>
          </div>
          <time>{nextRecycle ? (nextRecycle.k === 1 ? '내일' : `${DOW[nextRecycle.idx]}요일`) : ''}</time>
        </div>
      </section>
    </aside>
  )
}

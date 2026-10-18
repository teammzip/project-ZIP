import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Card } from '@/components/ui'
import { cssVar } from '@/lib/cssVar'
import { cx } from '@/lib/cx'
import { dayDiff, fmt, man, monthKeyOf, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { DONUT_COLORS } from '../data/catalog'
import { ddayText, monthKeyRentPaid, nextRentDate, spendBreakdown, sumAmount, todayTrash } from '../derive'
import { useLifeStore } from '../store'
import styles from './home.module.css'

/** 홈 요약 카드 4개: 할 일 · 공과금 · 쓰레기 배출 · 월세. 누르면 해당 화면으로 */
export function LifeStatGrid() {
  const navigate = useNavigate()
  const { todos, bills, settings, rentPaid } = useLifeStore(useShallow((s) => ({ todos: s.todos, bills: s.bills, settings: s.settings, rentPaid: s.rentPaid })))

  const done = todos.filter((t) => t.done).length
  const todoPct = todos.length ? Math.round((done / todos.length) * 100) : 0
  const billTotal = sumAmount(bills)
  const billPct = billTotal ? Math.round((sumAmount(bills.filter((b) => b.paid)) / billTotal) * 100) : 0
  const paidNames = bills.filter((b) => b.paid).map((b) => b.name)
  const leftNames = bills.filter((b) => !b.paid).map((b) => b.name)
  const billSub = [paidNames.length && `${paidNames.join(' · ')} 납부 완료`, leftNames.length && `${leftNames.join(' · ')} 남음`].filter(Boolean).join(', ')
  const td = todayTrash()
  const next = nextRentDate(settings.rentDay)

  const cards = [
    {
      key: 'todo', tone: styles.teal, to: '/my/todo', label: '이번 주 할 일',
      value: <>{todos.length - done}<small>개 남음</small></>, pct: todoPct,
      sub: todos.length ? `전체 ${todos.length}개 중 ${done}개 완료` : '할 일을 추가해 보세요',
    },
    {
      key: 'bill', tone: styles.sky, to: '/my/budget/expense', label: '이번 달 공과금',
      value: <>{billPct}<small>% 납부</small></>, pct: billPct,
      sub: billSub || '공과금 항목을 추가해 보세요',
    },
    {
      key: 'trash', tone: styles.pink, to: '/my/todo/trash', label: '쓰레기 배출',
      value: <span className={styles.valueSm}>{td ? `오늘은 ${td.t}` : '오늘은 배출 없음'}</span>,
      sub: td ? td.d : '내일 배출을 준비하세요',
    },
    {
      key: 'rent', tone: styles.purple, to: '/my/budget/expense', label: '월세 납부일',
      value: ddayText(dayDiff(fmt(next))),
      sub: `매월 ${settings.rentDay}일 · ${settings.rent}만원 · 계좌이체${monthKeyRentPaid(rentPaid, next) ? ' · 납부 완료' : ''}`,
    },
  ]

  return (
    <section className={styles.statGrid}>
      {cards.map((c) => (
        <button key={c.key} type="button" className={cx(styles.stat, c.tone)} onClick={() => navigate(c.to)} aria-label={`${c.label} 자세히 보기`}>
          <span className={styles.statLabel}>{c.label}</span>
          <span className={styles.statValue}>{c.value}</span>
          {c.pct !== undefined && (
            <span className={styles.statBar}>
              <i style={{ width: `${c.pct}%` }} />
            </span>
          )}
          <span className={styles.statSub}>{c.sub}</span>
        </button>
      ))}
    </section>
  )
}

/** 월별 수입 막대 그래프 (최근 6 · 12개월, 이번 달 강조) */
export function IncomeChart() {
  const incomes = useLifeStore((s) => s.incomes)
  const [range, setRange] = useState(6)
  const sums: Record<string, number> = {}
  for (const r of incomes) sums[r.date.slice(0, 7)] = (sums[r.date.slice(0, 7)] ?? 0) + r.amount
  const now = useToday()
  const months = Array.from({ length: range }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (range - 1 - i), 1)
    const key = monthKeyOf(d)
    return { key, label: `${d.getMonth() + 1}월`, sum: sums[key] ?? 0 }
  })
  const max = Math.max(...months.map((m) => m.sum))
  const cur = months[months.length - 1].sum
  const prev = months.length > 1 ? months[months.length - 2].sum : 0
  const diff = cur - prev

  return (
    <Card
      title="월별 수입"
      actions={
        <select className={common.select} value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="보기 기간">
          <option value={6}>최근 6개월</option>
          <option value={12}>최근 12개월</option>
        </select>
      }
    >
      <p className={styles.chartSum}>
        이번 달 {won(cur)}
        {prev || cur ? ` · 지난달보다 ${diff === 0 ? '같아요' : `${won(Math.abs(diff))} ${diff > 0 ? '많아요' : '적어요'}`}` : ' · 아직 기록이 없어요'}
      </p>
      <div className={cx(styles.chart, range > 6 && styles.dense)}>
        {months.map((m, i) => (
          <div key={m.key} className={cx(styles.col, i === months.length - 1 && styles.hl)} title={`${m.label} 수입 ${won(m.sum)}`}>
            <span className={styles.tip}>{man(m.sum)}</span>
            <span className={styles.b} style={{ height: `${max ? Math.max((m.sum / max) * 88, m.sum ? 4 : 1.5) : 1.5}%` }} />
            <span className={styles.colLabel}>{m.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** 이번 달(지난 달) 지출 구성 도넛: 월세 + 공과금 + 기타 지출 분류별 */
export function SpendDonut() {
  const { spends, bills, settings } = useLifeStore(useShallow((s) => ({ spends: s.spends, bills: s.bills, settings: s.settings })))
  const [back, setBack] = useState(0)
  let rows = spendBreakdown(back, spends, bills, settings).rows
  if (rows.length > 5) {
    // 많으면 상위 4개 + 나머지는 "그 외"로 묶음
    const rest = rows.slice(4).reduce((t, r) => t + r[1], 0)
    rows = [...rows.slice(0, 4), ['그 외', rest]]
  }
  const total = rows.reduce((t, r) => t + r[1], 0)
  let at = 0
  const stops = rows.map(([name, v]) => {
    const from = at
    at += (v / total) * 100
    return `${DONUT_COLORS[name] ?? 'var(--color-muted)'} ${from}% ${at}%`
  })

  return (
    <Card
      title="이번 달 지출 구성"
      actions={
        <select className={common.select} value={back} onChange={(e) => setBack(Number(e.target.value))} aria-label="보기 달">
          <option value={0}>이번 달</option>
          <option value={1}>지난 달</option>
        </select>
      }
    >
      <div className={styles.donutWrap}>
        <div
          className={styles.donut}
          style={{ background: total ? `conic-gradient(${stops.join(', ')})` : 'var(--color-line)' }}
          role="img"
          aria-label={`${back ? '지난 달' : '이번 달'} 지출 합계 ${won(total)}`}
        >
          <div className={styles.donutCenter}>
            <small>총 지출</small>
            <b>{man(total)}</b>
          </div>
        </div>
        <ul className={styles.legend}>
          {rows.map(([name, v]) => (
            <li key={name} style={cssVar({ '--c': DONUT_COLORS[name] ?? 'var(--color-muted)' })}>
              {name}
              <span>
                {Math.round((v / total) * 100)}% · {man(v)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {back === 1 && <p className={common.note}>지난 달은 월세·공과금을 이번 달과 같은 금액으로 계산해요.</p>}
    </Card>
  )
}

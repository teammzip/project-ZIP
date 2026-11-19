import { useQuery } from '@tanstack/react-query'
import { isMockApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { getMonthlyBills } from '../billsApi'
import { getLedger, getIncomeSummary } from '../ledgerApi'
import { useBillingTimeZone } from '../useBillingTimeZone'
import { useLocalMonth } from '../useLocalMonth'
import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Card } from '@/components/ui'
import { useLoanInterest } from '@/features/loan'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { cssVar } from '@/lib/cssVar'
import { cx } from '@/lib/cx'
import { man, monthKeyOf, todayStr, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { DONUT_COLORS } from '../data/catalog'
import { spendBreakdown } from '../derive'
import { useLifeStore } from '../store'
import { HomeAnnivCard } from './HomeAnnivCard'
import styles from './home.module.css'

const TodayScheduleDialog = lazy(() => import('./CalendarBoard').then((module) => ({ default: module.DayDetail })))
const WeatherCard = lazy(() => import('@/features/weather').then((module) => ({ default: module.WeatherCard })))

/** 홈 요약 카드 4개. 오늘 할 일은 홈에서 일정 모달로 확인. */
export function LifeStatGrid() {
  const navigate = useNavigate()
  const [todayOpen, setTodayOpen] = useState(false)
  const todayButton = useRef<HTMLButtonElement>(null)
  const addEvent = useLifeStore((s) => s.addEvent)
  const allEvents = useLifeStore((s) => s.events)
  const events = allEvents.filter((e) => !e.anniv) // 기념일은 끝낼 일이 아니라서 남은 일 개수에서 뺌

  const today = todayStr()
  const doneCount = events.filter((e) => e.done).length
  const allPct = events.length ? Math.round((doneCount / events.length) * 100) : 0
  const todays = events.filter((e) => e.date === today)
  const todayLeft = todays.filter((e) => !e.done)
  const todayPct = todays.length ? Math.round(((todays.length - todayLeft.length) / todays.length) * 100) : 0
  let todaySub = todayLeft.length ? todayLeft.slice(0, 2).map((e) => e.title).join(' · ') : todays.length ? '오늘 할 일을 모두 끝냈어요!' : '오늘 등록된 할 일이 없어요.'
  if (todayLeft.length > 2) todaySub += ` 외 ${todayLeft.length - 2}개`

  const cards = [
    {
      key: 'all', tone: styles.teal, to: '/my/calendar?mode=all', label: '전체 일정',
      value: <>{events.length - doneCount}<small>개 남음</small></>, pct: allPct,
      sub: events.length ? `전체 ${events.length}개 중 ${doneCount}개 완료` : '일정을 추가해 보세요.',
    },
    {
      key: 'today', tone: styles.sky, to: '', label: '오늘 할 일',
      value: <>{todayLeft.length}<small>개 남음</small></>, pct: todayPct,
      sub: todaySub,
    },
  ]

  return (
    <>
      <section className={styles.statGrid}>
        {cards.map((c) => (
          <button
            key={c.key}
            ref={c.key === 'today' ? todayButton : undefined}
            type="button"
            className={cx(styles.stat, c.tone)}
            onClick={() => c.key === 'today' ? setTodayOpen(true) : navigate(c.to)}
            aria-label={`${c.label} 자세히 보기`}
            aria-haspopup={c.key === 'today' ? 'dialog' : undefined}
          >
            <span className={styles.statLabel}>{c.label}</span>
            <span className={styles.statValue}>{c.value}</span>
            {c.pct !== undefined && (
              <span className={styles.statBar}>
                <i style={{ width: `${c.pct}%` }} />
              </span>
            )}
            <span className={styles.statSub} title={c.sub}>
              {c.sub}
            </span>
          </button>
        ))}
        <Suspense fallback={<div className={cx(styles.stat, styles.purple)} role="status"><span className={styles.statLabel}>오늘 날씨</span><span className={styles.statSub}>날씨를 준비하는 중…</span></div>}>
          <WeatherCard />
        </Suspense>
        <HomeAnnivCard />
      </section>
      {todayOpen && (
        <Suspense fallback={<p role="status">오늘 일정을 불러오는 중이에요.</p>}>
          <TodayScheduleDialog
            date={today}
            onClose={() => {
              setTodayOpen(false)
              todayButton.current?.focus()
            }}
            onAdd={(title, time) => addEvent({ title, date: today, time })}
          />
        </Suspense>
      )}
    </>
  )
}

/** 월별 수입 막대 그래프 (최근 6 · 12개월, 이번 달 강조) */
export function IncomeChart() {
  return isMockApi ? <IncomeChartView /> : <ServerIncomeChart />
}

function ServerIncomeChart() {
  const user = useAuthStore((s) => s.user?.id), token = useAuthStore((s) => s.token)
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const query = useQuery({ queryKey: ['ledger', user, token, 'income-summary', timeZone, currentMonth], queryFn: ({ signal }) => getIncomeSummary(timeZone, signal), enabled: !!user && !!token && !resolving && (!preferred || preferred === timeZone), gcTime: 0, staleTime: 0, refetchInterval: 60000, retry: false })
  if (!user || !token) return <Card title="월별 수입"><p>로그인 후 조회해 주세요.</p></Card>
  if (resolving || query.isPending) return <Card title="월별 수입"><p role="status">불러오는 중이에요.</p></Card>
  if (query.isError) return <Card title="월별 수입"><p role="alert">{getErrorMessage(query.error, '수입을 조회하지 못했어요.')}</p></Card>
  return <IncomeChartView serverSums={query.data} serverMonth={currentMonth} />
}

function IncomeChartView({ serverSums, serverMonth }: { serverSums?: Record<string, number>; serverMonth?: string }) {
  const incomes = useLifeStore((s) => s.incomes)
  const [range, setRange] = useState(6)
  const sums: Record<string, number> = serverSums ? { ...serverSums } : {}
  if (!serverSums) for (const r of incomes) sums[r.date.slice(0, 7)] = (sums[r.date.slice(0, 7)] ?? 0) + r.amount
  const now = useToday()
  const chartDate = serverMonth ? new Date(`${serverMonth}-01T12:00:00`) : now
  const months = Array.from({ length: range }, (_, i) => {
    const d = new Date(chartDate.getFullYear(), chartDate.getMonth() - (range - 1 - i), 1)
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
        <div className={styles.chartActions}>
          <select className={common.select} value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="보기 기간">
            <option value={6}>최근 6개월</option>
            <option value={12}>최근 12개월</option>
          </select>
          <Link to="/my/budget/income" className={common.link} aria-label="수입 내역 더 보기">
            더 보기
          </Link>
        </div>
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
  return isMockApi ? <LocalSpendDonut /> : <ServerSpendDonut />
}

function ServerSpendDonut() {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [back, setBack] = useState(0)
  const [year, number] = currentMonth.split('-').map(Number)
  const month = back ? monthKeyOf(new Date(year, number - 2, 1)) : currentMonth
  const query = useQuery({
    queryKey: ['monthly-bills', userId, token, timeZone, month],
    queryFn: ({ signal }) => getMonthlyBills(month, timeZone, signal),
    enabled: !!userId && !!token && ready,
    gcTime: 0, staleTime: 0, refetchInterval: 60000,
    refetchOnWindowFocus: 'always', retry: false,
  })
  const expenses = useQuery({ queryKey: ['ledger', userId, token, 'spend', timeZone, month], queryFn: ({ signal }) => getLedger('spend', month, timeZone, 'fixed', signal), enabled: !!userId && !!token && ready, gcTime: 0, staleTime: 0, refetchInterval: 60000, retry: false })
  if (!userId || !token) return <Card title="이번 달 지출 구성"><p>로그인 후 조회해 주세요.</p></Card>
  if (!ready || query.isPending || expenses.isPending) return <Card title="이번 달 지출 구성"><p role="status">지출 내역을 불러오는 중이에요.</p></Card>
  if (expenses.isError) return <Card title="이번 달 지출 구성"><p role="alert">{getErrorMessage(expenses.error, '기타 지출을 조회하지 못했어요.')}</p><button onClick={() => void expenses.refetch()}>다시 조회</button></Card>
  if (query.isError) return <Card title="이번 달 지출 구성"><p role="alert">{getErrorMessage(query.error, '지출 내역을 불러오지 못했어요.')}</p><button onClick={() => void query.refetch()}>다시 조회</button></Card>
  const sums = new Map<string, number>()
  for (const bill of [...(query.data?.housingItems ?? []), ...(query.data?.items ?? [])]) {
    sums.set(bill.tag, (sums.get(bill.tag) ?? 0) + bill.amount)
  }
  for (const spend of expenses.data ?? []) {
    if (spend.date.slice(0, 7) === month) sums.set(spend.cat, (sums.get(spend.cat) ?? 0) + spend.amount)
  }
  return <SpendDonutView rows={[...sums].sort((a, b) => b[1] - a[1])} back={back} setBack={setBack}
    note="고정 지출과 기타 지출 모두 서버 기록을 반영해요. 고정 지출은 미납·예정 금액을 포함해요." />
}

function LocalSpendDonut() {
  const { kind, isJeonse } = useHousingContract()
  const { charges } = useLoanInterest()
  const { spends, bills, settings } = useLifeStore(useShallow((s) => ({ spends: s.spends, bills: s.bills, settings: s.settings })))
  const [back, setBack] = useState(0)
  const rows = spendBreakdown(back, spends, bills, settings, charges, kind).rows
  return <SpendDonutView rows={rows} back={back} setBack={setBack} note={back === 1 ? (isJeonse ? '지난 달 공과금은 이번 달과 같은 금액으로 계산해요.' : '지난 달은 월세·공과금을 이번 달과 같은 금액으로 계산해요.') : undefined} />
}

function SpendDonutView({ rows: sourceRows, back, setBack, note }: {
  rows: [string, number][]; back: number; setBack: (value: number) => void; note?: string
}) {
  let rows = sourceRows
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
        <div className={styles.chartActions}>
          <select className={common.select} value={back} onChange={(e) => setBack(Number(e.target.value))} aria-label="보기 달">
            <option value={0}>이번 달</option>
            <option value={1}>지난 달</option>
          </select>
          <Link to="/my/budget/expense" className={common.link} aria-label="지출 내역 더 보기">
            더 보기
          </Link>
        </div>
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
      {note && <p className={common.note}>{note}</p>}
    </Card>
  )
}

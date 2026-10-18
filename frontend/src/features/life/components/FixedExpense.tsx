import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import { DOW, dayDiff, fmt, monthKeyOf, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { ddayText, nextRentDate, sumAmount } from '../derive'
import { useLifeStore } from '../store'
import styles from './life.module.css'

/** 고정 지출 = 합계 카드 + 월세 + 공과금 (한 화면에 합쳐 보여줌) */
export function FixedExpense() {
  return (
    <div className={common.stack}>
      <FixedSummary />
      <RentSection />
      <BillsSection />
    </div>
  )
}

function FixedSummary() {
  const { bills, settings } = useLifeStore(useShallow((s) => ({ bills: s.bills, settings: s.settings })))
  const rent = (Number(settings.rent) || 0) * 10000 // 월세는 만원 단위로 저장돼 있음
  const billSum = sumAmount(bills)
  const paid = sumAmount(bills.filter((b) => b.paid))

  return (
    <div className={styles.fixedSum}>
      <article className={cx(styles.sumCard, styles.sumTotal)}>
        <small>이번 달 고정 지출 합계</small>
        <b>{won(rent + billSum)}</b>
        <span>
          월세 {won(rent)} + 공과금 {won(billSum)}
        </span>
      </article>
      <article className={styles.sumCard}>
        <small>월세</small>
        <b>{won(rent)}</b>
        <span>매달 {settings.rentDay}일 납부</span>
      </article>
      <article className={styles.sumCard}>
        <small>공과금</small>
        <b>{won(billSum)}</b>
        <span>{bills.length ? `납부 ${won(paid)} · 남음 ${won(billSum - paid)}` : '등록된 항목이 없어요'}</span>
      </article>
    </div>
  )
}

function RentSection() {
  const { settings, rentPaid, setRentPaid, events, addEvent } = useLifeStore(
    useShallow((s) => ({ settings: s.settings, rentPaid: s.rentPaid, setRentPaid: s.setRentPaid, events: s.events, addEvent: s.addEvent })),
  )
  const [msg, setMsg] = useState('')
  const next = nextRentDate(settings.rentDay)
  const nextStr = fmt(next)
  const now = useToday()
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1))

  const addToCalendar = () => {
    const exists = events.some((ev) => ev.date === nextStr && ev.title === '월세 납부')
    if (!exists) addEvent({ date: nextStr, time: '', title: '월세 납부' })
    setMsg(exists ? '이미 캘린더에 있어요.' : `${next.getMonth() + 1}월 ${next.getDate()}일 일정으로 추가했어요.`)
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <div className={common.layout}>
      <Card title="다음 월세 납부">
        <div className={styles.rentHero}>
          <b>{ddayText(dayDiff(nextStr))}</b>
          <span>
            {next.getFullYear()}년 {next.getMonth() + 1}월 {next.getDate()}일 ({DOW[next.getDay()]})
          </span>
        </div>
        <div className={styles.infoRows}>
          <div>
            <small>금액</small>
            <b>{settings.rent}만원</b>
          </div>
          <div>
            <small>납부일</small>
            <b>매월 {settings.rentDay}일</b>
          </div>
          <div>
            <small>납부 방법</small>
            <b>계좌이체</b>
          </div>
        </div>
        <div className={cx(common.actions, styles.mt14)}>
          <Button onClick={addToCalendar}>캘린더에 일정 추가</Button>
          <Link to="/my/settings" className={styles.lineLink}>
            금액·날짜 수정
          </Link>
        </div>
        <p className={common.saved} role="status">
          {msg}
        </p>
      </Card>

      <Card title="납부 내역 (최근 6개월)">
        {months.map((d, i) => {
          const key = monthKeyOf(d)
          return (
            <label key={key} className={styles.rentRow}>
              <input type="checkbox" className={common.checkbox} checked={!!rentPaid[key]} onChange={(e) => setRentPaid(key, e.target.checked)} />
              <span>
                {d.getFullYear()}년 {d.getMonth() + 1}월
              </span>
              <small>{rentPaid[key] ? '납부 완료' : i === 0 ? '이번 달 · 미납' : '미납'}</small>
            </label>
          )
        })}
      </Card>
    </div>
  )
}

function BillsSection() {
  const { bills, addBill, toggleBill, removeBill, resetBills } = useLifeStore(
    useShallow((s) => ({ bills: s.bills, addBill: s.addBill, toggleBill: s.toggleBill, removeBill: s.removeBill, resetBills: s.resetBills })),
  )
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const month = useToday().getMonth() + 1
  const total = sumAmount(bills)
  const paid = sumAmount(bills.filter((b) => b.paid))
  const pct = total ? Math.round((paid / total) * 100) : 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addBill(name.trim(), Math.max(0, Number(amount) || 0))
    setName('')
    setAmount('')
  }

  return (
    <div className={common.layout}>
      <Card title={`${month}월 공과금`}>
        <div className={common.sumRow}>
          <div>
            <small>전체</small>
            <b>{won(total)}</b>
          </div>
          <div>
            <small>납부</small>
            <b>{won(paid)}</b>
          </div>
          <div>
            <small>남음</small>
            <b>{won(total - paid)}</b>
          </div>
        </div>
        <div className={common.bar}>
          <i style={{ width: `${pct}%` }} />
        </div>
        {bills.map((b) => (
          <div key={b.id} className={cx(styles.bill, b.paid && styles.billPaid)}>
            <input type="checkbox" className={common.checkbox} checked={b.paid} onChange={(e) => toggleBill(b.id, e.target.checked)} aria-label={`${b.name} 납부`} />
            <div className={styles.billName}>
              <b>{b.name}</b>
              <small>
                {won(b.amount)} · {b.paid ? '납부 완료' : '미납'}
              </small>
            </div>
            <button type="button" className={common.del} onClick={() => removeBill(b.id)} aria-label={`${b.name} 삭제`} title="삭제">
              ×
            </button>
          </div>
        ))}
        {!bills.length && <p className={common.empty}>등록된 공과금이 없어요.</p>}
      </Card>

      <Card title="항목 추가">
        <form className={common.form} onSubmit={submit}>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예) 인터넷, 관리비" required />
          </label>
          <label>
            금액 (원)
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} max={9999999} required />
          </label>
          <Button type="submit" block>
            추가
          </Button>
        </form>
        <p className={common.note}>다음 달이 되면 "새 달 시작"으로 납부 체크를 한 번에 풀 수 있어요.</p>
        <Button variant="line" className={styles.mt10} onClick={resetBills}>
          새 달 시작 (체크 모두 풀기)
        </Button>
      </Card>
    </div>
  )
}

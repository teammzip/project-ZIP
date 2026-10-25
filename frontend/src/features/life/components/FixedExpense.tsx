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
import { BILL_TAGS } from '../types'
import styles from './life.module.css'

/** 고정 지출 = 합계 카드 + 이번 달 납부 체크리스트 (월세와 공과금을 한 카드에 합침) */
export function FixedExpense() {
  return (
    <div className={common.stack}>
      <FixedSummary />
      <PayChecklist />
    </div>
  )
}

function FixedSummary() {
  const { bills, settings } = useLifeStore(useShallow((s) => ({ bills: s.bills, settings: s.settings })))
  const month = monthKeyOf(useToday())
  const rent = (Number(settings.rent) || 0) * 10000 // 월세는 만원 단위로 저장돼 있음
  const billSum = sumAmount(bills)
  const utilities = bills.filter((b) => b.tag === '공과금') // 공과금 태그가 붙은 항목만 따로 합산
  const utilSum = sumAmount(utilities)
  const paid = sumAmount(utilities.filter((b) => b.paidMonth === month))

  return (
    <div className={styles.fixedSum}>
      <article className={cx(styles.sumCard, styles.sumTotal)}>
        <small>이번 달 고정 지출 합계</small>
        <b>{won(rent + billSum)}</b>
        <span>
          월세 {won(rent)} + 그 밖의 고정 지출 {won(billSum)}
        </span>
      </article>
      <article className={styles.sumCard}>
        <small>월세</small>
        <b>{won(rent)}</b>
        <span>매달 {settings.rentDay}일 납부</span>
      </article>
      <article className={styles.sumCard}>
        <small>공과금</small>
        <b>{won(utilSum)}</b>
        <span>{utilities.length ? `납부 ${won(paid)} · 남음 ${won(utilSum - paid)}` : '공과금 태그 항목이 없어요'}</span>
      </article>
    </div>
  )
}

/** 이번 달 납부 체크리스트: 월세 줄 + 공과금 줄을 같은 방식으로 체크.
 * 월세 줄의 '자세히'를 누르면 금액 · 납부일 · 납부 방법과 캘린더 추가가 펼쳐짐 */
function PayChecklist() {
  const { settings, rentPaid, setRentPaid, events, addEvent, bills, addBill, toggleBill, removeBill } = useLifeStore(
    useShallow((s) => ({
      settings: s.settings,
      rentPaid: s.rentPaid,
      setRentPaid: s.setRentPaid,
      events: s.events,
      addEvent: s.addEvent,
      bills: s.bills,
      addBill: s.addBill,
      toggleBill: s.toggleBill,
      removeBill: s.removeBill,
    })),
  )
  const now = useToday()
  const month = now.getMonth() + 1
  const monthKey = monthKeyOf(now)
  const next = nextRentDate(settings.rentDay)
  const nextStr = fmt(next)

  const [open, setOpen] = useState(false) // 월세 자세히
  const [adding, setAdding] = useState(false) // 항목 추가 입력칸
  const [msg, setMsg] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [tag, setTag] = useState<string>(BILL_TAGS[0])

  const rent = (Number(settings.rent) || 0) * 10000
  const rentDone = !!rentPaid[monthKey]
  const total = rent + sumAmount(bills)
  const isPaid = (b: { paidMonth: string | null }) => b.paidMonth === monthKey // 달이 바뀌면 저절로 미납으로 돌아옴
  const paid = (rentDone ? rent : 0) + sumAmount(bills.filter(isPaid))
  const count = 1 + bills.length
  const doneCount = (rentDone ? 1 : 0) + bills.filter(isPaid).length
  const pct = total ? Math.round((paid / total) * 100) : 0
  // 태그별 합계 (월세는 따로 보여 주므로 제외)
  const tagSums = BILL_TAGS.map((t) => ({ tag: t, sum: sumAmount(bills.filter((b) => b.tag === t)), n: bills.filter((b) => b.tag === t).length })).filter((x) => x.n)

  const addToCalendar = () => {
    const exists = events.some((ev) => ev.date === nextStr && ev.title === '월세 납부')
    if (!exists) addEvent({ date: nextStr, time: '', title: '월세 납부' })
    setMsg(exists ? '이미 캘린더에 있어요.' : `${next.getMonth() + 1}월 ${next.getDate()}일 일정으로 추가했어요.`)
    setTimeout(() => setMsg(''), 2500)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addBill(name.trim(), Math.max(0, Number(amount) || 0), tag)
    setName('')
    setAmount('')
    setTag(BILL_TAGS[0])
    setAdding(false)
  }

  return (
    <Card
      title={`${month}월 납부 체크리스트`}
      actions={<span className={styles.nextTag}>다음 월세 {ddayText(dayDiff(nextStr))} · {next.getMonth() + 1}/{next.getDate()}</span>}
    >
      <div className={common.bar}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.checkNote}>
        <span>
          {count}개 중 {doneCount}개 완료
        </span>
        <span>남은 금액 {won(total - paid)}</span>
      </div>
      {tagSums.length > 0 && (
        <div className={styles.tagSums} aria-label="태그별 합계">
          {tagSums.map((x) => (
            <span key={x.tag}>
              <i className={styles.tagBadge}>{x.tag}</i> {won(x.sum)}
            </span>
          ))}
        </div>
      )}

      <div className={styles.checkRent}>
        <div className={cx(styles.bill, rentDone && styles.billPaid)}>
          <input type="checkbox" className={common.checkbox} checked={rentDone} onChange={(e) => setRentPaid(monthKey, e.target.checked)} aria-label="월세 납부" />
          <div className={styles.billName}>
            <b>월세</b>
            <small>
              매달 {settings.rentDay}일 · {won(rent)} · {rentDone ? '납부 완료' : '미납'}
            </small>
          </div>
          <button type="button" className={styles.moreBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? '접기 ▴' : '자세히 ▾'}
          </button>
        </div>
        {open && (
          <div className={styles.checkMore}>
            <div className={styles.infoRows}>
              <div>
                <small>금액</small>
                <b>{settings.rent}만원</b>
              </div>
              <div>
                <small>다음 납부일</small>
                <b>
                  {next.getFullYear()}년 {next.getMonth() + 1}월 {next.getDate()}일 ({DOW[next.getDay()]})
                </b>
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
          </div>
        )}
      </div>

      {bills.map((b) => (
        <div key={b.id} className={cx(styles.bill, isPaid(b) && styles.billPaid)}>
          <input type="checkbox" className={common.checkbox} checked={isPaid(b)} onChange={(e) => toggleBill(b.id, e.target.checked)} aria-label={`${b.name} 납부`} />
          <div className={styles.billName}>
            <b>
              {b.name} <i className={styles.tagBadge}>{b.tag}</i>
            </b>
            <small>
              {won(b.amount)} · {isPaid(b) ? '납부 완료' : '미납'}
            </small>
          </div>
          <button type="button" className={common.del} onClick={() => removeBill(b.id)} aria-label={`${b.name} 삭제`} title="삭제">
            ×
          </button>
        </div>
      ))}
      {!bills.length && <p className={common.empty}>등록된 항목이 없어요.</p>}

      {adding ? (
        <form className={cx(common.form, styles.addForm)} onSubmit={submit}>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예) 인터넷, 관리비" required autoFocus />
          </label>
          <label>
            금액 (원)
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} max={9999999} required />
          </label>
          <div className={styles.tagPick} role="group" aria-label="태그">
            {BILL_TAGS.map((t) => (
              <button key={t} type="button" className={cx(styles.tagOpt, tag === t && styles.tagOptOn)} aria-pressed={tag === t} onClick={() => setTag(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className={common.actions}>
            <Button type="submit">추가</Button>
            <Button variant="line" onClick={() => setAdding(false)}>
              취소
            </Button>
          </div>
        </form>
      ) : (
        <button type="button" className={styles.addToggle} onClick={() => setAdding(true)}>
          ＋ 항목 추가
        </button>
      )}

      <p className={common.note}>달이 바뀌면 납부 체크는 저절로 풀려요.</p>
    </Card>
  )
}

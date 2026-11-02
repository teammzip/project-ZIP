import { useEffect, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AmountInput, Button, Card, Modal } from '@/components/ui'
import { LoanInterestCard, loanMonthSummary, useLoanInterest } from '@/features/loan'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { cx } from '@/lib/cx'
import { cssVar } from '@/lib/cssVar'
import { dayDiff, fmt, monthKeyOf, monthLabel, won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { ddayText, nextRentDate, sumAmount } from '../derive'
import { useLifeStore } from '../store'
import { BILL_TAGS, type Bill } from '../types'
import { billPaidInMonth } from '../payments'
import styles from './life.module.css'
import { LifeInfoForm } from './MyInfo'
import { useHousingSurveyStore } from '@/features/onboarding/store'

/** 고정 지출 = 합계 카드 + 이번 달 납부 체크리스트 (월세와 공과금을 한 카드에 합침) */
export function FixedExpense() {
  const { isJeonse } = useHousingContract()
  const [currentMonth, setCurrentMonth] = useState(() => monthKeyOf(new Date()))
  const [chosenMonth, setChosenMonth] = useState('')
  const { bills, rentPaid } = useLifeStore(useShallow((s) => ({ bills: s.bills, rentPaid: s.rentPaid })))
  const { charges } = useLoanInterest()
  useEffect(() => {
    const refresh = () => setCurrentMonth(monthKeyOf(new Date()))
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const monthKey = chosenMonth || currentMonth
  const [year, month] = currentMonth.split('-').map(Number)
  const recentMonths = Array.from({ length: 12 }, (_, back) => monthKeyOf(new Date(year, month - 1 - back, 1)))
  const months = [...new Set([
    ...recentMonths, monthKey, ...Object.keys(rentPaid),
    ...bills.flatMap((bill) => [...Object.keys(bill.paidMonths ?? {}), ...(bill.paidMonth ? [bill.paidMonth] : [])]),
    ...charges.map((charge) => charge.date.slice(0, 7)),
  ])].filter((key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key)).sort().reverse()
  return (
    <div className={common.stack}>
      <FixedSummary month={monthKey} months={months} onMonthChange={(key) => setChosenMonth(key === currentMonth ? '' : key)} />
      {isJeonse && <LoanInterestCard />}
      <PayChecklist monthKey={monthKey} />
    </div>
  )
}

function FixedSummary({ month, months, onMonthChange }: { month: string; months: string[]; onMonthChange: (month: string) => void }) {
  const { isJeonse, isMonthly, survey } = useHousingContract()
  const { bills: storedBills, settings } = useLifeStore(useShallow((s) => ({ bills: s.bills, settings: s.settings })))
  const bills = isMonthly && survey?.mgmtIncluded ? storedBills.filter((b) => b.tag !== '관리비') : storedBills
  const loan = useLoanInterest()
  const interest = loanMonthSummary(isJeonse ? loan.plan : undefined, isJeonse ? loan.charges : [], month)
  const rent = isMonthly ? (Number(settings.rent) || 0) * 10000 : 0
  const billSum = sumAmount(bills)
  const rentPaid = useLifeStore((s) => !!s.rentPaid[month])
  const total = rent + billSum + interest.expectedAmount
  const paid = (rentPaid ? rent : 0) + sumAmount(bills.filter((b) => billPaidInMonth(b, month))) + interest.recordedAmount
  const groups = [
    ...(isMonthly ? [{ name: survey?.mgmtIncluded ? '월세 · 관리비 포함' : '월세', amount: rent, color: '#6485df' }] : []),
    ...BILL_TAGS.map((tag, index) => ({ name: tag, amount: sumAmount(bills.filter((bill) => bill.tag === tag)), color: ['#ef9b66', '#68b6a0', '#a28ad6', '#e4bd61', '#91a2b5'][index] })),
    { name: '대출 이자', amount: interest.expectedAmount, color: '#d884aa' },
  ].filter((group) => group.amount > 0).sort((a, b) => b.amount - a.amount)
  const stops = groups.map((group, index) => {
    const from = groups.slice(0, index).reduce((sum, previous) => sum + previous.amount, 0) / total * 100
    const to = from + group.amount / total * 100
    return group.color + ' ' + from + '% ' + to + '%'
  })
  return <Card title={Number(month.slice(5)) + '월 고정 지출'} actions={
    <select className={common.select} value={month} onChange={(e) => onMonthChange(e.target.value)} aria-label="월 선택">
      {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
    </select>
  }>
    <div className={common.sumRow}>
      <div><small>합계</small><b>{won(total)}</b></div>
      <div><small>납부 완료</small><b>{won(paid)}</b></div>
      <div><small>남은 금액</small><b>{won(Math.max(0, total - paid))}</b></div>
    </div>
    {total > 0 ? <div className={styles.moneyDonutWrap}>
      <div className={styles.moneyDonut} style={{ background: 'conic-gradient(' + stops.join(', ') + ')' }} role="img" aria-label={'고정 지출 합계 ' + won(total)}>
        <div className={styles.moneyDonutCenter}><small>총 고정 지출</small><b>{won(total)}</b></div>
      </div>
      <ul className={styles.moneyLegend}>
        {groups.map((group) => <li key={group.name} style={cssVar({ '--c': group.color })}>
          {group.name}<span>{Math.round(group.amount / total * 100)}% · {won(group.amount)}</span>
        </li>)}
      </ul>
    </div> : <p className={common.empty}>등록된 고정 지출이 없어요.</p>}
  </Card>
}

/** 이번 달 납부 체크리스트: 월세 줄 + 공과금 줄을 같은 방식으로 체크.
 * 월세 줄의 '자세히'를 누르면 금액 · 납부일 · 납부 방법과 캘린더 추가가 펼쳐짐 */
function PayChecklist({ monthKey }: { monthKey: string }) {
  const { isMonthly, isJeonse, survey } = useHousingContract()
  const updateBill = useLifeStore((s) => s.updateBill)
  const saveSurvey = useHousingSurveyStore((s) => s.save)
  const [editingBill, setEditingBill] = useState<number | null>(null)
  const [editingHousing, setEditingHousing] = useState(false)
  const { settings, rentPaid, setRentPaid, bills: storedBills, addBill, toggleBill, removeBill } = useLifeStore(
    useShallow((s) => ({
      settings: s.settings,
      rentPaid: s.rentPaid,
      setRentPaid: s.setRentPaid,
      bills: s.bills,
      addBill: s.addBill,
      toggleBill: s.toggleBill,
      removeBill: s.removeBill,
    })),
  )
  const bills = isMonthly && survey?.mgmtIncluded ? storedBills.filter((b) => b.tag !== '관리비') : storedBills
  const month = Number(monthKey.slice(5))
  const loan = useLoanInterest()
  const interest = loanMonthSummary(isJeonse ? loan.plan : undefined, isJeonse ? loan.charges : [], monthKey)
  const next = nextRentDate(settings.rentDay)
  const nextStr = fmt(next)

  const [open, setOpen] = useState(false) // 월세 자세히
  const [adding, setAdding] = useState(false) // 항목 추가 입력칸
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [tag, setTag] = useState<string>(BILL_TAGS[0])

  const rent = isMonthly ? (Number(settings.rent) || 0) * 10000 : 0
  const rentDone = isMonthly && !!rentPaid[monthKey]
  const total = rent + sumAmount(bills) + interest.expectedAmount
  const isPaid = (b: Bill) => billPaidInMonth(b, monthKey)
  const paid = (rentDone ? rent : 0) + sumAmount(bills.filter(isPaid)) + interest.recordedAmount
  const count = Number(isMonthly) + bills.length + interest.scheduledCount
  const doneCount = (rentDone ? 1 : 0) + bills.filter(isPaid).length + interest.recordedCount
  const pct = total ? Math.round((paid / total) * 100) : 0
  // 태그별 합계 (월세는 따로 보여 주므로 제외)
  const tagSums = BILL_TAGS.map((t) => ({ tag: t, sum: sumAmount(bills.filter((b) => b.tag === t)), n: bills.filter((b) => b.tag === t).length })).filter((x) => x.n)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || (isMonthly && survey?.mgmtIncluded && tag === '관리비')) return
    const values = { name: name.trim(), amount: Math.max(0, Number(amount) || 0), tag }
    if (editingBill !== null) {
      updateBill(editingBill, values)
      if (survey && values.name === '관리비' && values.tag === '관리비') saveSurvey({ ...survey, mgmtFee: values.amount })
    } else addBill(values.name, values.amount, values.tag)
    setName('')
    setAmount('')
    setTag(BILL_TAGS[0])
    setAdding(false)
    setEditingBill(null)
  }
  const editBill = (bill: Bill) => {
    setEditingBill(bill.id)
    setName(bill.name)
    setAmount(String(bill.amount))
    setTag(bill.tag)
    setAdding(true)
  }
  const closeEditor = () => { setAdding(false); setEditingBill(null); setName(''); setAmount(''); setTag(BILL_TAGS[0]) }

  return (
    <Card
      title={`${month}월 납부 체크리스트`}
      actions={isMonthly ? <span className={styles.nextTag}>다음 월세 {ddayText(dayDiff(nextStr))} · {next.getMonth() + 1}/{next.getDate()}</span> : undefined}
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

      {isMonthly && <Card title={survey?.mgmtIncluded ? '월세 · 관리비 포함' : '월세'} className={styles.paymentCard} actions={<Button variant="line" onClick={() => setEditingHousing(true)}>수정</Button>}>
        <div className={cx(styles.bill, rentDone && styles.billPaid)}>
          <input type="checkbox" className={common.checkbox} checked={rentDone} onChange={(e) => setRentPaid(monthKey, e.target.checked)} aria-label={survey?.mgmtIncluded ? '월세 및 포함 관리비 납부' : '월세 납부'} />
          <div className={styles.billName}>
            <b>월세{survey?.mgmtIncluded ? ' (관리비 포함)' : ''}</b>
            <small>
              매달 {settings.rentDay}일 · {won(rent)} · {rentDone ? '납부 완료' : '미납'}
            </small>
          </div>
          <button type="button" className={styles.moreBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? '접기 ▴' : '자세히 ▾'}
          </button>
        </div>
        {open && <RentDetails />}
      </Card>}

      {interest.scheduledCount > 0 && <div className={cx(styles.bill, interest.recordedCount === interest.scheduledCount && styles.billPaid)}>
        <span aria-hidden="true">💳</span>
        <div className={styles.billName}>
          <b>전세 대출 이자</b>
          <small>이번 달 예정 {won(interest.expectedAmount)} · 지출 기록 {won(interest.recordedAmount)}{interest.pendingAmount > 0 && ` · ${interest.dueDate} 기록 예정`}</small>
        </div>
        <span className={styles.tagBadge}>자동 기록</span>
      </div>}

      {bills.some((b) => b.tag === '관리비') && <Card title="관리비 · 별도 납부" className={styles.paymentCard}>
        {bills.filter((b) => b.tag === '관리비').map((bill) => <BillPayment key={bill.id} bill={bill} month={monthKey} onToggle={toggleBill} onRemove={removeBill} onEdit={editBill} />)}
      </Card>}
      {bills.some((b) => b.tag !== '관리비') && <Card title="공과금 · 그 밖의 고정 지출" className={styles.paymentCard}>
        {bills.filter((b) => b.tag !== '관리비').map((bill) => <BillPayment key={bill.id} bill={bill} month={monthKey} onToggle={toggleBill} onRemove={removeBill} onEdit={editBill} />)}
      </Card>}
      {count === 0 && <p className={common.empty}>등록된 항목이 없어요.</p>}

      <Modal open={adding} onClose={closeEditor} title={editingBill !== null ? '고정 지출 수정' : '고정 지출 추가'}>
        <form className={cx(common.form, styles.addForm)} onSubmit={submit}>
          <h3>{editingBill !== null ? '고정 지출 수정' : '고정 지출 추가'}</h3>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예) 인터넷, 관리비" required autoFocus />
          </label>
          <label>
            금액 (원)
            <AmountInput value={amount} onValueChange={setAmount} max={9999999} required />
          </label>
          <div className={styles.tagPick} role="group" aria-label="태그">
            {BILL_TAGS.filter((t) => !(t === '관리비' && isMonthly && survey?.mgmtIncluded)).map((t) => (
              <button key={t} type="button" className={cx(styles.tagOpt, tag === t && styles.tagOptOn)} aria-pressed={tag === t} onClick={() => setTag(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className={common.actions}>
            <Button type="submit">{editingBill !== null ? '저장' : '추가'}</Button>
            <Button variant="line" onClick={closeEditor}>
              취소
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={editingHousing} onClose={() => setEditingHousing(false)} title="생활 정보 수정">
        {editingHousing && <LifeInfoForm showHomeAddress={false} onSaved={() => setEditingHousing(false)} />}
      </Modal>
        <button type="button" className={styles.addToggle} onClick={() => setAdding(true)}>
          ＋ 항목 추가
        </button>

      <p className={common.note}>납부 체크는 월별로 저장돼요. 다음 달은 미납으로 시작하며 이전 달 기록은 유지돼요. 금액과 항목은 현재 설정 기준이에요.</p>
    </Card>
  )
}

/** 관리비·공과금·통신비 등은 동일한 월별 체크 동작을 사용한다. */
function BillPayment({ bill, month, onToggle, onRemove, onEdit }: {
  bill: Bill; month: string; onToggle: (id: number, paid: boolean, month?: string) => void; onRemove: (id: number) => void; onEdit: (bill: Bill) => void
}) {
  const paid = billPaidInMonth(bill, month)
  return <div className={cx(styles.bill, paid && styles.billPaid)}>
    <input type="checkbox" className={common.checkbox} checked={paid} onChange={(e) => onToggle(bill.id, e.target.checked, month)} aria-label={bill.name + ' 납부'} />
    <div className={styles.billName}>
      <b>{bill.name} <i className={styles.tagBadge}>{bill.tag}</i></b>
      <small>{won(bill.amount)} · {paid ? '납부 완료' : '미납'}</small>
    </div>
    <Button variant="line" onClick={() => onEdit(bill)} aria-label={bill.name + ' 수정'}>수정</Button>
    <button type="button" className={common.del} onClick={() => onRemove(bill.id)} aria-label={bill.name + ' 삭제'} title="삭제">×</button>
  </div>
}

/** 월세 자세히: 금액·매월 납부일만 변경한다. */
function RentDetails() {
  const settings = useLifeStore((s) => s.settings)
  const { survey } = useHousingContract()
  const [amount, setAmount] = useState(String(Math.round(settings.rent * 10000)))
  const [day, setDay] = useState(String(settings.rentDay))
  const [saved, setSaved] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const rent = Number(amount)
    const rentDay = Number(day)
    if (!amount || !Number.isSafeInteger(rent) || rent < 0 || rent > 99990000 || !Number.isInteger(rentDay) || rentDay < 1 || rentDay > 31) return
    const state = useLifeStore.getState()
    state.saveSettings({ ...state.settings, rent: rent / 10000, rentDay })
    if (survey) useHousingSurveyStore.getState().save({ ...survey, rent })
    setSaved(true)
  }
  return <form className={cx(common.form, styles.checkMore)} onSubmit={submit} aria-label="월세 금액과 납부일 수정">
    <div className={common.two}>
      <label>월세 금액 (원)<AmountInput value={amount} onValueChange={(value) => { setAmount(value); setSaved(false) }} max={99990000} required /></label>
      <label>납부일 (매월)<input type="number" inputMode="numeric" min={1} max={31} step={1} value={day} onChange={(e) => { setDay(e.target.value); setSaved(false) }} required /></label>
    </div>
    <Button type="submit">저장</Button>
    {saved && <p className={common.saved} role="status">월세 금액과 납부일을 저장했어요.</p>}
  </form>
}

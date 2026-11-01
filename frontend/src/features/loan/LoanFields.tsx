import { AmountInput } from '@/components/ui'
import { won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { monthlyInterest } from './interest'
import styles from './Loan.module.css'

export type LoanDraft = { principal: string; annualRate: string; paymentDay: string; startDate: string }

/** notes = false 면 아래 계산 안내를 숨김 (대출 이자 카드는 오른쪽 미리보기 칸에 따로 보여 줌) */
export function LoanFields({ value, onChange, lockStart = false, notes = true }: { value: LoanDraft; onChange: (value: LoanDraft) => void; lockStart?: boolean; notes?: boolean }) {
  const change = (key: keyof LoanDraft, next: string) => onChange({ ...value, [key]: next })
  return <>
    <label>대출 금액 (원)<AmountInput value={value.principal} onValueChange={(next) => change('principal', next)} max={9999990000} placeholder="예) 120,000,000" required /></label>
    <div className={common.two}>
      <label>연 이율 (%)<input type="number" inputMode="decimal" min={0} max={100} step="0.01" value={value.annualRate} onChange={(e) => change('annualRate', e.target.value)} placeholder="예) 4.00" required /></label>
      <label>이자 납부일 (매월)<input type="number" inputMode="numeric" min={1} max={31} step={1} value={value.paymentDay} onChange={(e) => change('paymentDay', e.target.value)} required /></label>
    </div>
    <label>자동 기록 시작일<input type="date" min="2000-01-01" max="2100-12-31" value={value.startDate} onChange={(e) => change('startDate', e.target.value)} readOnly={lockStart} required /></label>
    {notes && <div className={styles.notes}>
      <p className={common.note}>{value.principal && value.annualRate !== '' ? `월 예상 이자 ${won(monthlyInterest(Number(value.principal), Number(value.annualRate)))}` : '대출 금액과 연 이율을 입력하면 월 예상 이자를 계산해요.'}</p>
    <p className={common.note}>원금 × 연 이율 ÷ 12로 계산하고 원 단위로 반올림해요. 원금 상환·일할 계산은 포함하지 않아 은행 청구액과 다를 수 있어요. 납부일이 없는 달은 말일에 기록해요.</p>
    </div>}
  </>
}

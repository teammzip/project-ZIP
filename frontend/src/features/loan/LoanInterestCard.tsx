import { useState, type FormEvent } from 'react'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { cx } from '@/lib/cx'
import { won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { loanMonthSummary, loanToday, monthlyInterest, type HousingLoan } from './interest'
import { LoanFields, type LoanDraft } from './LoanFields'
import { useLoanStore } from './store'
import { useLoanInterest } from './useLoanInterest'
import styles from './Loan.module.css'

const NOT_BANK = '설정한 납부일에 가계부에만 기록되며 실제 은행 계좌에서는 출금되지 않아요. 앱을 꺼 둔 동안 지난 납부일은 다음 실행 시 반영해요.'

export function LoanInterestCard() {
  const { plan, charges } = useLoanInterest()
  const userId = useAuthStore((s) => s.user?.id)
  const stopPlan = useLoanStore((s) => s.stopPlan)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const month = loanToday().slice(0, 7)
  const summary = loanMonthSummary(plan, charges, month)
  const history = [...charges].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
  return <Card title="전세 대출 이자" actions={<Button variant="line" onClick={() => { setEditing(!editing); setMessage('') }}>{editing ? '설정 닫기' : plan ? '대출 정보 수정' : '대출 이자 설정'}</Button>}>
    <div className={styles.card}>
      {plan ? <>
        <div className={common.sumRow}>
          <div><small>대출 금액</small><b>{won(plan.principal)}</b></div>
          <div><small>연 이율</small><b>{plan.annualRate}%</b></div>
          <div><small>월 예상 이자</small><b>{won(monthlyInterest(plan.principal, plan.annualRate))}</b></div>
        </div>
        <p>매월 {plan.paymentDay}일 · {summary.recordedCount ? `이번 달 ${won(summary.recordedAmount)} 자동 기록` : summary.scheduledCount ? `${summary.dueDate} 자동 기록 예정` : '기록 시작일 이후 납부일부터 반영'}</p>
      </> : !editing && <div className={styles.empty}><span aria-hidden="true">🏦</span><div><b>전세 대출이 있다면 이자를 자동으로 기록해 드려요</b><small>대출 금액·연 이율·납부일을 설정하면 매달 이자 지출을 가계부에 남겨요.</small></div></div>}
      {editing && <LoanPlanForm key={`${userId}:${plan?.id ?? 'new'}`} plan={plan} onSaved={() => { setEditing(false); setMessage('대출 이자 설정을 저장했어요.') }} />}
      {plan && !editing && <div className={common.actions}><Button variant="line" onClick={() => { stopPlan(); setMessage('자동 기록을 중지했어요. 기존 기록은 유지돼요.') }}>자동 기록 중지</Button></div>}
      {message && <p className={common.saved} role="status">{message}</p>}
      {!editing && <p className={common.note}>{NOT_BANK}</p>}
      {history.length > 0 && <details>
        <summary>최근 이자 지출 내역 ({history.length}건)</summary>
        <ul className={common.stack}>
          {history.map((record) => <li key={record.id}>
            <time dateTime={record.date}>{record.date}</time> · <b>{won(record.amount)}</b><small> · 대출 {won(record.principal)} · 연 {record.annualRate}%</small>
          </li>)}
        </ul>
      </details>}
    </div>
  </Card>
}

function LoanPlanForm({ plan, onSaved }: { plan?: HousingLoan; onSaved: () => void }) {
  const survey = useHousingSurveyStore((s) => s.survey)
  const userId = useAuthStore((s) => s.user?.id)
  const mine = survey?.userId === userId && survey?.hasLoan ? survey : null
  const [draft, setDraft] = useState<LoanDraft>({
    principal: String(plan?.principal ?? mine?.loanAmount ?? ''),
    annualRate: String(plan?.annualRate ?? mine?.loanAnnualRate ?? ''),
    paymentDay: String(plan?.paymentDay ?? mine?.loanPaymentDay ?? 25),
    startDate: plan?.startDate ?? loanToday(),
  })
  const savePlan = useLoanStore((s) => s.savePlan)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      savePlan({ principal: Number(draft.principal), annualRate: Number(draft.annualRate), paymentDay: Number(draft.paymentDay), startDate: draft.startDate })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '대출 정보를 저장하지 못했어요.')
    }
  }
  const ready = draft.principal !== '' && draft.annualRate !== ''
  // PC: 왼쪽 입력 · 저장 / 오른쪽 월 예상 이자 미리보기 + 안내. 모바일: 입력 → 미리보기 → 저장
  return <form className={cx(common.form, styles.form)} onSubmit={submit}>
    <div className={styles.fields}>
      <LoanFields value={draft} onChange={setDraft} lockStart={!!plan} notes={false} />
    </div>
    <aside className={styles.preview} aria-live="polite">
      <small>월 예상 이자</small>
      <b>{ready ? won(monthlyInterest(Number(draft.principal), Number(draft.annualRate))) : '-'}</b>
      <span>{ready ? `매월 ${draft.paymentDay || '-'}일 가계부에 자동 기록` : '대출 금액과 연 이율을 입력하면 계산해요'}</span>
      <ul>
        <li>원금 × 연 이율 ÷ 12, 원 단위 반올림. 원금 상환·일할 계산은 빼서 은행 청구액과 다를 수 있어요.</li>
        <li>납부일이 없는 달은 말일에 기록해요.</li>
        <li>시작일 이후 지난 납부일도 기록하고, 수정한 금액·이율은 아직 기록하지 않은 납부일부터 적용해요.</li>
        <li>{NOT_BANK}</li>
      </ul>
    </aside>
    <div className={styles.save}>
      {error && <p className={common.formError} role="alert">{error}</p>}
      <Button type="submit" block>대출 이자 설정 저장</Button>
    </div>
  </form>
}

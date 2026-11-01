import { useState, type FormEvent } from 'react'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { loanMonthSummary, loanToday, monthlyInterest, type HousingLoan } from './interest'
import { LoanFields, type LoanDraft } from './LoanFields'
import { useLoanStore } from './store'
import { useLoanInterest } from './useLoanInterest'

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
    <div className={common.stack}>
      {plan ? <>
        <div className={common.sumRow}>
          <div><small>대출 금액</small><b>{won(plan.principal)}</b></div>
          <div><small>연 이율</small><b>{plan.annualRate}%</b></div>
          <div><small>월 예상 이자</small><b>{won(monthlyInterest(plan.principal, plan.annualRate))}</b></div>
        </div>
        <p>매월 {plan.paymentDay}일 · {summary.recordedCount ? `이번 달 ${won(summary.recordedAmount)} 자동 기록` : summary.scheduledCount ? `${summary.dueDate} 자동 기록 예정` : '기록 시작일 이후 납부일부터 반영'}</p>
      </> : <p className={common.note}>대출 금액·연 이율·납부일을 설정하면 매달 이자 지출을 자동으로 기록해요.</p>}
      {editing && <LoanPlanForm key={`${userId}:${plan?.id ?? 'new'}`} plan={plan} onSaved={() => { setEditing(false); setMessage('대출 이자 설정을 저장했어요.') }} />}
      {plan && !editing && <div className={common.actions}><Button variant="line" onClick={() => { stopPlan(); setMessage('자동 기록을 중지했어요. 기존 기록은 유지돼요.') }}>자동 기록 중지</Button></div>}
      {message && <p className={common.saved} role="status">{message}</p>}
      <p className={common.note}>설정한 납부일에 가계부에만 기록되며 실제 은행 계좌에서는 출금되지 않아요. 앱을 꺼 둔 동안 지난 납부일은 다음 실행 시 반영해요.</p>
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
  return <form className={common.form} onSubmit={submit}>
    <LoanFields value={draft} onChange={setDraft} lockStart={!!plan} />
    <p className={common.note}>시작일 이후 지난 납부일도 기록해요. 이미 기록한 이자는 유지하고 수정한 금액·이율은 아직 기록하지 않은 납부일부터 적용해요.</p>
    {error && <p className={common.formError} role="alert">{error}</p>}
    <Button type="submit">대출 이자 설정 저장</Button>
  </form>
}

import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { loadHomeInfo, saveHomeLoan } from '@/features/life/homeApi'
import { getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { cx } from '@/lib/cx'
import { won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { loanMonthSummary, loanToday, monthlyInterest, validateLoanTerms, type HousingLoan, type LoanTerms } from './interest'
import { LoanFields, type LoanDraft } from './LoanFields'
import { useLoanStore } from './store'
import { useLoanInterest } from './useLoanInterest'
import styles from './Loan.module.css'

const NOT_BANK = '설정한 납부일에 가계부에만 기록되며 실제 은행 계좌에서는 출금되지 않아요. 앱을 꺼 둔 동안 지난 납부일은 다음 실행 시 반영해요.'

export function LoanInterestCard() {
  const { plan, charges } = useLoanInterest()
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const client = useQueryClient()
  const home = useQuery({
    queryKey: ['home-loan', userId, token],
    queryFn: loadHomeInfo,
    enabled: !isMockApi && !!userId && !!token,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const savePlan = useLoanStore((s) => s.savePlan)
  const stopPlan = useLoanStore((s) => s.stopPlan)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [stopping, setStopping] = useState(false)
  const save = async (terms: LoanTerms | null) => {
    if (isMockApi) {
      if (terms) savePlan(terms)
      else stopPlan()
      return
    }
    await saveHomeLoan(terms)
    void client.invalidateQueries({ queryKey: ['monthly-bills'] })
    void client.invalidateQueries({ queryKey: ['ledger'] })
  }
  const stop = async () => {
    setStopping(true)
    setError('')
    setMessage('')
    try {
      await save(null)
      setMessage('자동 기록을 중지했어요. 기존 기록은 유지돼요.')
    } catch (cause) {
      setError(getErrorMessage(cause, '자동 기록을 중지하지 못했어요.'))
    } finally {
      setStopping(false)
    }
  }
  const today = loanToday()
  const recorded = charges.filter((charge) => charge.date <= today)
  const summary = loanMonthSummary(plan, recorded, today.slice(0, 7))
  const history = recorded.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
  if (!isMockApi && !home.data) return <Card title="전세 대출 이자">
    {home.isError ? <>
      <p className={common.formError} role="alert">{getErrorMessage(home.error, '대출 정보를 불러오지 못했어요.')}</p>
      <Button variant="line" onClick={() => void home.refetch()}>다시 조회</Button>
    </> : <p role="status">대출 정보를 불러오는 중이에요.</p>}
  </Card>
  return <Card title="전세 대출 이자" actions={<Button variant="line" disabled={stopping} onClick={() => { setEditing(!editing); setMessage(''); setError('') }}>{editing ? '설정 닫기' : plan ? '대출 정보 수정' : '대출 이자 설정'}</Button>}>
    <div className={styles.card}>
      {plan ? <>
        <div className={common.sumRow}>
          <div><small>대출 금액</small><b>{won(plan.principal)}</b></div>
          <div><small>연 이율</small><b>{plan.annualRate}%</b></div>
          <div><small>월 예상 이자</small><b>{won(monthlyInterest(plan.principal, plan.annualRate))}</b></div>
        </div>
        <p>매월 {plan.paymentDay}일 · {summary.recordedCount ? `이번 달 ${won(summary.recordedAmount)} 자동 기록` : summary.scheduledCount ? `${summary.dueDate} 자동 기록 예정` : '기록 시작일 이후 납부일부터 반영'}</p>
      </> : !editing && <div className={styles.empty}><span aria-hidden="true">🏦</span><div><b>전세 대출이 있다면 이자를 자동으로 기록해 드려요</b><small>대출 금액·연 이율·납부일을 설정하면 매달 이자 지출을 가계부에 남겨요.</small></div></div>}
      {editing && <LoanPlanForm key={userId} plan={plan} onSave={async (terms) => { await save(terms); setEditing(false); setMessage('대출 이자 설정을 저장했어요.') }} />}
      {plan && !editing && <div className={common.actions}><Button variant="line" loading={stopping} onClick={() => void stop()}>자동 기록 중지</Button></div>}
      {error && <p className={common.formError} role="alert">{error}</p>}
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

function LoanPlanForm({ plan, onSave }: { plan?: HousingLoan; onSave: (terms: LoanTerms) => Promise<void> }) {
  const survey = useHousingSurveyStore((s) => s.survey)
  const userId = useAuthStore((s) => s.user?.id)
  const mine = survey?.userId === userId && survey?.hasLoan ? survey : null
  const [draft, setDraft] = useState<LoanDraft>({
    principal: String(plan?.principal ?? mine?.loanAmount ?? ''),
    annualRate: String(plan?.annualRate ?? mine?.loanAnnualRate ?? ''),
    paymentDay: String(plan?.paymentDay ?? mine?.loanPaymentDay ?? 25),
    startDate: plan?.startDate ?? loanToday(),
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(validateLoanTerms({ principal: Number(draft.principal), annualRate: Number(draft.annualRate), paymentDay: Number(draft.paymentDay), startDate: draft.startDate }))
    } catch (cause) {
      setError(getErrorMessage(cause, '대출 정보를 저장하지 못했어요.'))
    } finally {
      setSaving(false)
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
      <Button type="submit" block loading={saving}>대출 이자 설정 저장</Button>
    </div>
  </form>
}

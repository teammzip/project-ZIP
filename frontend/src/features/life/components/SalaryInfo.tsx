import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AmountInput, Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { isMockApi } from '@/lib/apiMode'
import { getErrorMessage } from '@/lib/apiClient'
import { won } from '@/lib/date'
import { getSalary, saveSalary, type SalarySettings } from '../salaryApi'
import { useBillingTimeZone } from '../useBillingTimeZone'
import common from '@/styles/common.module.css'
import styles from './SalaryInfo.module.css'

export function SalaryInfo({ startEditing = false }: { startEditing?: boolean }) {
  const owner = useAuthStore((s) => s.user?.id), sessionKey = useAuthStore((s) => s.sessionKey)
  const storedSurvey = useHousingSurveyStore((s) => s.survey)
  const survey = owner && storedSurvey?.userId === owner ? storedSurvey : null
  const { choice, resolving } = useBillingTimeZone()
  const query = useQuery({ queryKey: ['salary-settings', owner, sessionKey], queryFn: ({ signal }) => getSalary(signal), enabled: !isMockApi && !!owner && !!sessionKey, staleTime: 0, retry: false })
  return <section aria-label="수입 정보"><h4>수입 정보</h4>
    {isMockApi ? <><p>{survey ? `${survey.incomePeriod === 'annual' ? '연 수입' : '월 수입'} ${won(survey.income)}` : '등록된 수입 정보가 없어요.'}</p><p className={common.note}>수입 정보 수정과 월급 자동 등록은 서버 연결 모드에서 사용할 수 있어요.</p></> : query.isError ? <div role="alert"><p>{getErrorMessage(query.error, '수입 정보를 불러오지 못했어요.')}</p><Button onClick={() => void query.refetch()}>다시 조회</Button></div> : query.data ? <SalaryForm key={`${owner}:${sessionKey}`} settings={query.data} timeZone={choice?.timeZone} resolving={resolving} startEditing={startEditing} /> : <p role="status">불러오는 중이에요.</p>}
  </section>
}

function SalaryForm({ settings, timeZone, resolving, startEditing }: { settings: SalarySettings; timeZone?: string; resolving: boolean; startEditing: boolean }) {
  const draft = settings.draft
  const [editing, setEditing] = useState(startEditing)
  const [amount, setAmount] = useState(String(draft?.amount ?? settings.amount))
  const [period, setPeriod] = useState(draft?.incomePeriod ?? settings.incomePeriod)
  const [day, setDay] = useState(draft ? '' : String(settings.paymentDay))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const pending = useRef(false), client = useQueryClient()
  return <div className={common.stack}>
    {!editing ? <><dl className={styles.details}>
      <div><dt>수입 기준</dt><dd>{(draft?.incomePeriod ?? settings.incomePeriod) === 'annual' ? '연 수입' : '월 수입'}</dd></div>
      <div><dt>수입 금액 (원)</dt><dd>{draft ? won(draft.amount) : settings.startMonth ? won(settings.amount) : '미등록'}</dd></div>
      <div className={styles.row}>
        <div><dt>받는 날짜 (매월)</dt><dd>{settings.startMonth ? `${settings.paymentDay}일` : '미등록'}</dd></div>
        {settings.incomePeriod === 'annual' && <div><dt>월 환산 금액 (원)</dt><dd>{settings.startMonth ? won(settings.monthlyAmount) : '미등록'}</dd></div>}
      </div>
    </dl>{draft && <p className={common.note}>설문에서 입력한 금액이에요. 수령일을 설정하면 월급이 자동 등록돼요.</p>}
    <div className={common.actions}><Button variant="line" onClick={() => { setAmount(String(draft?.amount ?? settings.amount)); setPeriod(draft?.incomePeriod ?? settings.incomePeriod); setDay(draft ? '' : String(settings.paymentDay)); setError(''); setNotice(''); setEditing(true) }}>수정</Button></div></> : <form className={common.form} onSubmit={async (event) => {
      event.preventDefault()
      if (pending.current || !timeZone || resolving) return
      pending.current = true; setBusy(true); setError(''); setNotice('')
      try {
        await saveSalary({ amount: Number(amount), incomePeriod: period, paymentDay: Number(day) }, timeZone)
        await Promise.all([client.invalidateQueries({ queryKey: ['salary-settings'] }), client.invalidateQueries({ queryKey: ['ledger'] })])
        setEditing(false); setNotice('월급 정보를 저장했어요.')
      } catch (cause) { setError(getErrorMessage(cause, '월급 정보를 저장하지 못했어요.')) }
      finally { pending.current = false; setBusy(false) }
    }}>
      <label>수입 기준<select value={period} disabled={busy} onChange={(e) => setPeriod(e.target.value as 'monthly' | 'annual')}><option value="monthly">월 수입</option><option value="annual">연 수입</option></select></label>
      <label>{period === 'annual' ? '연 수입' : '월 수입'} (원)<AmountInput value={amount} onValueChange={setAmount} max={period === 'annual' ? 11999999988 : 999999999} disabled={busy} /></label>
      <div className={common.two}>
        <label>받는 날짜 (매월)<input type="number" min="1" max="31" step="1" required value={day} disabled={busy} onChange={(e) => setDay(e.target.value)} /></label>
        {period === 'annual' && <label>월 환산 금액 (원)<input value={won(Math.floor(Number(amount || 0) / 12))} readOnly /></label>}
      </div>
      <div className={common.actions}><Button type="submit" disabled={busy || resolving || !timeZone || !amount}>{busy ? '저장 중' : '저장'}</Button><Button variant="line" disabled={busy} onClick={() => setEditing(false)}>취소</Button></div>
    </form>}
    <p className={common.note}>설정한 달부터 수령일이 지난 월급을 고정 수입에 자동 등록해요. 31일이 없는 달은 말일로 처리해요. 연 수입은 12로 나누고 남는 원 단위 금액은 12월에 더해요. 이미 등록된 월급은 유지하며, 변경한 설정은 아직 등록되지 않은 월급부터 적용해요. 0원으로 저장하면 자동 등록을 중단해요.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div>
}

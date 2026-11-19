import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AmountInput, Button } from '@/components/ui'
import { LoanFields, loanToday, useLoanInterest, useLoanStore, validateLoanTerms, type LoanDraft, type LoanTerms } from '@/features/loan'
import { useAuthStore } from '@/features/auth'
import type { ContractKind, HousingSurvey } from '@/features/onboarding/store'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { monthKeyOf, todayStr, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { spendBreakdown, sumAmount } from '../derive'
import { useNotis } from '../notifications'
import { useLifeStore } from '../store'
import styles from './myinfo.module.css'
import { billPaidInMonth } from '../payments'
import { validateLifeInfo } from '../validateLifeInfo'
import { isMockApi } from '@/features/auth/api'
import { getErrorMessage } from '@/lib/apiClient'
import { loadHomeInfo, saveHomeInfo } from '../homeApi'

/* 내 정보 화면에 쓰는 생활 조각들: 수입·지출 카드, 이번 달 요약, 생활 정보 폼, 알림 스위치 */

/** 이번 달 수입·지출 카드. 홈과 같은 기준으로 합산하고 가계부로 연결. */
export function BudgetSummaryCard() {
  const { kind, isJeonse } = useHousingContract()
  const { charges } = useLoanInterest()
  const { incomes, spends, bills, settings } = useLifeStore(useShallow((s) => ({ incomes: s.incomes, spends: s.spends, bills: s.bills, settings: s.settings })))
  const month = todayStr().slice(0, 7)
  const income = sumAmount(incomes.filter((r) => r.date.slice(0, 7) === month))
  const expense = spendBreakdown(0, spends, bills, settings, charges, kind).total
  return (
    <Link to="/my/budget" className={styles.budget}>
      <strong>이번 달 수입·지출</strong>
      <dl className={styles.budgetTotals}>
        <div><dt>총수입</dt><dd>{won(income)}</dd></div>
        <div><dt>총지출</dt><dd>{won(expense)}</dd></div>
      </dl>
      <small>{isJeonse ? '공과금·대출 이자·기타 지출 포함' : '월세·공과금·기타 지출 포함'}</small>
      <span className={styles.budgetLink}>가계부 보기 →</span>
    </Link>
  )
}

/** 이번 달 요약 카드 4개. 커뮤니티 글 수는 다른 기능이라 쓰는 쪽이 넘겨 줌 */
export function LifeStats({ postCount }: { postCount: number }) {
  const { events, bills } = useLifeStore(useShallow((s) => ({ events: s.events, bills: s.bills })))
  const { unread } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const month = monthKeyOf(useToday())
  const paid = bills.length ? Math.round((bills.filter((b) => billPaidInMonth(b, month)).length / bills.length) * 100) : 0
  const items = [
    { to: '/my/calendar', label: '이번 달 일정', value: `${events.filter((e) => e.date.startsWith(month)).length}개` },
    { to: '/my/budget/expense', label: '공과금 납부', value: `${paid}%` },
    { to: '/my/noti', label: '안 읽은 알림', value: `${notiOn ? unread : 0}개` },
    { to: '/community', label: '내가 쓴 글', value: `${postCount}개` },
  ]
  return (
    <section className={styles.stats} aria-label="이번 달 요약">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className={styles.stat}>
          <small>{it.label}</small>
          <b>{it.value}</b>
        </Link>
      ))}
    </section>
  )
}

/** 생활 정보: 선택한 계약 유형의 항목만 편집하고 설문·가계부 설정에 함께 반영한다. */
type LifeInfoProps = { onSaved?: () => void; showHomeAddress?: boolean }
export function LifeInfoForm(props: LifeInfoProps) {
  const token = useAuthStore((s) => s.token)
  const id = useAuthStore((s) => s.user?.id)
  return isMockApi ? <LifeInfoFields {...props} /> : <ServerLifeInfoForm key={`${id}:${token}`} {...props} />
}
function ServerLifeInfoForm(props: LifeInfoProps) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void loadHomeInfo().then(() => { if (active) setReady(true) }).catch((cause) => { if (active) setError(getErrorMessage(cause, '내 집 정보를 불러오지 못했어요.')) })
    return () => { active = false }
  }, [attempt])
  if (error) return <div role="alert"><p>{error}</p><Button onClick={() => { setError(''); setAttempt((n) => n + 1) }}>다시 불러오기</Button></div>
  if (!ready) return <p role="status">내 집 정보를 불러오는 중이에요.</p>
  return <LifeInfoFields {...props} />
}
export function LifeInfoFields({ onSaved, showHomeAddress = true }: LifeInfoProps) {
  const queryClient = useQueryClient()
  const { kind: savedKind, survey } = useHousingContract()
  const user = useAuthStore((s) => s.user)
  const saveSurvey = useHousingSurveyStore((s) => s.save)
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const { plan } = useLoanInterest()
  const saveLoan = useLoanStore((s) => s.savePlan)
  const stopLoan = useLoanStore((s) => s.stopPlan)
  const [kind, setKind] = useState<ContractKind>(savedKind)
  const monthly = kind === 'monthly'
  const [mgmtIncluded, setMgmtIncluded] = useState(survey?.mgmtIncluded ?? false)
  const [hasLoan, setHasLoan] = useState(!!plan || !!survey?.hasLoan)
  const [error, setError] = useState('')
  const [loan, setLoan] = useState<LoanDraft>({
    principal: String(plan?.principal ?? survey?.loanAmount ?? ''),
    annualRate: String(plan?.annualRate ?? survey?.loanAnnualRate ?? ''),
    paymentDay: String(plan?.paymentDay ?? survey?.loanPaymentDay ?? 25),
    startDate: plan?.startDate ?? survey?.loanStartDate ?? loanToday(),
  })
  const [form, setForm] = useState({
    homeAddress: user ? settings.homeAddresses?.[user.id] ?? '' : '',
    rentDay: String(settings.rentDay),
    rent: String(Math.round(settings.rent * 10000)),
    deposit: String(survey?.deposit ?? 0),
    mgmtFee: String(survey?.mgmtFee ?? useLifeStore.getState().bills.find((b) => b.name === '관리비' && b.tag === '관리비')?.amount ?? 0),
    moveIn: settings.moveIn,
    contractEnd: settings.contractEnd,
    contractFee: String(survey?.contractFee ?? 0),
  })
  const change = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }))
  const [pending, setPending] = useState(false)
  const saving = useRef(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || saving.current) return
    setError('')
    try {
      const months = validateLifeInfo(form, monthly, mgmtIncluded, showHomeAddress)
      const terms: LoanTerms | undefined = !monthly && hasLoan ? validateLoanTerms({
        principal: Number(loan.principal), annualRate: Number(loan.annualRate),
        paymentDay: Number(loan.paymentDay), startDate: loan.startDate,
      }) : undefined
      const mgmtFee = monthly && mgmtIncluded ? 0 : Number(form.mgmtFee)
      if (!isMockApi) {
        saving.current = true; setPending(true)
        await saveHomeInfo({ kind, deposit: monthly ? Number(form.deposit) : 0, rent: monthly ? Number(form.rent) : 0,
          rentDay: monthly ? Number(form.rentDay) : settings.rentDay, mgmtIncluded: monthly && mgmtIncluded, mgmtFee,
          contractFee: monthly ? 0 : Number(form.contractFee), ...months,
          ...(showHomeAddress ? { homeAddress: form.homeAddress.trim() } : {}), loan: terms ?? null })
        await queryClient.invalidateQueries({ queryKey: ['monthly-bills'] })
        await queryClient.invalidateQueries({ queryKey: ['billing-address'] })
        onSaved?.()
        return
      }
      const answers: HousingSurvey = {
        birth: '', income: 0, incomePeriod: 'monthly', answeredAt: new Date().toISOString(),
        ...survey,
        userId: user.id, address: survey?.address ?? useLifeStore.getState().settings.region, kind,
        deposit: monthly ? Number(form.deposit) : 0,
        rent: monthly ? Number(form.rent) : 0,
        mgmtIncluded: monthly && mgmtIncluded, mgmtFee,
        contractFee: monthly ? 0 : Number(form.contractFee),
        hasLoan: !!terms, loanAmount: terms?.principal ?? 0,
        loanAnnualRate: terms?.annualRate, loanPaymentDay: terms?.paymentDay, loanStartDate: terms?.startDate,
      }
      if (terms) saveLoan(terms)
      else stopLoan()
      saveSurvey(answers)
      const currentSettings = useLifeStore.getState().settings
      saveSettings({
        ...currentSettings,
        homeAddresses: showHomeAddress ? { ...currentSettings.homeAddresses, [user.id]: form.homeAddress.trim() } : currentSettings.homeAddresses,
        rentDay: monthly ? Number(form.rentDay) : currentSettings.rentDay,
        rent: answers.rent / 10000,
        ...months,
      })
      // 설문에서 만든 관리비 한 항목을 갱신해 중복 등록을 막는다.
      useLifeStore.setState((state) => {
        const bills = state.bills.filter((bill) => !(bill.name === '관리비' && bill.tag === '관리비'))
        const existing = state.bills.find((bill) => bill.name === '관리비' && bill.tag === '관리비')
        if (mgmtFee > 0) bills.push(existing ? { ...existing, amount: mgmtFee } : { id: Date.now(), name: '관리비', amount: mgmtFee, tag: '관리비', paidMonth: null })
        return { bills }
      })
      onSaved?.()
    } catch (cause) {
      setError(getErrorMessage(cause, '계약 정보를 확인해 주세요.'))
    } finally {
      saving.current = false; setPending(false)
    }
  }

  return (
    <form className={common.form} onSubmit={submit}>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'contents' }}>
      <label>계약 유형
        <select value={kind} onChange={(e) => { setKind(e.target.value as ContractKind); setError('') }}>
          <option value="monthly">월세</option>
          <option value="jeonse">전세</option>
        </select>
      </label>
      <p className={common.note}>선택한 계약 유형에 맞는 항목만 표시돼요. 금액은 원 단위예요. 매월 납부일은 오늘 이전 날짜여도 저장할 수 있어요. 새 내역은 저장한 날 이후의 납부 건부터 생성해요. 오늘 이후 미납·예정 건에는 저장한 금액을 반영하고, 변경할 납부일이 이미 지났다면 해당 건의 기존 기한을 유지해요. 과거·납부 완료 기록은 유지하며 관리비는 계약 유형별로 구분해요.</p>
      {showHomeAddress && <label>내 집 주소<input value={form.homeAddress} onChange={(e) => change('homeAddress', e.target.value)} maxLength={200} autoComplete="street-address" placeholder="도로명 주소와 상세주소를 입력해 주세요" /></label>}
      {monthly ? <>
        <label>보증금 (원)<AmountInput value={form.deposit} onValueChange={(value) => change('deposit', value)} max={9999990000} required /></label>
        <div className={common.two}>
          <label>월세 납부일 (매월)<input type="number" value={form.rentDay} onChange={(e) => change('rentDay', e.target.value)} min={1} max={31} required /></label>
          <label>월세 (원)<AmountInput value={form.rent} onValueChange={(value) => change('rent', value)} max={99990000} required /></label>
        </div>
        <label>월세에 관리비가 포함돼 있나요?
          <select value={mgmtIncluded ? 'included' : 'separate'} onChange={(e) => setMgmtIncluded(e.target.value === 'included')}>
            <option value="included">포함이에요</option><option value="separate">따로 내요</option>
          </select>
        </label>
      </> : <>
        <label>전세 계약금 (원)<AmountInput value={form.contractFee} onValueChange={(value) => change('contractFee', value)} max={9999990000} required /></label>
        <label>전세 대출을 받았나요?
          <select value={hasLoan ? 'yes' : 'no'} onChange={(e) => setHasLoan(e.target.value === 'yes')}>
            <option value="no">없어요</option><option value="yes">있어요</option>
          </select>
        </label>
        {hasLoan && <LoanFields value={loan} onChange={setLoan} lockStart={!!plan} />}
      </>}
      {(!monthly || !mgmtIncluded) && <label>관리비 (원, 매달)<AmountInput value={form.mgmtFee} onValueChange={(value) => change('mgmtFee', value)} max={9990000} required /></label>}
      <div className={common.two}>
        <label>입주한 달<input type="month" value={form.moveIn} onChange={(e) => change('moveIn', e.target.value)} /></label>
        <label>계약 끝나는 달<input type="month" value={form.contractEnd} onChange={(e) => change('contractEnd', e.target.value)} /></label>
      </div>
      {error && <p className={common.formError} role="alert">{error}</p>}
      <Button type="submit" block loading={pending}>저장</Button>
      </fieldset>
    </form>
  )
}

/** 알림 받기 스위치: 누르면 바로 저장 */
export function NotiSwitch({ onChange }: { onChange?: (on: boolean) => void }) {
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  return (
    <input
      type="checkbox"
      className={styles.switch}
      checked={settings.notiOn}
      aria-label="알림 받기"
      onChange={(e) => {
        saveSettings({ ...settings, notiOn: e.target.checked })
        onChange?.(e.target.checked)
      }}
    />
  )
}

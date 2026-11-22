import { useCallback, useState, type FormEvent } from 'react'
import house from '@/assets/images/house-mobile.png'
import logo from '@/assets/images/logo-zip.png'
import { AmountInput, Button } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { authApi, useAuthStore } from '@/features/auth'
import { useLifeStore } from '@/features/life'
import { LoanFields, useLoanStore, validateLoanTerms, type LoanTerms } from '@/features/loan'
import { cx } from '@/lib/cx'
import { useAge } from '@/lib/useAge'
import common from '@/styles/common.module.css'
import { useHousingSurveyStore, type ContractKind, type HousingSurvey, type IncomePeriod } from './store'
import styles from './SurveyPage.module.css'
import { AddressSearch } from './AddressSearch'
import type { AddressOption } from './addressResult'
import { resolveBillingTimeZone } from '@/features/life/billingTimeZone'
import { addressTimeZone, locationTimeZone } from '@/features/life/billingTimeZoneApi'
import { deviceTimeZone } from '@/features/life/monthlyPeriod'
import { isMockApi } from '@/lib/apiMode'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { loadHomeInfo } from '@/features/life/homeApi'

const num = (v: string) => Math.max(0, Number(v) || 0)

/** 처음 로그인했을 때 한 번 나오는 "우리 집 설문" 페이지 (/onboarding).
 * 끝내면 월세 · 관리비는 생활 설정 · 고정 지출에도 반영됨. "나중에 할게요"로 건너뛸 수도 있음 */
export function SurveyPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const updateUser = useAuthStore((s) => s.updateUser)
  const saveSurvey = useHousingSurveyStore((s) => s.save)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const addBill = useLifeStore((s) => s.addBill)
  const saveLoan = useLoanStore((s) => s.savePlan)
  const stopLoan = useLoanStore((s) => s.stopPlan)

  const [done, setDone] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<AddressOption['point'] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectAddress = useCallback((address: string, point: AddressOption['point']) => {
    setSelectedAddress(address)
    setSelectedPoint(point)
    setSearchOpen(false)
    setError('')
  }, [])
  const [kind, setKind] = useState<ContractKind | null>(null)
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>('monthly')
  const [mgmtIncluded, setMgmtIncluded] = useState<boolean | null>(null)
  const [hasLoan, setHasLoan] = useState<boolean | null>(null)
  const [f, setF] = useState({ birth: '', deposit: '', rent: '', mgmtFee: '', contractFee: '', loanAmount: '', income: '', incomePaymentDay: '', loanAnnualRate: '', loanPaymentDay: '', loanStartDate: '' })
  const { age, today } = useAge(f.birth)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  if (!user) return null
  const close = () => updateUser({ ...user, firstLogin: false })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!Number.isSafeInteger(Number(f.income)) || Number(f.income) < 0 || Number(f.income) > (incomePeriod === 'annual' ? 11999999988 : 999999999) || (incomePeriod === 'annual' && Number(f.income) > 0 && Number(f.income) < 12) || !Number.isInteger(Number(f.incomePaymentDay || 25)) || Number(f.incomePaymentDay || 25) < 1 || Number(f.incomePaymentDay || 25) > 31) {
      setError('월·연 수입 금액과 매월 받는 날짜(1~31일)를 확인해 주세요.'); return
    }
    if (f.birth && age === null) {
      setError('올바른 생년월일을 입력해 주세요.')
      return
    }
    let loan: LoanTerms | undefined
    const loanFields = {
      ...(f.loanAmount !== '' ? { principal: Number(f.loanAmount) } : {}),
      ...(f.loanAnnualRate !== '' ? { annualRate: Number(f.loanAnnualRate) } : {}),
      ...(f.loanPaymentDay !== '' ? { paymentDay: Number(f.loanPaymentDay) } : {}),
      ...(f.loanStartDate !== '' ? { startDate: f.loanStartDate } : {}),
    }
    if (kind === 'jeonse' && hasLoan && Object.keys(loanFields).length === 4) {
      try {
        loan = validateLoanTerms({ principal: Number(f.loanAmount), annualRate: Number(f.loanAnnualRate), paymentDay: Number(f.loanPaymentDay), startDate: f.loanStartDate })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '대출 정보를 확인해 주세요.')
        return
      }
    }
    setError('')
    setSaving(true)
    const monthly = kind === 'monthly'
    const mgmtFee = monthly && mgmtIncluded ? 0 : num(f.mgmtFee)
    const answers: HousingSurvey = {
      userId: user.id,
      birth: f.birth,
      address: selectedAddress,
      addressPoint: selectedPoint ?? undefined,
      kind: kind ?? 'monthly',
      deposit: monthly ? num(f.deposit) : 0,
      rent: monthly ? num(f.rent) : 0,
      mgmtIncluded: monthly && mgmtIncluded === true,
      mgmtFee,
      contractFee: monthly ? 0 : num(f.contractFee),
      hasLoan: !!loan,
      loanAmount: !monthly && hasLoan ? num(f.loanAmount) : 0,
      loanAnnualRate: loan?.annualRate,
      loanPaymentDay: loan?.paymentDay,
      loanStartDate: loan?.startDate,
      income: num(f.income),
      incomePeriod,
      incomePaymentDay: Number(f.incomePaymentDay || 25),
      answeredAt: new Date().toISOString(),
    }
    const sessionKey = useAuthStore.getState().sessionKey
    const sameSession = () => useAuthStore.getState().sessionKey === sessionKey && useAuthStore.getState().user?.id === user.id
    try {
      if (!isMockApi) {
        const zone = f.income === '' || f.incomePaymentDay === '' ? undefined : await resolveBillingTimeZone({
          address: { label: selectedAddress || user.address, point: selectedPoint ?? undefined },
          deviceZone: deviceTimeZone(), signal: new AbortController().signal, addressZone: addressTimeZone, locationZone: locationTimeZone,
        })
        if (!sameSession()) return
        const { data: savedUser } = await apiClient.put<typeof user>('/me/housing-onboarding', {
          action: 'save',
          ...(selectedAddress ? { address: selectedAddress } : {}),
          ...(f.birth ? { birth: f.birth } : {}),
          ...(f.income !== '' ? { salary: { amount: answers.income, incomePeriod, ...(zone ? { paymentDay: answers.incomePaymentDay } : {}) } } : {}),
          ...(zone ? { timeZone: zone.timeZone } : {}),
          ...(kind ? { home: {
            kind,
            ...(monthly && f.deposit !== '' ? { deposit: answers.deposit } : {}),
            ...(monthly && f.rent !== '' ? { rent: answers.rent } : {}),
            ...(monthly && mgmtIncluded !== null ? { mgmtIncluded } : {}),
            ...(f.mgmtFee !== '' && !(monthly && mgmtIncluded) ? { mgmtFee } : {}),
            ...(!monthly && f.contractFee !== '' ? { contractFee: answers.contractFee } : {}),
            ...(!monthly && hasLoan === false ? { loan: null } : {}),
            ...(!monthly && hasLoan ? { loan: loanFields } : {}),
          } } : {}),
        })
        if (!sameSession()) return
        if (selectedAddress && savedUser.address === selectedAddress) {
          const settings = useLifeStore.getState().settings
          saveSettings({ ...settings, region: selectedAddress, regionLocation: {
            userId: user.id, region: selectedAddress, source: 'survey', point: selectedPoint ?? undefined,
          } })
        }
        updateUser(savedUser)
        void loadHomeInfo().catch(() => {})
        void queryClient.invalidateQueries({ queryKey: ['monthly-bills'] })
        void queryClient.invalidateQueries({ queryKey: ['billing-address'] })
        void queryClient.invalidateQueries({ queryKey: ['ledger'] })
        return
      }
      if (selectedAddress) {
        const savedUser = await authApi.updateMe({ address: selectedAddress })
        if (!sameSession()) return
        updateUser({ ...savedUser, firstLogin: user.firstLogin })
      }
      const settings = useLifeStore.getState().settings
      saveSettings({ ...settings, ...(selectedAddress ? { region: selectedAddress,
        regionLocation: { userId: user.id, region: selectedAddress, source: 'survey', point: selectedPoint ?? undefined } } : {}),
        ...(kind && f.rent !== '' ? { rent: answers.rent / 10000 } : {}) })
      if (kind) saveSurvey(answers)
      if (kind && mgmtFee > 0) addBill('관리비', mgmtFee, '관리비')
      if (loan) saveLoan(loan)
      else if (kind && hasLoan === false) stopLoan()
      setDone(true)
    } catch (cause) {
      if (sameSession()) setError(getErrorMessage(cause, '정보를 저장하지 못했어요. 다시 시도해 주세요.'))
    } finally {
      setSaving(false)
    }
  }

  const skip = async () => {
    if (saving) return
    if (isMockApi) return close()
    const sessionKey = useAuthStore.getState().sessionKey
    setSaving(true)
    setError('')
    try {
      const { data } = await apiClient.put<typeof user>('/me/housing-onboarding', { action: 'skip' })
      if (useAuthStore.getState().sessionKey === sessionKey) updateUser(data)
    } catch (cause) {
      if (useAuthStore.getState().sessionKey === sessionKey) setError(getErrorMessage(cause, '설문을 건너뛰지 못했어요. 다시 시도해 주세요.'))
    } finally {
      setSaving(false)
    }
  }

  // 왼쪽(모바일은 위) 진행 단계: 칸을 채우면 ✓
  const steps = [
    { label: '생년월일', ok: age !== null },
    { label: '사는 곳', ok: !!selectedAddress },
    { label: '계약 정보', ok: !!kind },
    { label: '수입', ok: !!f.income },
  ]
  const doneCount = done ? steps.length : steps.filter((st) => st.ok).length

  return (
    <div className={styles.page}>
      {/* PC: 왼쪽 소개 칸 (따라 내려옴) / 모바일: 위 머리 띠 */}
      <aside className={styles.side}>
        <img className={styles.logo} src={logo} alt="ZIP" />
        <p className={styles.hello}>
          <b>{user.nickname}</b>님, 환영해요! 👋
        </p>
        <h1 className={styles.title}>
          우리 집 정보를
          <br />
          알려 주세요
        </h1>
        <p className={styles.sub}>계약 유형에 맞는 주거비와 고정 지출 계산에 써요. 입력하지 않은 항목은 나중에 마이페이지에서 설정할 수 있어요.</p>
        <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="설문 진행">
          <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <ol className={styles.steps}>
          {steps.map((st, i) => (
            <li key={st.label} className={cx((done || st.ok) && styles.stepOk)}>
              <span>{done || st.ok ? '✓' : i + 1}</span>
              {st.label}
            </li>
          ))}
        </ol>
        <img className={styles.house} src={house} alt="" aria-hidden="true" />
      </aside>
      <main className={styles.card}>
        {done ? (
          <div className={styles.doneBox}>
            <div className={styles.doneIco} aria-hidden>🎉</div>
            <h1>설문이 끝났어요!</h1>
            <p>입력한 정보를 저장했어요. 나머지 정보는 마이페이지에서 설정할 수 있어요.</p>
            <Button block size="lg" onClick={close}>
              ZIP 시작하기
            </Button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <section className={styles.sec}>
              <h2><i aria-hidden="true">🎂</i>생년월일</h2>
              <label>
                <span className={styles.srOnly}>생년월일</span>
                <input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} min="1900-01-01" max={today} autoFocus aria-describedby="survey-age" />
              </label>
              <p id="survey-age" className={styles.sub} aria-live="polite">
                {age !== null ? `만 ${age}세` : f.birth ? '올바른 생년월일을 입력해 주세요.' : ''}
              </p>
            </section>

            <section className={styles.sec}>
              <h2><i aria-hidden="true">📍</i>사는 곳</h2>
              <div className={styles.addrRow}>
                <label htmlFor="survey-address">
                  <span className={styles.srOnly}>사는 곳 (시·군·구 또는 동·읍·면)</span>
                  <input id="survey-address" value={selectedAddress} readOnly placeholder="동네를 검색해 주세요" onClick={() => setSearchOpen(true)} />
                </label>
                <Button variant="line" onClick={() => setSearchOpen((open) => !open)} disabled={saving} aria-expanded={searchOpen}>
                  {searchOpen ? '닫기' : selectedAddress ? '다시 검색' : '검색'}
                </Button>
              </div>
              {searchOpen && <AddressSearch onSelect={selectAddress} />}
            </section>

            <section className={styles.sec}>
              <h2><i aria-hidden="true">🏠</i>계약 유형</h2>
              <div className={styles.kindGrid} role="group" aria-label="계약 유형">
                {([['monthly', '월세'], ['jeonse', '전세']] as const).map(([v, label]) => (
                  <button key={v} type="button" className={cx(styles.ynBtn, kind === v && styles.kindOn)} aria-pressed={kind === v} onClick={() => setKind(v)}>
                    {label}
                  </button>
                ))}
              </div>

              {kind === 'monthly' ? (
                <div className={styles.sub3}>
                  <div className={common.two}>
                    <label>
                      보증금 (원)
                      <AmountInput value={f.deposit} onValueChange={(value) => set('deposit', value)} max={9999990000} placeholder="예) 10,000,000" />
                    </label>
                    <label>
                      월세 (원)
                      <AmountInput value={f.rent} onValueChange={(value) => set('rent', value)} max={99990000} placeholder="예) 550,000" />
                    </label>
                  </div>
                  <p className={styles.q}>월세에 관리비가 포함돼 있나요?</p>
                  <div className={styles.yn} role="group" aria-label="관리비 포함 여부">
                    <button type="button" className={cx(styles.ynBtn, mgmtIncluded && styles.kindOn)} aria-pressed={mgmtIncluded === true} onClick={() => setMgmtIncluded(true)}>
                      포함이에요
                    </button>
                    <button type="button" className={cx(styles.ynBtn, mgmtIncluded === false && styles.kindOn)} aria-pressed={mgmtIncluded === false} onClick={() => setMgmtIncluded(false)}>
                      따로 내요
                    </button>
                  </div>
                  {mgmtIncluded === false && (
                    <label>
                      관리비 (원, 매달)
                      <AmountInput value={f.mgmtFee} onValueChange={(value) => set('mgmtFee', value)} max={9990000} placeholder="예) 70,000" />
                    </label>
                  )}
                </div>
              ) : kind === 'jeonse' ? (
                <div className={styles.sub3}>
                  <label>
                    계약금 (원)
                    <AmountInput value={f.contractFee} onValueChange={(value) => set('contractFee', value)} max={9999990000} placeholder="예) 20,000,000" />
                  </label>
                  <p className={styles.q}>전세 대출을 받았나요?</p>
                  <div className={styles.yn} role="group" aria-label="대출 여부">
                    <button type="button" className={cx(styles.ynBtn, hasLoan === false && styles.kindOn)} aria-pressed={hasLoan === false} onClick={() => setHasLoan(false)}>
                      없어요
                    </button>
                    <button type="button" className={cx(styles.ynBtn, hasLoan && styles.kindOn)} aria-pressed={hasLoan === true} onClick={() => setHasLoan(true)}>
                      있어요
                    </button>
                  </div>
                  {hasLoan && (
                    <LoanFields optional
                      value={{ principal: f.loanAmount, annualRate: f.loanAnnualRate, paymentDay: f.loanPaymentDay, startDate: f.loanStartDate }}
                      onChange={(value) => setF((previous) => ({ ...previous, loanAmount: value.principal, loanAnnualRate: value.annualRate, loanPaymentDay: value.paymentDay, loanStartDate: value.startDate }))}
                    />
                  )}
                  <label>
                    관리비 (원, 매달)
                    <AmountInput value={f.mgmtFee} onValueChange={(value) => set('mgmtFee', value)} max={9990000} placeholder="없으면 0" />
                  </label>
                </div>
              ) : null}
            </section>

            <section className={styles.sec}>
              <h2><i aria-hidden="true">💰</i>수입</h2>
              <div className={styles.yn} role="group" aria-label="수입 기준">
                {([['monthly', '월 수입'], ['annual', '연 수입']] as const).map(([period, label]) => (
                  <button key={period} type="button" className={cx(styles.ynBtn, incomePeriod === period && styles.kindOn)} aria-pressed={incomePeriod === period} onClick={() => setIncomePeriod(period)}>
                    {label}
                  </button>
                ))}
              </div>
              <label>
                {incomePeriod === 'monthly' ? '월 수입 (원)' : '연 수입 (원)'}
                <AmountInput value={f.income} onValueChange={(value) => set('income', value)} max={incomePeriod === 'monthly' ? 999999999 : 11999999988} placeholder={incomePeriod === 'monthly' ? '예) 2,500,000' : '예) 30,000,000'} />
              </label>
              {f.income !== '' && <label>매월 월급 받는 날짜<input type="number" min="1" max="31" step="1" value={f.incomePaymentDay} onChange={(e) => set('incomePaymentDay', e.target.value)} />일</label>}
              <p>월·연 수입 금액을 월급으로 사용해요. 연 수입은 12로 나누고 남는 원 단위 금액은 12월에 더해요. 서버 연결 시 수령일이 된 월급을 고정 수입에 자동 등록하며, 짧은 달에는 말일로 처리해요.</p>
            </section>

            {error && <p role="alert">{error}</p>}
            <Button type="submit" size="lg" block loading={saving}>
              설문 완료
            </Button>
            <button type="button" className={styles.skip} onClick={() => void skip()} disabled={saving}>
              나중에 할게요
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

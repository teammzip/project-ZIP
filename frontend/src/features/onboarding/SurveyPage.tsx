import { useCallback, useState, type FormEvent } from 'react'
import house from '@/assets/images/house-mobile.png'
import logo from '@/assets/images/logo-zip.png'
import { AmountInput, Button } from '@/components/ui'
import { authApi, useAuthStore } from '@/features/auth'
import { useLifeStore } from '@/features/life'
import { LoanFields, loanToday, useLoanStore, validateLoanTerms, type LoanTerms } from '@/features/loan'
import { cx } from '@/lib/cx'
import { useAge } from '@/lib/useAge'
import common from '@/styles/common.module.css'
import { useHousingSurveyStore, type ContractKind, type HousingSurvey, type IncomePeriod } from './store'
import styles from './SurveyPage.module.css'
import { AddressSearch } from './AddressSearch'

const num = (v: string) => Math.max(0, Number(v) || 0)

/** 처음 로그인했을 때 한 번 나오는 "우리 집 설문" 페이지 (/onboarding).
 * 끝내면 월세 · 관리비는 생활 설정 · 고정 지출에도 반영됨. "나중에 할게요"로 건너뛸 수도 있음 */
export function SurveyPage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const saveSurvey = useHousingSurveyStore((s) => s.save)
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const addBill = useLifeStore((s) => s.addBill)
  const saveLoan = useLoanStore((s) => s.savePlan)
  const stopLoan = useLoanStore((s) => s.stopPlan)

  const [done, setDone] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectAddress = useCallback((address: string) => {
    setSelectedAddress(address)
    setSearchOpen(false)
    setError('')
  }, [])
  const [kind, setKind] = useState<ContractKind>('monthly')
  const [incomePeriod, setIncomePeriod] = useState<IncomePeriod>('monthly')
  const [mgmtIncluded, setMgmtIncluded] = useState(true)
  const [hasLoan, setHasLoan] = useState(false)
  const [f, setF] = useState({ birth: '', deposit: '', rent: '', mgmtFee: '', contractFee: '', loanAmount: '', income: '', loanAnnualRate: '', loanPaymentDay: '25', loanStartDate: loanToday() })
  const { age, today } = useAge(f.birth)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  if (!user) return null
  const close = () => updateUser({ ...user, firstLogin: false }) // 가드가 홈으로 보내 줌

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (age === null) {
      setError('올바른 생년월일을 입력해 주세요.')
      return
    }
    if (!selectedAddress) {
      setError('주소 검색으로 사는 동네를 선택해 주세요.')
      setSearchOpen(true)
      return
    }
    let loan: LoanTerms | undefined
    if (kind === 'jeonse' && hasLoan) {
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
      kind,
      deposit: monthly ? num(f.deposit) : 0,
      rent: monthly ? num(f.rent) : 0,
      mgmtIncluded: monthly ? mgmtIncluded : false,
      mgmtFee,
      contractFee: monthly ? 0 : num(f.contractFee),
      hasLoan: monthly ? false : hasLoan,
      loanAmount: !monthly && hasLoan ? num(f.loanAmount) : 0,
      loanAnnualRate: loan?.annualRate,
      loanPaymentDay: loan?.paymentDay,
      loanStartDate: loan?.startDate,
      income: num(f.income),
      incomePeriod,
      answeredAt: new Date().toISOString(),
    }
    try {
      const savedUser = await authApi.updateMe({ address: answers.address })
      updateUser({ ...savedUser, firstLogin: user.firstLogin })
      saveSurvey(answers)
      // 생활 설정의 월세는 기존 만원 단위를 유지하므로 경계에서 변환한다.
      saveSettings({ ...settings, region: answers.address, rent: answers.rent / 10000 })
      if (mgmtFee > 0) addBill('관리비', mgmtFee, '관리비')
      if (loan) saveLoan(loan)
      else stopLoan()
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '정보를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  // 왼쪽(모바일은 위) 진행 단계: 칸을 채우면 ✓
  const steps = [
    { label: '생년월일', ok: age !== null },
    { label: '사는 곳', ok: !!selectedAddress },
    { label: '계약 정보', ok: kind === 'monthly' ? !!f.deposit && !!f.rent : !!f.contractFee },
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
        <p className={styles.sub}>월세 알림과 고정 지출 계산에 써요. 1분이면 끝나요.</p>
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
            <p>입력한 월세·관리비를 반영했어요. 전세 대출이 있으면 설정한 납부일에 이자가 가계부에 자동 기록돼요.</p>
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
                <input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} min="1900-01-01" max={today} required autoFocus aria-describedby="survey-age" />
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
                      <AmountInput value={f.deposit} onValueChange={(value) => set('deposit', value)} max={9999990000} placeholder="예) 10,000,000" required />
                    </label>
                    <label>
                      월세 (원)
                      <AmountInput value={f.rent} onValueChange={(value) => set('rent', value)} max={99990000} placeholder="예) 550,000" required />
                    </label>
                  </div>
                  <p className={styles.q}>월세에 관리비가 포함돼 있나요?</p>
                  <div className={styles.yn} role="group" aria-label="관리비 포함 여부">
                    <button type="button" className={cx(styles.ynBtn, mgmtIncluded && styles.kindOn)} aria-pressed={mgmtIncluded} onClick={() => setMgmtIncluded(true)}>
                      포함이에요
                    </button>
                    <button type="button" className={cx(styles.ynBtn, !mgmtIncluded && styles.kindOn)} aria-pressed={!mgmtIncluded} onClick={() => setMgmtIncluded(false)}>
                      따로 내요
                    </button>
                  </div>
                  {!mgmtIncluded && (
                    <label>
                      관리비 (원, 매달)
                      <AmountInput value={f.mgmtFee} onValueChange={(value) => set('mgmtFee', value)} max={9990000} placeholder="예) 70,000" required />
                    </label>
                  )}
                </div>
              ) : (
                <div className={styles.sub3}>
                  <label>
                    계약금 (원)
                    <AmountInput value={f.contractFee} onValueChange={(value) => set('contractFee', value)} max={9999990000} placeholder="예) 20,000,000" required />
                  </label>
                  <p className={styles.q}>전세 대출을 받았나요?</p>
                  <div className={styles.yn} role="group" aria-label="대출 여부">
                    <button type="button" className={cx(styles.ynBtn, !hasLoan && styles.kindOn)} aria-pressed={!hasLoan} onClick={() => setHasLoan(false)}>
                      없어요
                    </button>
                    <button type="button" className={cx(styles.ynBtn, hasLoan && styles.kindOn)} aria-pressed={hasLoan} onClick={() => setHasLoan(true)}>
                      있어요
                    </button>
                  </div>
                  {hasLoan && (
                    <LoanFields
                      value={{ principal: f.loanAmount, annualRate: f.loanAnnualRate, paymentDay: f.loanPaymentDay, startDate: f.loanStartDate }}
                      onChange={(value) => setF((previous) => ({ ...previous, loanAmount: value.principal, loanAnnualRate: value.annualRate, loanPaymentDay: value.paymentDay, loanStartDate: value.startDate }))}
                    />
                  )}
                  <label>
                    관리비 (원, 매달)
                    <AmountInput value={f.mgmtFee} onValueChange={(value) => set('mgmtFee', value)} max={9990000} placeholder="없으면 0" required />
                  </label>
                </div>
              )}
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
                <AmountInput value={f.income} onValueChange={(value) => set('income', value)} max={incomePeriod === 'monthly' ? 999990000 : 11999880000} placeholder={incomePeriod === 'monthly' ? '예) 2,500,000' : '예) 30,000,000'} required />
              </label>
            </section>

            {error && <p role="alert">{error}</p>}
            <Button type="submit" size="lg" block loading={saving}>
              설문 완료
            </Button>
            <button type="button" className={styles.skip} onClick={close} disabled={saving}>
              나중에 할게요
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

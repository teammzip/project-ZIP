import { useCallback, useState, type FormEvent } from 'react'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import { authApi, useAuthStore } from '@/features/auth'
import { useLifeStore } from '@/features/life'
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
  const [f, setF] = useState({ birth: '', deposit: '', rent: '', mgmtFee: '', contractFee: '', loanAmount: '', income: '' })
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
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '정보를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <img src={logo} alt="ZIP" />
      </header>
      <main className={styles.card}>
        {done ? (
          <div className={styles.doneBox}>
            <div className={styles.doneIco} aria-hidden>🎉</div>
            <h1>설문이 끝났어요!</h1>
            <p>입력한 월세와 관리비는 고정 지출과 알림에 바로 반영됐어요. 나머지 정보는 저장해 뒀어요.</p>
            <Button block size="lg" onClick={close}>
              ZIP 시작하기
            </Button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <p className={styles.hello}>
              <b>{user.nickname}</b>님, 환영해요! 👋
            </p>
            <h1 className={styles.title}>우리 집 정보를 알려 주세요</h1>
            <p className={styles.sub}>월세 알림 · 고정 지출 계산에 써요. 모든 금액은 원 단위로 입력해 주세요.</p>

            <section className={styles.sec}>
              <h2>1. 생년월일</h2>
              <label>
                생년월일
                <input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} min="1900-01-01" max={today} required autoFocus aria-describedby="survey-age" />
              </label>
              <p id="survey-age" className={styles.sub} aria-live="polite">
                {age !== null ? `현재 만 ${age}세예요. 생일이 지나면 자동으로 갱신돼요.` : f.birth ? '올바른 생년월일을 입력해 주세요.' : '생년월일을 입력하면 만 나이를 자동으로 계산해요.'}
              </p>
            </section>

            <section className={styles.sec}>
              <h2>2. 간략한 주소</h2>
              <label htmlFor="survey-address">
                사는 곳
                <input id="survey-address" value={selectedAddress} readOnly placeholder="주소 검색으로 동네를 선택해 주세요" aria-describedby="survey-address-help" />
              </label>
              <Button variant="line" onClick={() => setSearchOpen((open) => !open)} disabled={saving} aria-expanded={searchOpen}>
                {searchOpen ? '검색 닫기' : selectedAddress ? '주소 다시 검색' : '주소 검색'}
              </Button>
              <p id="survey-address-help" className={styles.sub}>시·군·구 또는 동·읍·면 이름으로 검색해 주세요. 간략한 주소만 선택하고 저장할 수 있어요.</p>
              {searchOpen && <AddressSearch onSelect={selectAddress} />}
            </section>

            <section className={styles.sec}>
              <h2>3. 계약 유형</h2>
              <div className={styles.kindGrid} role="group" aria-label="계약 유형">
                {([['monthly', '🗓️', '월세', '보증금 + 매달 월세'], ['jeonse', '🏠', '전세', '보증금만 맡기고 월세는 없어요']] as const).map(([v, ico, label, desc]) => (
                  <button key={v} type="button" className={cx(styles.kind, kind === v && styles.kindOn)} aria-pressed={kind === v} onClick={() => setKind(v)}>
                    <span aria-hidden>{ico}</span>
                    <b>{label}</b>
                    <small>{desc}</small>
                  </button>
                ))}
              </div>

              {kind === 'monthly' ? (
                <div className={styles.sub3}>
                  <h3>월세 계약</h3>
                  <div className={common.two}>
                    <label>
                      보증금 (원)
                      <input type="number" inputMode="numeric" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} min={0} max={9999990000} step={1} placeholder="예) 10000000" required />
                    </label>
                    <label>
                      월세 (원)
                      <input type="number" inputMode="numeric" value={f.rent} onChange={(e) => set('rent', e.target.value)} min={0} max={99990000} step={1} placeholder="예) 550000" required />
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
                      <input type="number" inputMode="numeric" step={1} value={f.mgmtFee} onChange={(e) => set('mgmtFee', e.target.value)} min={0} max={9990000} placeholder="예) 70000" required />
                    </label>
                  )}
                </div>
              ) : (
                <div className={styles.sub3}>
                  <h3>전세 계약</h3>
                  <label>
                    계약금 (원)
                    <input type="number" inputMode="numeric" value={f.contractFee} onChange={(e) => set('contractFee', e.target.value)} min={0} max={9999990000} step={1} placeholder="예) 20000000" required />
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
                    <label>
                      대출 금액 (원)
                      <input type="number" inputMode="numeric" value={f.loanAmount} onChange={(e) => set('loanAmount', e.target.value)} min={0} max={9999990000} step={1} placeholder="예) 120000000" required />
                    </label>
                  )}
                  <label>
                    관리비 (원, 매달)
                    <input type="number" inputMode="numeric" step={1} value={f.mgmtFee} onChange={(e) => set('mgmtFee', e.target.value)} min={0} max={9990000} placeholder="없으면 0" required />
                  </label>
                </div>
              )}
            </section>

            <section className={styles.sec}>
              <h2>4. 수입</h2>
              <div className={styles.yn} role="group" aria-label="수입 기준">
                {([['monthly', '월 수입'], ['annual', '연 수입']] as const).map(([period, label]) => (
                  <button key={period} type="button" className={cx(styles.ynBtn, incomePeriod === period && styles.kindOn)} aria-pressed={incomePeriod === period} onClick={() => setIncomePeriod(period)}>
                    {label}
                  </button>
                ))}
              </div>
              <label>
                {incomePeriod === 'monthly' ? '월 수입 (원)' : '연 수입 (원)'}
                <input type="number" inputMode="numeric" value={f.income} onChange={(e) => set('income', e.target.value)} min={0} max={incomePeriod === 'monthly' ? 999990000 : 11999880000} step={1} placeholder={incomePeriod === 'monthly' ? '예) 2500000' : '예) 30000000'} required />
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

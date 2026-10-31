import { useState, type FormEvent } from 'react'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { useLifeStore } from '@/features/life'
import { cx } from '@/lib/cx'
import { todayStr } from '@/lib/date'
import common from '@/styles/common.module.css'
import { useHousingSurveyStore, type ContractKind, type HousingSurvey } from './store'
import styles from './SurveyPage.module.css'

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
  const [kind, setKind] = useState<ContractKind>('monthly')
  const [mgmtIncluded, setMgmtIncluded] = useState(true)
  const [hasLoan, setHasLoan] = useState(false)
  const [f, setF] = useState({ birth: '', address: user?.address ?? '', deposit: '', rent: '', mgmtFee: '', contractFee: '', loanAmount: '', income: '' })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  if (!user) return null
  const close = () => updateUser({ ...user, firstLogin: false }) // 가드가 홈으로 보내 줌

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const monthly = kind === 'monthly'
    const mgmtFee = monthly && mgmtIncluded ? 0 : num(f.mgmtFee)
    const answers: HousingSurvey = {
      birth: f.birth,
      address: f.address.trim(),
      kind,
      deposit: monthly ? num(f.deposit) : 0,
      rent: monthly ? num(f.rent) : 0,
      mgmtIncluded: monthly ? mgmtIncluded : false,
      mgmtFee,
      contractFee: monthly ? 0 : num(f.contractFee),
      hasLoan: monthly ? false : hasLoan,
      loanAmount: !monthly && hasLoan ? num(f.loanAmount) : 0,
      income: num(f.income),
      answeredAt: new Date().toISOString(),
    }
    saveSurvey(answers)
    saveSettings({ ...settings, rent: answers.rent })
    if (mgmtFee > 0) addBill('관리비', mgmtFee * 10000, '관리비')
    setDone(true)
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
            <p className={styles.sub}>월세 알림 · 고정 지출 계산에 써요. 모든 금액은 만원 단위예요.</p>

            <section className={styles.sec}>
              <h2>1. 생년월일</h2>
              <label>
                생년월일
                <input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} min="1900-01-01" max={todayStr()} required autoFocus />
              </label>
            </section>

            <section className={styles.sec}>
              <h2>2. 간략한 주소</h2>
              <label>
                사는 곳
                <input value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={50} placeholder="예) 서울시 마포구 합정동" required />
              </label>
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
                      보증금 (만원)
                      <input type="number" inputMode="numeric" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} min={0} max={999999} placeholder="예) 1000" required />
                    </label>
                    <label>
                      월세 (만원)
                      <input type="number" inputMode="numeric" value={f.rent} onChange={(e) => set('rent', e.target.value)} min={0} max={9999} placeholder="예) 55" required />
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
                      관리비 (만원, 매달)
                      <input type="number" inputMode="decimal" step="0.1" value={f.mgmtFee} onChange={(e) => set('mgmtFee', e.target.value)} min={0} max={999} placeholder="예) 7" required />
                    </label>
                  )}
                </div>
              ) : (
                <div className={styles.sub3}>
                  <h3>전세 계약</h3>
                  <label>
                    계약금 (만원)
                    <input type="number" inputMode="numeric" value={f.contractFee} onChange={(e) => set('contractFee', e.target.value)} min={0} max={999999} placeholder="예) 2000" required />
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
                      대출 금액 (만원)
                      <input type="number" inputMode="numeric" value={f.loanAmount} onChange={(e) => set('loanAmount', e.target.value)} min={0} max={999999} placeholder="예) 12000" required />
                    </label>
                  )}
                  <label>
                    관리비 (만원, 매달)
                    <input type="number" inputMode="decimal" step="0.1" value={f.mgmtFee} onChange={(e) => set('mgmtFee', e.target.value)} min={0} max={999} placeholder="없으면 0" required />
                  </label>
                </div>
              )}
            </section>

            <section className={styles.sec}>
              <h2>4. 수입</h2>
              <label>
                한 달 수입 (월급 등, 만원)
                <input type="number" inputMode="numeric" value={f.income} onChange={(e) => set('income', e.target.value)} min={0} max={99999} placeholder="예) 250" required />
              </label>
            </section>

            <Button type="submit" size="lg" block>
              설문 완료
            </Button>
            <button type="button" className={styles.skip} onClick={close}>
              나중에 할게요
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

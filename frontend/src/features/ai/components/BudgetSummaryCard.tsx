import { man, won } from '@/lib/date'
import { incomeComparison } from '../budgetSummary'
import type { SpendCard } from '../store'
import styles from './Ai.module.css'

export function BudgetSummaryCard({ card: c, onGo }: { card: SpendCard; onGo: () => void }) {
  const diff = c.total - (c.prevTotal ?? 0)
  const income = c.income
  const max = c.rows[0]?.[1] || 1
  const pct = c.total ? Math.round((c.fixed / c.total) * 100) : 0
  const comparisonMax = Math.max(income ?? 0, c.total, 1)
  const exceeded = income !== undefined && income > 0 && c.total > income
  return (
    <section className={styles.sumCard} aria-label={`${c.month}월 ${income === undefined ? '지출 요약' : '수입·지출 요약'}`}>
      <small>{c.month}월 {income === undefined ? '지출 요약' : '수입·지출 요약'}</small>
      {income === undefined ? (
        <>
          <b className={styles.sumTotal}>{won(c.total)}</b>
          <p className={diff > 0 ? styles.sumUp : styles.sumCmp}>
            {c.prevTotal ? `지난달보다 ${diff === 0 ? '같아요' : `${man(Math.abs(diff))} ${diff > 0 ? '더 썼어요' : '덜 썼어요'}`}` : '지난달 기록이 없어요'}
          </p>
        </>
      ) : (
        <>
          <div className={styles.budgetBars}>
            <div>
              <p><span>총수입</span><b>{won(income)}</b></p>
              <div className={styles.sumBar} aria-hidden="true">
                <i className={styles.incomeBar} style={{ width: `${income / comparisonMax * 100}%` }} />
              </div>
            </div>
            <div>
              <p><span>총지출</span><b>{won(c.total)}</b></p>
              <div className={styles.sumBar} aria-hidden="true">
                <i className={exceeded ? styles.excessBar : undefined} style={{ width: `${c.total / comparisonMax * 100}%` }} />
              </div>
            </div>
          </div>
          <p className={exceeded ? styles.budgetExcess : styles.sumCmp}>{incomeComparison(c.total, income)}</p>
        </>
      )}
      {income !== undefined && c.rows.length > 0 && <b className={styles.sumNote}>지출이 큰 항목</b>}
      <div className={styles.sumRows}>
        {c.rows.map(([n, v]) => (
          <div key={n} className={styles.sumRow}>
            <span className={styles.sumName} title={n}>{n}</span>
            <span className={styles.sumBar}>
              <i aria-hidden="true" style={{ width: `${v / max * 100}%` }} />
            </span>
            <span className={styles.sumVal}>{income === undefined ? man(v) : won(v)}</span>
          </div>
        ))}
      </div>
      <p className={styles.sumNote}>
        {income === undefined ? `고정 지출 ${pct}% · 변동 지출 ${100 - pct}%` : '기록된 기타 지출과 납부 완료된 고정 지출 기준이에요.'}
        {c.top && `\n가장 큰 기타 지출 · ${c.top[0]} ${income === undefined ? man(c.top[1]) : won(c.top[1])}`}
      </p>
      <button type="button" className={styles.sumGo} onClick={onGo}>
        가계부에서 자세히 보기
      </button>
    </section>
  )
}

import { useProfile } from '@/app/useProfile'
import { HomeAiCard } from '@/features/ai'
import { HomeTips } from '@/features/community'
import { IncomeChart, LifeStatGrid, SpendDonut } from '@/features/life'
import { MemoWidget } from '@/features/memo'
import styles from './HomePage.module.css'

/* 홈(대시보드): 요약 카드(사진 상담 · 알림 회전창 포함) → 메모 위젯 → 월별 수입 · 지출 구성 → 꿀팁 · AI와 대화 */
export function HomePage() {
  const profile = useProfile()

  return (
    <div className={styles.page}>
      <LifeStatGrid />

      <MemoWidget />

      <section className={styles.row}>
        <IncomeChart />
        <SpendDonut />
      </section>

      <section className={styles.row}>
        <HomeTips />
        <HomeAiCard ctx={profile} />
      </section>
    </div>
  )
}

import { useProfile } from '@/app/useProfile'
import { HomeAiCard } from '@/features/ai'
import { HomeTips } from '@/features/community'
import { HomeNotiCard, IncomeChart, LifeStatGrid, SpendDonut } from '@/features/life'
import { MemoWidget } from '@/features/memo'
import styles from './HomePage.module.css'

/* 홈(대시보드, 팀장님 시안): 메모 | 알림 회전창 → 요약 카드(사진 상담 포함) → 월별 수입 · 지출 구성 → 꿀팁 · AI와 대화 */
export function HomePage() {
  const profile = useProfile()

  return (
    <div className={styles.page}>
      <section className={styles.top}>
        <MemoWidget />
        <HomeNotiCard />
      </section>

      <LifeStatGrid />

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

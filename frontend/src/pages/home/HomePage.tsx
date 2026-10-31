import { HomeTips } from '@/features/community'
import { HomeNotiCard, IncomeChart, LifeStatGrid, SpendDonut } from '@/features/life'
import { HomeMapCard } from '@/features/map'
import { MemoWidget } from '@/features/memo'
import styles from './HomePage.module.css'

/* 홈(대시보드, 팀장님 시안): 메모 | 알림 회전창 → 요약 카드(기념일 포함) → 월별 수입 · 지출 구성 → 꿀팁 · 동네 지도 */
export function HomePage() {
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
        <HomeMapCard />
      </section>
    </div>
  )
}

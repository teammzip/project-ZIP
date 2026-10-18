import { Link } from 'react-router-dom'
import { useProfile } from '@/app/useProfile'
import { Card } from '@/components/ui'
import { HomeAiCard } from '@/features/ai'
import { HomeTips } from '@/features/community'
import { IncomeChart, LifeStatGrid, SpendDonut } from '@/features/life'
import styles from './HomePage.module.css'

/* 홈(대시보드): 사진 상담 → 요약 카드 → 월별 수입 · 지출 구성 → 꿀팁 · AI와 대화 */
export function HomePage() {
  const profile = useProfile()

  return (
    <div className={styles.page}>
      <Card className={styles.photo}>
        <span className={styles.photoIco} aria-hidden="true">
          📷
        </span>
        <div className={styles.photoCopy}>
          <h2>사진으로 생활 고민을 물어보세요</h2>
          <p>사진을 첨부하고 도움받을 분야를 골라보세요.</p>
          <small>현재는 데모로, 사진 내용을 직접 분석하지 않습니다.</small>
        </div>
        <Link to="/photo" className={styles.photoBtn}>
          사진으로 상담 시작
        </Link>
      </Card>

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

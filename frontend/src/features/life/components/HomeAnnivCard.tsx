import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { monthDay } from '@/lib/date'
import { ddayText, upcomingAnniversaries } from '../derive'
import { useLifeStore } from '../store'
import home from './home.module.css'
import styles from './HomeAnnivCard.module.css'

/** 요약 카드 4번째 칸: 오늘이거나 앞으로 올 가장 가까운 기념일 (D-day).
 * 기념일은 마이페이지 일정 > 일정 기록하기 > 🎉 기념일 에서 추가. 카드를 누르면 일정 화면으로 */
export function HomeAnnivCard() {
  const events = useLifeStore((s) => s.events)
  const list = upcomingAnniversaries(events)
  const next = list[0]
  const name = next?.ev.title.replace(/^🎉\s*/, '')

  return (
    <Link to="/my/calendar" className={cx(home.stat, home.pink, styles.card)} aria-label={next ? `기념일 ${name} ${ddayText(next.diff)}, 일정 보기` : '기념일 추가하러 가기'}>
      <span className={home.statLabel}>🎉 다가오는 기념일</span>
      {next ? (
        <>
          <span className={home.statValue}>{ddayText(next.diff)}</span>
          <span className={styles.name}>{name}</span>
          <span className={home.statSub}>
            {monthDay(next.date)}
            {next.ev.yearly && ' · 매년'}
            {list.length > 1 && ` · 외 ${list.length - 1}개`}
          </span>
        </>
      ) : (
        <>
          <span className={cx(home.statValue, home.valueSm)}>기념일이 없어요</span>
          <span className={home.statSub}>눌러서 생일 · 기념일을 추가해 보세요</span>
        </>
      )}
    </Link>
  )
}

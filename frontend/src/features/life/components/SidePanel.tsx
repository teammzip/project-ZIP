import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { cx } from '@/lib/cx'
import { monthKeyOf } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import { trashIco } from '../data/catalog'
import { dayWord, monthsBetween, nextRentDate, nextTrashDay } from '../derive'
import { useLifeStore } from '../store'
import styles from './SidePanel.module.css'

type Props = {
  /** 닉네임은 로그인 정보(auth)에 있어서 쓰는 쪽이 넘겨 줌 */
  name: string
  onLogout: () => void
  logoutPending?: boolean
  className?: string
}

/** 오른쪽 패널: 프로필 · 월세/거주/계약 남음 · 다가오는 알림 (팀 시안의 .panel. 할 일 목록은 일정으로 합쳐져서 빠짐) */
export function SidePanel({ name, onLogout, logoutPending, className }: Props) {
  const { settings } = useLifeStore(useShallow((s) => ({ settings: s.settings })))
  const now = useToday()
  const thisMonth = monthKeyOf(now)
  const lived = Math.max(0, monthsBetween(settings.moveIn, thisMonth))
  const left = Math.max(0, monthsBetween(thisMonth, settings.contractEnd))

  const rent = nextRentDate(settings.rentDay)
  const nextTrash = nextTrashDay() // 가장 가까운 배출 (오늘 포함)
  const nextRecycle = nextTrashDay('재활용', true) // 내일부터 다음 재활용

  return (
    <aside className={cx(styles.panel, className)} aria-label="내 요약">
      <div className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">
          {name.charAt(0)}
        </span>
        <div className={styles.who}>
          <b>{name}</b>
          <small>📍 {settings.region || '지역 미설정'}</small>
        </div>
        <button type="button" className={styles.logout} onClick={onLogout} disabled={logoutPending}>
          로그아웃
        </button>
      </div>

      <div className={styles.miniStats}>
        <div>
          <b>{settings.rent}만</b>
          <small>월세</small>
        </div>
        <div>
          <b>{lived}개월</b>
          <small>거주</small>
        </div>
        <div>
          <b>{left}개월</b>
          <small>계약 남음</small>
        </div>
      </div>

      <section>
        <h3>다가오는 알림</h3>
        <Link to="/my/calendar?mode=week" className={styles.sched} aria-label="쓰레기 배출 일정 달력에서 보기">
          <span className={styles.ico}>{nextTrash ? trashIco(nextTrash.t.t) : '🗑️'}</span>
          <div className={styles.t}>
            <b>{nextTrash ? `${nextTrash.t.t} 배출` : '배출 일정 없음'}</b>
            <small>{nextTrash ? `${nextTrash.k === 0 ? '오늘 ' : ''}${nextTrash.t.d}` : ''}</small>
          </div>
          <time>{nextTrash ? dayWord(nextTrash.k, nextTrash.idx) : ''}</time>
        </Link>
        <div className={styles.sched}>
          <span className={styles.ico}>💸</span>
          <div className={styles.t}>
            <b>월세 납부</b>
            <small>{settings.rent}만원 · 이체</small>
          </div>
          <time>
            {rent.getMonth() + 1}/{rent.getDate()}
          </time>
        </div>
        <Link to="/my/calendar?mode=week" className={styles.sched} aria-label="재활용 배출 일정 달력에서 보기">
          <span className={styles.ico}>♻️</span>
          <div className={styles.t}>
            <b>재활용 배출</b>
            <small>{nextRecycle ? nextRecycle.t.d : '배출 일정 없음'}</small>
          </div>
          <time>{nextRecycle ? dayWord(nextRecycle.k, nextRecycle.idx) : ''}</time>
        </Link>
      </section>
    </aside>
  )
}

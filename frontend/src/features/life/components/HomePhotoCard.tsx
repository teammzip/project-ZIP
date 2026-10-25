import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'
import { todayStr } from '@/lib/date'
import { readJSON, writeJSON } from '@/lib/storage'
import { useNotis } from '../derive'
import { useLifeStore } from '../store'
import home from './home.module.css'
import styles from './HomePhotoCard.module.css'

/* 홈 카드 두 개 (팀장님 시안)
 * - HomePhotoCard: 요약 카드 4번째 칸, 사진으로 생활 고민 상담
 * - HomeNotiCard: 맨 위 줄 메모 옆 알림 칸 (components/home-noti.js)
 *   "닫기"를 누른 알림은 오늘 하루 안 보임(localStorage 'zip-home-noti-closed'). 다음 날이면 다시 나옴 */
const KEY = 'zip-home-noti-closed'
/** 홈 알림 칸에 한 번에 보여 줄 알림 수 */
const MAX_SHOWN = 3

function readClosed(): string[] {
  const c = readJSON<{ date: string; ids: string[] }>(KEY)
  return c && c.date === todayStr() && Array.isArray(c.ids) ? c.ids : []
}

/** 요약 카드 4번째 칸: 사진으로 생활 고민 상담 (다른 요약 카드처럼 색 바탕, 버튼만 흰색) */
export function HomePhotoCard() {
  return (
    <article className={cx(home.stat, home.pink, styles.card)} aria-labelledby="home-photo-title">
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
        <h3 id="home-photo-title">사진으로 생활 고민을 물어보세요</h3>
      </div>
      <Link to="/photo" className={styles.cta}>
        <span className={styles.pcLabel}>사진 선택하고 상담 시작</span>
        <span className={styles.moLabel}>사진 찍고 상담 시작</span>
      </Link>
    </article>
  )
}

/** 메모 옆 알림 칸: 알림이 세로로 쌓여 있고, 맨 위부터 "닫기"를 누르면 옆으로 날아가며 아래 알림이 올라옴.
 * 3개까지 보이고(팀장님 시안 #30) 나머지는 "+N개 더 있어요". 다 닫아도 칸은 남아 "새 알림이 없어요" + 닫은 알림 다시 보기 */
export function HomeNotiCard() {
  const { notis } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const navigate = useNavigate()
  const [closed, setClosed] = useState(readClosed)
  const [leaving, setLeaving] = useState<string | null>(null)
  const list = notiOn ? notis.filter((x) => !closed.includes(x.id)) : []
  const shown = list.slice(0, MAX_SHOWN)
  const more = list.length - shown.length

  const save = (ids: string[]) => {
    writeJSON(KEY, { date: todayStr(), ids })
    setClosed(ids)
  }
  const close = (id: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setLeaving(id) // 옆으로 날아간 뒤 지우고, 아래 알림이 올라옴
    setTimeout(
      () => {
        setLeaving(null)
        save([...readClosed(), id])
      },
      reduce ? 0 : 320,
    )
  }

  return (
    <section className={styles.noti} aria-label="알림">
      <div className={styles.notiHead}>
        <b>🔔 알림</b>
        {list.length > 0 && <span className={styles.count}>{list.length}개</span>}
        <Link to="/my/noti" className={styles.all}>
          알림 전체 보기
        </Link>
      </div>
      {list.length === 0 ? (
        <div className={styles.empty}>
          <span aria-hidden="true">🔔</span>
          <b>{notiOn ? '새 알림이 없어요' : '알림이 꺼져 있어요'}</b>
          <small>{notiOn ? '알림이 생기면 여기에 쌓여요.' : '내 정보에서 알림 받기를 켜 보세요.'}</small>
          {notiOn && closed.length > 0 && (
            <Button variant="line" onClick={() => save([])}>
              닫은 알림 다시 보기
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.stack} aria-live="polite">
          {shown.map((item) => (
            <div key={item.id} className={cx(styles.row, leaving === item.id && styles.out)}>
              <span className={styles.ico}>{item.ico}</span>
              <div className={styles.text}>
                <b>{item.t}</b>
                <small>{item.s}</small>
              </div>
              <span className={styles.time}>{item.time}</span>
              <button type="button" className={styles.close} onClick={() => close(item.id)} aria-label={`${item.t} 알림 닫기`} disabled={leaving === item.id}>
                닫기
              </button>
            </div>
          ))}
        </div>
      )}
      {more > 0 && (
        <button type="button" className={styles.more} onClick={() => navigate('/my/noti')}>
          +{more}개 더 있어요
        </button>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { todayStr } from '@/lib/date'
import { readJSON, writeJSON } from '@/lib/storage'
import { useNotis } from '../derive'
import { useLifeStore } from '../store'
import styles from './HomePhotoCard.module.css'

/* 홈 카드 두 개 (팀장님 시안)
 * - HomePhotoCard: 요약 카드 4번째 칸, 사진으로 생활 고민 상담
 * - HomeNotiCard: 맨 위 줄 메모 옆 알림 회전창 (components/home-noti.js)
 *   알림이 하나씩 옆으로 돌아감(4.5초마다, 마우스를 올리면 멈춤). ‹ › 와 점으로 넘길 수도 있음
 *   "닫기"를 누르면 그 알림은 오늘 하루 안 보임(localStorage 'zip-home-noti-closed'). 다 닫거나 알림을 꺼 두면 카드가 없어짐 */
const KEY = 'zip-home-noti-closed'
const AUTO_MS = 4500

function readClosed(): string[] {
  const c = readJSON<{ date: string; ids: string[] }>(KEY)
  return c && c.date === todayStr() && Array.isArray(c.ids) ? c.ids : []
}

/** 요약 카드 4번째 칸: 사진으로 생활 고민 상담 */
export function HomePhotoCard() {
  return (
    <article className={styles.card} aria-labelledby="home-photo-title">
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

/** 메모 옆 알림 회전창 */
export function HomeNotiCard() {
  const { notis } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const [closed, setClosed] = useState(readClosed)
  const [idx, setIdx] = useState(0)
  const [hover, setHover] = useState(false)
  const list = notiOn ? notis.filter((x) => !closed.includes(x.id)) : []
  const n = list.length
  const cur = n ? Math.min(idx, n - 1) : 0

  // 자동으로 다음 알림으로 (2개 이상 · 마우스가 올라와 있지 않을 때 · '동작 줄이기' 설정이 아닐 때)
  useEffect(() => {
    if (n < 2 || hover || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIdx((i) => (Math.min(i, n - 1) + 1) % n), AUTO_MS)
    return () => clearInterval(t)
  }, [n, hover])

  if (!n) return null
  const close = (id: string) => {
    const ids = [...closed, id]
    writeJSON(KEY, { date: todayStr(), ids })
    setClosed(ids)
  }
  const go = (i: number) => setIdx((i + n) % n)

  return (
    <section className={styles.noti} aria-label="알림" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className={styles.notiHead}>
        <b>🔔 알림</b>
        <span className={styles.count}>
          {cur + 1} / {n}
        </span>
        <Link to="/my/noti" className={styles.all}>
          알림 전체 보기
        </Link>
      </div>
      <div className={styles.stage}>
        {n > 1 && (
          <button type="button" className={styles.nav} onClick={() => go(cur - 1)} aria-label="이전 알림">
            ‹
          </button>
        )}
        <div className={styles.view} aria-live="polite">
          <div className={styles.track} style={{ transform: `translateX(${-cur * 100}%)` }}>
            {list.map((item, k) => (
              <div key={item.id} className={styles.slide} aria-hidden={k !== cur}>
                <span className={styles.ico}>{item.ico}</span>
                <div className={styles.text}>
                  <b>{item.t}</b>
                  <small>{item.s}</small>
                </div>
                <span className={styles.time}>{item.time}</span>
                <button type="button" className={styles.close} onClick={() => close(item.id)} aria-label={`${item.t} 알림 닫기`} tabIndex={k === cur ? 0 : -1}>
                  닫기
                </button>
              </div>
            ))}
          </div>
        </div>
        {n > 1 && (
          <button type="button" className={styles.nav} onClick={() => go(cur + 1)} aria-label="다음 알림">
            ›
          </button>
        )}
      </div>
      {n > 1 && (
        <div className={styles.dots}>
          {list.map((item, k) => (
            <button key={item.id} type="button" className={cx(styles.dot, k === cur && styles.dotOn)} aria-label={`${k + 1}번째 알림`} onClick={() => setIdx(k)} />
          ))}
        </div>
      )}
    </section>
  )
}

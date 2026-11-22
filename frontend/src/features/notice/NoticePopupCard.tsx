import { Link } from 'react-router-dom'
import room from '@/assets/images/cinema-room.jpg'
import logo from '@/assets/images/logo-zip.png'
import robot from '@/assets/images/robot-cut.png'
import { cx } from '@/lib/cx'
import styles from './Notice.module.css'

export type PopupItem = { id: string; title: string; body: string; createdAt: string }

type Props = {
  items: PopupItem[]
  /** 지금 보고 있는 공지 (없으면 첫 번째) */
  selected?: string
  onSelect?: (id: string) => void
  /** 자세히 보기로 갈 주소 (미리보기면 없음) */
  linkFor?: (id: string) => string
  onClose: () => void
  onHideWeek: () => void
}

const dateText = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })

/**
 * 공지 팝업 — 위 배너(ZIP 로봇 · 로고 · "공지사항") + 본문(가운데 정렬) + 아래 어두운 바(일주일 동안 보지 않기 · 닫기).
 * 공지가 여러 개면 목록을 함께 보여 주고, 고르면 그 공지가 보여요 (PC: 왼쪽 목록, 모바일: 위 탭).
 * 회원 화면의 팝업과 관리자 미리보기가 같이 써요.
 */
export function NoticePopupCard({ items, selected, onSelect, linkFor, onClose, onHideWeek }: Props) {
  const current = items.find((n) => n.id === selected) ?? items[0]
  if (!current) return null
  const many = items.length > 1
  const link = linkFor?.(current.id)
  return (
    <div className={cx(styles.card, many && styles.cardWide)}>
      <div className={styles.banner} style={{ backgroundImage: `linear-gradient(90deg, rgba(235, 243, 255, 0.55) 0%, rgba(235, 243, 255, 0.92) 45%, #eef4ff 100%), url(${room})` }}>
        <img className={styles.bannerRobot} src={robot} alt="" />
        <div className={styles.bannerText}>
          <img className={styles.bannerLogo} src={logo} alt="ZIP" />
          <span className={styles.bannerTag}>혼자 사는 모두, ZIP에 산다</span>
          <span className={styles.bannerRule} aria-hidden="true"><i /></span>
          <strong className={styles.bannerTitle}>공지사항</strong>
        </div>
      </div>

      <div className={cx(many && styles.multi)}>
        {many && (
          <nav className={styles.pList} aria-label={`공지 ${items.length}개`}>
            <span className={styles.pListHead}>공지 {items.length}개</span>
            {items.map((n) => (
              <button key={n.id} type="button" className={cx(styles.pItem, n.id === current.id && styles.pItemOn)}
                aria-current={n.id === current.id || undefined} onClick={() => onSelect?.(n.id)}>
                <strong>{n.title || '제목 없음'}</strong>
                <time dateTime={n.createdAt}>{shortDate(n.createdAt)}</time>
              </button>
            ))}
          </nav>
        )}
        <div className={styles.cardBody} key={current.id}>
          <h3 className={styles.cardTitle}>{current.title || '제목을 입력하면 여기에 보여요'}</h3>
          <time className={styles.cardDate} dateTime={current.createdAt}>{dateText(current.createdAt)}</time>
          <p className={styles.cardText}>{current.body || '내용을 입력하면 여기에 보여요.'}</p>
          {link
            ? <Link className={styles.cardMore} to={link} onClick={onClose}>공지사항에서 자세히 보기 ›</Link>
            : <span className={styles.cardMore}>공지사항에서 자세히 보기 ›</span>}
        </div>
      </div>

      <div className={styles.cardFoot}>
        <button type="button" className={styles.cardSkip} onClick={onHideWeek}>일주일 동안 보지 않기</button>
        <button type="button" className={styles.cardClose} onClick={onClose}>닫기 <span aria-hidden="true">✕</span></button>
      </div>
    </div>
  )
}

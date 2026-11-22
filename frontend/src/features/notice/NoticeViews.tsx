import { Card } from '@/components/ui'
import common from '@/styles/common.module.css'
import type { Notice } from './store'
import styles from './Notice.module.css'

const dateText = (value: string) => new Date(value).toLocaleDateString('ko-KR')

/** 공지 목록 (누르면 onSelect) */
export function NoticeList({ notices, onSelect, selected, showPopup = false }: { notices: Notice[]; onSelect: (id: string) => void; selected?: string; showPopup?: boolean }) {
  if (!notices.length) return <p className={common.empty}>아직 등록된 공지가 없어요.</p>
  return (
    <div className={styles.list}>
      {notices.map((n) => (
        <button key={n.id} type="button" className={styles.item} aria-current={selected === n.id || undefined} onClick={() => onSelect(n.id)}>
          <span className={styles.meta}>
            {n.pinned && <span className={styles.pin}>📌 고정</span>}
            {showPopup && n.popup && <span className={styles.pin}>🔔 팝업</span>}
            <time dateTime={n.createdAt}>{dateText(n.createdAt)}</time>
          </span>
          <strong>{n.title}</strong>
        </button>
      ))}
    </div>
  )
}

/** 공지 내용 */
export function NoticeDetail({ notice }: { notice: Notice }) {
  const edited = notice.updatedAt.slice(0, 16) !== notice.createdAt.slice(0, 16)
  return (
    <Card title={notice.title}>
      <div className={styles.meta}>
        {notice.pinned && <span className={styles.pin}>📌 고정</span>}
        <span>{notice.author}</span>
        <time dateTime={notice.createdAt}>{dateText(notice.createdAt)}</time>
        {edited && <span>· 수정 {dateText(notice.updatedAt)}</span>}
      </div>
      <p className={styles.content}>{notice.body}</p>
    </Card>
  )
}

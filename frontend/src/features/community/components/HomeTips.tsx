import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { HOME_TIPS } from '../data/seed'
import styles from './Community.module.css'

/** 홈 "자취 꿀팁 게시글" 카드: 누르면 커뮤니티의 해당 글 상세로 */
export function HomeTips() {
  return (
    <Card
      title="자취 꿀팁 게시글"
      actions={
        <Link to="/community" className={common.link}>
          더 보기
        </Link>
      }
    >
      {HOME_TIPS.map((t) => (
        <Link key={t.id} to={`/community?post=${t.id}`} className={styles.tip}>
          <span className={styles.thumb} style={{ background: t.bg }} aria-hidden="true">
            {t.emoji}
          </span>
          <span className={styles.tipInfo}>
            <b>{t.title}</b>
            <small>{t.sub}</small>
          </span>
          <span className={cx(common.tag, t.tag === '실전' && common.tagWarn)}>{t.tag}</span>
        </Link>
      ))}
    </Card>
  )
}

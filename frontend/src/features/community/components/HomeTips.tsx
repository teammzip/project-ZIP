import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { isMockApi } from '@/features/auth'
import { CAT_ICON } from '../data/display'
import { HOME_TIPS } from '../data/seed'
import { useServerHomeTips } from '../useCommunity'
import styles from './HomeTips.module.css'

/** 홈 "자취 꿀팁 게시글" 카드: 누르면 커뮤니티의 해당 글 상세로 */
export function HomeTips() {
  // 서버 모드: 운영자가 홈 꿀팁으로 고른 글(is_home_tip). 아직 없으면 아래 예시 카드 (누르면 커뮤니티로)
  const tips = useServerHomeTips()
  const serverTips = tips.data ?? [] // 가짜 API 모드에서는 요청이 꺼져 있어 늘 비어 있음
  return (
    <Card
      title="자취 꿀팁 게시글"
      actions={
        <Link to="/community" className={common.link}>
          더 보기
        </Link>
      }
    >
      {serverTips.map((p) => (
        <Link key={p.id} to={`/community?post=${p.id}`} className={styles.tip}>
          <span className={styles.thumb} style={{ background: '#fff8e1' }} aria-hidden="true">
            {CAT_ICON[p.cat] ?? '💡'}
          </span>
          <span className={styles.tipInfo}>
            <b>{p.title}</b>
            <small>
              {p.author} · 공감 {p.likes}
            </small>
          </span>
          <span className={common.tag}>{p.cat}</span>
        </Link>
      ))}
      {!serverTips.length && HOME_TIPS.map((t) => (
        <Link key={t.id} to={isMockApi ? `/community?post=${t.id}` : '/community'} className={styles.tip}>
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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Segmented } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { useNotis } from '../derive'
import { useLifeStore } from '../store'
import styles from './life.module.css'

/** 알림 화면: 전체 | 안 읽음, 누르면 읽음, 모두 읽음 */
export function NotiCenter() {
  const { notis, notiRead, unread } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const markRead = useLifeStore((s) => s.markRead)
  const [mode, setMode] = useState<'all' | 'unread'>('all')
  const items = mode === 'unread' ? notis.filter((n) => !notiRead[n.id]) : notis

  return (
    <Card
      title={
        <>
          알림 {unread > 0 && <span className={cx(common.tag, common.tagWarn)}>{unread}개 안 읽음</span>}
        </>
      }
      actions={
        <div className={common.actions}>
          <Segmented
            label="알림 보기"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'all', label: '전체' },
              { value: 'unread', label: '안 읽음' },
            ]}
          />
          <Button variant="line" onClick={() => markRead(notis.map((n) => n.id))} disabled={unread === 0}>
            모두 읽음
          </Button>
        </div>
      }
    >
      {!notiOn && (
        <p className={common.notice}>
          알림이 꺼져 있어요. <Link to="/my/settings">내 정보</Link>에서 켤 수 있어요.
        </p>
      )}
      {items.map((n) => {
        const isUnread = !notiRead[n.id]
        return (
          <button key={n.id} type="button" className={cx(common.noti, styles.notiBtn, isUnread && styles.unread)} onClick={() => markRead([n.id])}>
            <div className={common.notiIco}>{n.ico}</div>
            <div className={common.notiText}>
              <b>{n.t}</b>
              <small>
                {n.s} · {n.time}
              </small>
            </div>
            {isUnread && <span className={styles.udot} aria-label="안 읽음" />}
          </button>
        )
      })}
      {!items.length && <p className={common.empty}>알림이 없어요.</p>}
    </Card>
  )
}

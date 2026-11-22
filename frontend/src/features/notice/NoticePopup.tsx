import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { cx } from '@/lib/cx'
import { usePopupNotices } from './api'
import { NoticePopupCard } from './NoticePopupCard'
import { REOPEN, WEEK, hideKey, readHidden } from './popupStorage'
import styles from './Notice.module.css'

/* 앱을 열면 뜨는 공지 팝업 (관리자가 "팝업으로 보여 주기"를 고른 공지).
 * - 일주일 동안 보지 않기: 이 브라우저에 회원별로 7일 기억 (localStorage)
 * - 닫기: 지금 화면에서만 닫힘 → 새로고침하거나 앱을 다시 열면 또 떠요
 * 팝업이 여러 개면 한 창에 목록을 함께 보여 주고, 고르면 그 공지가 보여요. 닫기 · 일주일 안 보기는 지금 뜬 공지 전부에 적용. */

export function NoticePopup() {
  const uid = useAuthStore((s) => s.user?.id)
  const popups = usePopupNotices()
  // 이번 화면에서 닫았는지 (저장이 막힌 브라우저에서도 다시 뜨지 않게)
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState<string>()
  // 앱을 연 시각 기준으로 "일주일 안 보기"를 판단 (렌더마다 시각이 바뀌지 않게)
  const [now] = useState(() => Date.now())
  // '팝업 다시 보기'를 누르면 다시 띄움 (저장소 기록이 바뀌었으니 새로 그림)
  const [, setTick] = useState(0)
  useEffect(() => {
    const reopen = () => { setDismissed(false); setSelected(undefined); setTick((t) => t + 1) }
    window.addEventListener(REOPEN, reopen)
    return () => window.removeEventListener(REOPEN, reopen)
  }, [])
  if (!uid || dismissed) return null
  const hidden = readHidden(uid)
  // 이번에 보여 줄 팝업 공지 (닫았거나 일주일 안 보기 한 것은 빼고, 새 것부터)
  const shown = popups.filter((n) => !((hidden[n.id] ?? 0) > now))
  if (!shown.length) return null
  const ids = shown.map((n) => n.id)

  /** 닫기: 지금 화면에서만 (기록하지 않음 → 새로고침하면 다시 뜸) */
  const close = () => {
    setDismissed(true)
  }
  /** 일주일 동안 보지 않기: 지금 뜬 공지 전부 */
  const hideWeek = () => {
    // 지난 기록은 정리하면서 저장
    const next = Object.fromEntries(Object.entries(readHidden(uid)).filter(([, until]) => until > now))
    for (const id of ids) next[id] = now + WEEK
    try { localStorage.setItem(hideKey(uid), JSON.stringify(next)) } catch { /* 저장 못 해도 이번엔 닫힘 */ }
    setDismissed(true)
  }

  return (
    <Modal open onClose={close} title={`공지사항 ${shown.length}개`} className={cx(styles.popup, shown.length > 1 && styles.popupWide)} hideClose>
      <NoticePopupCard items={shown.map((n) => ({ id: n.id, title: n.title, body: n.body ?? '', createdAt: n.createdAt }))}
        selected={selected} onSelect={setSelected} linkFor={(id) => `/my/settings/notices/${id}`} onClose={close} onHideWeek={hideWeek} />
    </Modal>
  )
}

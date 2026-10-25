import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Modal, Segmented } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { useNotis } from '../derive'
import { useLifeStore } from '../store'
import styles from './life.module.css'

/** 알림 화면: 안 읽음 | 읽음. 누르거나 '읽음' 칸으로 끌어다 놓으면 읽음 처리(보던 탭은 그대로),
 * 안 읽음 탭에는 '모두 읽음', 읽음 탭에는 쌓인 옛 알림을 지우는 '알림 삭제' */
export function NotiCenter() {
  const { notis, notiRead, unread } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const markRead = useLifeStore((s) => s.markRead)
  const deleteNotis = useLifeStore((s) => s.deleteNotis)
  const [mode, setMode] = useState<'unread' | 'read'>('unread')
  const [dragging, setDragging] = useState(false) // 끄는 동안 '읽음' 칸을 강조
  const [overRead, setOverRead] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false) // 알림 삭제 확인 창
  const readList = notis.filter((n) => notiRead[n.id])
  const items = mode === 'unread' ? notis.filter((n) => !notiRead[n.id]) : readList
  const clearRead = () => {
    deleteNotis(readList.map((n) => n.id))
    setConfirmDelete(false)
  }

  return (
    <Card
      title={
        <>
          알림 {unread > 0 && <span className={cx(common.tag, common.tagWarn)}>{unread}개 안 읽음</span>}
        </>
      }
      actions={
        <div className={common.actions}>
          <div className={styles.segDrop} data-noti-tabs data-drag={dragging} data-over={overRead}>
            <Segmented
              label="알림 보기"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'unread', label: '안 읽음' },
                { value: 'read', label: '읽음' },
              ]}
            />
          </div>
          {mode === 'unread' ? (
            <Button variant="line" onClick={() => markRead(notis.map((n) => n.id))} disabled={unread === 0}>
              모두 읽음
            </Button>
          ) : (
            <Button variant="line" onClick={() => setConfirmDelete(true)} disabled={!readList.length}>
              알림 삭제
            </Button>
          )}
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
          <NotiItem
            key={n.id}
            unread={isUnread}
            onRead={() => markRead([n.id])}
            onDragState={(d, over) => {
              setDragging(d)
              setOverRead(over)
            }}
          >
            <div className={common.notiIco}>{n.ico}</div>
            <div className={common.notiText}>
              <b>{n.t}</b>
              <small>
                {n.s} · {n.time}
              </small>
            </div>
            {isUnread && <span className={styles.udot} aria-label="안 읽음" />}
          </NotiItem>
        )
      })}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="알림 삭제" hideClose>
        <div className={styles.confirmBox}>
          <b>읽은 알림 {readList.length}개를 삭제할까요?</b>
          <p>삭제한 알림은 다시 볼 수 없어요.</p>
          <div className={styles.confirmBtns}>
            <Button variant="line" block onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button variant="danger" block onClick={clearRead}>
              삭제
            </Button>
          </div>
        </div>
      </Modal>
      {!items.length && <p className={common.empty}>{mode === 'read' ? '읽은 알림이 없어요.' : '안 읽은 알림이 없어요.'}</p>}
    </Card>
  )
}

type ItemProps = {
  unread: boolean
  onRead: () => void
  /** 끄는 중인지, '읽음' 칸 위인지 알림 (위쪽 '읽음' 칸 강조용) */
  onDragState: (dragging: boolean, overRead: boolean) => void
  children: ReactNode
}

/** 알림 한 줄: 누르면 읽음. 안 읽은 알림을 위쪽 '읽음' 칸으로 끌어다 놓아도 읽음 (마우스는 그냥 끌기, 터치는 꾹 눌렀다가 끌기) */
function NotiItem({ unread, onRead, onDragState, children }: ItemProps) {
  const el = useRef<HTMLButtonElement>(null)
  const st = useRef({ timer: 0, active: false, sx: 0, sy: 0, pid: 0, over: false, justDragged: false })
  const block = (e: Event) => e.preventDefault() // 끄는 동안 터치 화면이 스크롤되지 않게
  const readTabAt = (x: number, y: number) => document.elementsFromPoint(x, y).find((n) => n.matches('[data-noti-tabs] [data-value="read"]'))

  const reset = () => {
    const s = st.current
    clearTimeout(s.timer)
    s.active = false
    s.over = false
    document.removeEventListener('touchmove', block)
    if (el.current) {
      el.current.style.transform = ''
      el.current.dataset.lifting = 'false'
    }
    onDragState(false, false)
  }

  // 끌기 시작: 몸 전체가 따라오고 '읽음' 칸이 강조됨
  const activate = () => {
    const s = st.current
    if (s.active) return
    clearTimeout(s.timer)
    s.active = true
    try {
      el.current?.setPointerCapture(s.pid)
    } catch {
      // 포인터를 못 붙잡아도 끌기는 계속
    }
    if (el.current) el.current.dataset.lifting = 'true'
    document.addEventListener('touchmove', block, { passive: false })
    onDragState(true, false)
  }

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (!unread || (e.pointerType === 'mouse' && e.button !== 0)) return
    const s = st.current
    s.sx = e.clientX
    s.sy = e.clientY
    s.pid = e.pointerId
    // 터치는 스크롤과 구분하려고 잠깐 꾹 눌러야 시작 (마우스는 그냥 끌면 시작)
    if (e.pointerType === 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId) // 빨리 끌어도 움직임을 놓치지 않게
      } catch {
        // 못 붙잡아도 괜찮음
      }
    } else {
      s.timer = window.setTimeout(activate, 250)
    }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const s = st.current
    if (!s.active) {
      if (e.buttons === 0 && e.pointerType === 'mouse') return // 누르지 않고 지나가는 마우스
      if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 6) {
        if (e.pointerType === 'mouse') activate()
        else clearTimeout(s.timer) // 터치로 먼저 움직이면 스크롤
      }
      if (!s.active) return
    }
    if (el.current) el.current.style.transform = `translate(${e.clientX - s.sx}px, ${e.clientY - s.sy}px) scale(1.02)`
    const over = !!readTabAt(e.clientX, e.clientY)
    if (over !== s.over) {
      s.over = over
      onDragState(true, over)
    }
  }
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const s = st.current
    const was = s.active
    const drop = was && e.type === 'pointerup' && !!readTabAt(e.clientX, e.clientY)
    reset()
    if (!was) return
    s.justDragged = true // 끌고 난 직후의 클릭을 막음
    setTimeout(() => (s.justDragged = false), 0)
    if (drop) onRead()
  }

  return (
    <button
      ref={el}
      type="button"
      className={cx(common.noti, styles.notiBtn, unread && styles.unread, unread && styles.draggable)}
      data-lifting="false"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => st.current.active && e.preventDefault()}
      onClick={() => !st.current.justDragged && onRead()}
    >
      {children}
    </button>
  )
}

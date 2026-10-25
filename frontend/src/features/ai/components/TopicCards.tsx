import { useRef, type PointerEvent, type WheelEvent } from 'react'
import { cx } from '@/lib/cx'
import { TOPICS, type Topic } from '../topics'
import styles from './AiChat.module.css'

type Props = {
  /** 눌러서 고른 분야 */
  activeId?: string | null
  /** 사진을 붙였을 때 "사진과 함께 추천"으로 표시할 카드를 가려냄 */
  suggestPhoto?: boolean
  disabled?: boolean
  onPick: (t: Topic) => void
  className?: string
}

/** AI 화면과 홈 대화 모달이 같이 쓰는 분야 카드 줄 (2줄, 옆으로 이동).
 * 모바일은 손가락으로 밀기, PC 는 마우스 끌기 · 휠 · ‹ › 단추로 옆으로 이동 */
export function TopicCards({ activeId, suggestPhoto, disabled, onPick, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  const slide = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 400, behavior: 'smooth' })
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) ref.current?.scrollBy({ left: e.deltaY })
  }

  // 마우스로 끌어서 이동 (터치는 브라우저가 알아서 스크롤)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = ref.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 5) return
    if (!d.moved) {
      d.moved = true
      el.setPointerCapture(e.pointerId)
      el.style.scrollSnapType = 'none'
    }
    el.scrollLeft = d.left - dx
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    if (ref.current) ref.current.style.scrollSnapType = ''
    justDragged.current = true // 끌고 난 뒤의 클릭은 카드 선택으로 치지 않음
    setTimeout(() => (justDragged.current = false), 0)
  }

  return (
    <div className={cx(styles.cardsWrap, className)}>
      <button type="button" className={cx(styles.slideBtn, styles.slideLeft)} onClick={() => slide(-1)} aria-label="카드 왼쪽으로">
        ‹
      </button>
      <button type="button" className={cx(styles.slideBtn, styles.slideRight)} onClick={() => slide(1)} aria-label="카드 오른쪽으로">
        ›
      </button>
      <div ref={ref} className={styles.cards} role="list" aria-label="도움받을 분야" onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={(e) => justDragged.current && (e.stopPropagation(), e.preventDefault())}>
        {TOPICS.map((t) => {
          const suggest = !!suggestPhoto && t.photo
          return (
            <button key={t.id} type="button" role="listitem" disabled={disabled} className={cx(styles.card, activeId === t.id && styles.cardOn, suggest && styles.cardSuggest)} aria-pressed={activeId === t.id} onClick={() => onPick(t)}>
              <span className={styles.cardIco}>{t.ico}</span>
              <b>{t.name}</b>
              <small>{suggest ? '사진과 함께 추천' : t.desc}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

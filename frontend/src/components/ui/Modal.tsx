import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/cx'
import styles from './Modal.module.css'

// 중첩된 모달에서는 가장 위의 창만 키보드 초점을 관리합니다.
const openDialogs: HTMLElement[] = []
const focusableSelector = 'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable="true"], audio[controls], video[controls], summary'
const focusableElements = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity))

type Props = {
  open: boolean
  onClose: () => void
  /** 스크린리더용 제목 (화면에 안 보여도 꼭 넣기) */
  title: string
  children: ReactNode
  /** 창 모양을 바꿀 때 (예: AI 대화 창은 더 넓고 안쪽 여백 없음) */
  className?: string
  /** false 면 배경 클릭 · Esc · × 로 닫히지 않음 (예: 탈퇴 완료 안내) */
  dismissible?: boolean
  /** 오른쪽 위 × 버튼 숨기기 (창 안에 자체 닫기 버튼이 있을 때) */
  hideClose?: boolean
}

/** 배경 클릭 · Esc · × 로 닫히는 모달. PC 시작 화면의 로그인 모달, AI 대화 모달 등에 씁니다. */
export function Modal({ open, onClose, title, children, className, dismissible = true, hideClose }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(() => onClose())

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openDialogs.push(dialog)
    const isTop = () => openDialogs.at(-1) === dialog
    const focusFirst = () => (focusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (dismissible) {
          e.preventDefault()
          close()
        }
      } else if (e.key === 'Tab') {
        const elements = focusableElements(dialog)
        const index = elements.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        if (!elements.length) dialog.focus({ preventScroll: true })
        else elements[index < 0 ? (e.shiftKey ? elements.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + elements.length) % elements.length].focus({ preventScroll: true })
      }
    }
    const onFocus = (e: FocusEvent) => {
      if (isTop() && !dialog.contains(e.target as Node)) focusFirst()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    focusFirst()
    return () => {
      const wasTop = isTop()
      openDialogs.splice(openDialogs.indexOf(dialog), 1)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      if (wasTop && opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, dismissible])

  if (!open) return null

  return createPortal(
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={dismissible ? onClose : undefined} />
      <div ref={dialogRef} tabIndex={-1} className={cx(styles.dialog, className)} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {dismissible && !hideClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

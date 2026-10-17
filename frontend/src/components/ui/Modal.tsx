import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  /** 스크린리더용 제목 (화면에 안 보여도 꼭 넣기) */
  title: string
  children: ReactNode
}

/** 배경 클릭 · Esc · × 로 닫히는 모달. PC 시작 화면의 로그인 모달, AI 대화 모달 등에 씁니다. */
export function Modal({ open, onClose, title, children }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

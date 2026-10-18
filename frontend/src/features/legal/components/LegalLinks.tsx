import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import styles from './Legal.module.css'

/** 이용약관 · 개인정보 처리방침 링크 한 줄 (처리방침은 법에 따라 눈에 띄게 굵게) */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={cx(styles.links, className)}>
      <Link to="/terms">이용약관</Link>
      <Link to="/privacy">개인정보 처리방침</Link>
    </p>
  )
}

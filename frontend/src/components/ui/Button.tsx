import type { ComponentProps } from 'react'
import { cx } from '@/lib/cx'
import styles from './Button.module.css'

type Props = ComponentProps<'button'> & {
  variant?: 'primary' | 'line' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  /** 가로로 꽉 차게 */
  block?: boolean
  /** 요청 중: 눌리지 않고 글자 대신 "처리 중…" 표시 */
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, loading, disabled, className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? '처리 중…' : children}
    </button>
  )
}

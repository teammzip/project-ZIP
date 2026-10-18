import { cx } from '@/lib/cx'
import styles from './Segmented.module.css'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  /** 스크린리더용 이름 */
  label: string
}

/** 회색 바탕 안의 작은 토글 버튼 묶음 (예: 선택한 날 | 전체, 우리 동네 | 주변 | 전체) */
export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx(o.value === value && styles.on)}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

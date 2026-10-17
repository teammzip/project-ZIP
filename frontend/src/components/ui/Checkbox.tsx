import { useId, type ComponentProps, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Field.module.css'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label: ReactNode
  error?: string
}

export function Checkbox({ label, error, id, className, ...inputProps }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const msgId = `${inputId}-msg`

  return (
    <div className={className}>
      <label className={styles.check} htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? msgId : undefined}
          {...inputProps}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={msgId} className={cx(styles.error, styles.checkError)}>
          {error}
        </p>
      )}
    </div>
  )
}

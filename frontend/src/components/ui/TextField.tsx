import { useId, type ComponentProps, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Field.module.css'

type Props = ComponentProps<'input'> & {
  label: string
  /** 입력 아래 빨간 안내 문구 */
  error?: string
  /** 입력 아래 회색 도움말 (에러가 있으면 에러가 대신 보임) */
  hint?: string
  /** 입력칸 오른쪽 안에 넣을 요소 (예: 비밀번호 보기 버튼) */
  suffix?: ReactNode
}

/* react-hook-form 의 {...register('email')} 를 그대로 펼쳐 넣을 수 있습니다. (React 19 는 ref 도 일반 prop) */
export function TextField({ label, error, hint, suffix, id, className, ...inputProps }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const msgId = `${inputId}-msg`
  const message = error ?? hint

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={inputId}
          className={cx(styles.input, error && styles.invalid, suffix != null && styles.withSuffix)}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? msgId : undefined}
          {...inputProps}
        />
        {suffix != null && <div className={styles.suffix}>{suffix}</div>}
      </div>
      {message && (
        <p id={msgId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  )
}

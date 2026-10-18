import { useState, type ComponentProps } from 'react'
import { TextField } from './TextField'
import styles from './Field.module.css'

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'suffix'>

/** 비밀번호 입력 + "보기/숨기기" 버튼 */
export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          className={styles.suffixButton}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
          aria-pressed={visible}
        >
          {visible ? '숨기기' : '보기'}
        </button>
      }
    />
  )
}

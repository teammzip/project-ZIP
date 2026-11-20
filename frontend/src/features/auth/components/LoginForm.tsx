import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { useLogin } from '../hooks/useAuthMutations'
import { loginSchema } from '../schema'
import { EyeButton, Row } from './AccountFields'
import accountStyles from './Account.module.css'
import styles from './AuthForm.module.css'

type Props = {
  /** 로그인 성공 후 할 일 (페이지 이동 등은 쓰는 쪽이 정함) */
  onSuccess?: () => void
}

/* 로그인 페이지(/login)의 폼 (아이디 또는 이메일로 로그인). 입력칸은 회원가입과 같은 둥근 상자 */
export function LoginForm({ onSuccess }: Props) {
  const login = useLogin()
  const [showPw, setShowPw] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values, { onSuccess }))

  return (
    <form className={accountStyles.form} onSubmit={onSubmit} noValidate>
      <Row id="login-id" label="아이디 또는 이메일" hint={errors.loginId?.message}>
        <input id="login-id" placeholder="아이디 또는 you@example.com" autoComplete="username" autoCapitalize="none" autoFocus {...register('loginId')} />
      </Row>
      <Row id="login-pw" label="비밀번호" hint={errors.password?.message}>
        <input id="login-pw" type={showPw ? 'text' : 'password'} placeholder="비밀번호" autoComplete="current-password" {...register('password')} />
        <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} label="비밀번호" />
      </Row>

      <div className={cx(styles.row, styles.options)}>
        <Checkbox label="로그인 유지" {...register('remember')} />
        <span className={styles.findLinks}>
          <Link to="/find#id">아이디 찾기</Link>
          <i aria-hidden="true">/</i>
          <Link to="/find#pw">비밀번호 찾기</Link>
        </span>
      </div>

      {login.isError && (
        <p className={cx(styles.serverError, styles.loginError)} role="alert">
          {getErrorMessage(login.error)}
        </p>
      )}

      <button type="submit" className={cx(accountStyles.submit, accountStyles.submitOn)} disabled={login.isPending}>
        {login.isPending ? '로그인하는 중…' : '로그인'}
      </button>
    </form>
  )
}

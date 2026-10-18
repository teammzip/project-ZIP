import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button, Checkbox, PasswordField, TextField } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { useLogin } from '../hooks/useAuthMutations'
import { loginSchema } from '../schema'
import styles from './AuthForm.module.css'

type Props = {
  /** 로그인 성공 후 할 일 (페이지 이동, 모달 닫기 등은 쓰는 쪽이 정함) */
  onSuccess?: () => void
}

/* 로그인 페이지와 시작 화면의 로그인 모달에서 똑같이 쓰는 폼 (아이디 또는 이메일로 로그인) */
export function LoginForm({ onSuccess }: Props) {
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values, { onSuccess }))

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        label="아이디 또는 이메일"
        placeholder="아이디 또는 you@example.com"
        autoComplete="username"
        autoCapitalize="none"
        error={errors.loginId?.message}
        {...register('loginId')}
      />
      <PasswordField
        label="비밀번호"
        placeholder="비밀번호"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className={styles.row}>
        <Checkbox label="로그인 유지" {...register('remember')} />
        <span className={styles.findLinks}>
          <Link to="/find#id">아이디 찾기</Link>
          <i aria-hidden="true">/</i>
          <Link to="/find#pw">비밀번호 찾기</Link>
        </span>
      </div>

      {login.isError && (
        <p className={styles.serverError} role="alert">
          {getErrorMessage(login.error)}
        </p>
      )}

      <Button type="submit" size="lg" block loading={login.isPending}>
        로그인
      </Button>
    </form>
  )
}

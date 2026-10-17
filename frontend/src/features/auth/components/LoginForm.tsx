import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Checkbox, PasswordField, TextField } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { useLogin } from '../hooks/useAuthMutations'
import { loginSchema } from '../schema'
import styles from './AuthForm.module.css'

type Props = {
  /** 로그인 성공 후 할 일 (페이지 이동, 모달 닫기 등은 쓰는 쪽이 정함) */
  onSuccess?: () => void
}

/* 로그인 페이지와 PC 시작 화면의 로그인 모달에서 똑같이 쓰는 폼 */
export function LoginForm({ onSuccess }: Props) {
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values, { onSuccess }))

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        label="이메일"
        type="email"
        placeholder="you@example.com"
        autoComplete="username"
        error={errors.email?.message}
        {...register('email')}
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
        {/* TODO: 비밀번호 찾기 화면 (백엔드 메일 발송 API 필요) */}
        <button type="button" className={styles.textLink} disabled title="준비 중">
          비밀번호 찾기
        </button>
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

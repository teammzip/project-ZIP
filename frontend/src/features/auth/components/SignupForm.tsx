import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button, Checkbox, PasswordField, TextField } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { useSignup } from '../hooks/useAuthMutations'
import { signupSchema } from '../schema'
import styles from './AuthForm.module.css'

type Props = {
  /** 가입 성공 후 할 일 (가입하면 바로 로그인 상태가 됨) */
  onSuccess?: () => void
}

export function SignupForm({ onSuccess }: Props) {
  const signup = useSignup()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { nickname: '', email: '', password: '', passwordConfirm: '', address: '', agreeTerms: false },
  })

  const onSubmit = handleSubmit((values) => signup.mutate(values, { onSuccess }))

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        label="닉네임"
        placeholder="예: 지기"
        autoComplete="nickname"
        maxLength={12}
        error={errors.nickname?.message}
        {...register('nickname')}
      />
      <TextField
        label="이메일"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label="비밀번호"
        placeholder="영문·숫자 포함 8자 이상"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        label="비밀번호 확인"
        placeholder="비밀번호를 한 번 더 입력"
        autoComplete="new-password"
        error={errors.passwordConfirm?.message}
        {...register('passwordConfirm')}
      />
      {/* TODO: 주소 검색(다음 우편번호 API 등) 붙이기. 동네 기능·쓰레기 배출 요일이 이 주소를 씀 */}
      <TextField
        label="주소"
        placeholder="예: 서울시 마포구 합정동 123-4"
        autoComplete="street-address"
        error={errors.address?.message}
        {...register('address')}
      />

      <div className={styles.terms}>
        <p className={styles.termsText}>
          [약관] ZIP 서비스 이용을 위해 이메일·주소 등 최소한의 개인정보를 수집·이용하며, 탈퇴 시 즉시 삭제합니다.
        </p>
        <Checkbox
          label={<><b>[필수]</b> 위 약관에 동의합니다</>}
          error={errors.agreeTerms?.message}
          {...register('agreeTerms')}
        />
      </div>

      {signup.isError && (
        <p className={styles.serverError} role="alert">
          {getErrorMessage(signup.error)}
        </p>
      )}

      <Button type="submit" size="lg" block loading={signup.isPending}>
        가입하고 시작하기
      </Button>
    </form>
  )
}

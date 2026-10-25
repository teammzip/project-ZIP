import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import common from '@/styles/common.module.css'
import { demoAccount } from '../api'
import { useChangePassword } from '../hooks/useAuthMutations'
import { changePasswordSchema } from '../schema'
import { useAuthStore } from '../store/authStore'

/** 내 정보의 비밀번호 변경: 현재 비밀번호 확인 → 새 비밀번호 두 번.
 * 소셜 로그인으로 가입한 사람은 비밀번호가 없어서 아무것도 그리지 않음 */
export function PasswordChangeForm() {
  const provider = useAuthStore((s) => s.user?.provider)
  const change = useChangePassword()
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirm: '' },
  })

  if (provider && provider !== 'email') return null

  const onSubmit = handleSubmit((v) => {
    setDone(false)
    change.mutate(
      { currentPassword: v.currentPassword, newPassword: v.password },
      {
        onSuccess: () => {
          reset()
          setShow(false)
          setDone(true)
          setTimeout(() => setDone(false), 3000)
        },
      },
    )
  })
  const type = show ? 'text' : 'password'
  const firstError = errors.currentPassword?.message ?? errors.password?.message ?? errors.passwordConfirm?.message

  return (
    <form className={common.form} onSubmit={onSubmit} noValidate>
      <label>
        현재 비밀번호
        <input type={type} autoComplete="current-password" {...register('currentPassword')} />
      </label>
      <label>
        새 비밀번호
        <input type={type} maxLength={16} placeholder="8~16자 / 문자, 숫자, 특수 문자 모두 혼용" autoComplete="new-password" {...register('password')} />
      </label>
      <label>
        새 비밀번호 확인
        <input type={type} maxLength={16} placeholder="새 비밀번호를 한 번 더 입력" autoComplete="new-password" {...register('passwordConfirm')} />
      </label>
      <label className={common.check}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> 비밀번호 보기
      </label>
      {demoAccount && <p className={common.note}>가짜 API 모드: 데모 계정의 처음 비밀번호는 {demoAccount.password} 예요.</p>}
      <p className={firstError || change.isError ? common.formError : common.saved} role="status">
        {firstError ?? (change.isError ? getErrorMessage(change.error) : done ? '비밀번호를 바꿨어요.' : '')}
      </p>
      <Button type="submit" block loading={change.isPending}>
        비밀번호 변경
      </Button>
    </form>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ConsentFields } from '@/features/legal'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { useSignup } from '../hooks/useAuthMutations'
import { signupSchema } from '../schema'
import { EyeButton, PhoneVerify, Row } from './AccountFields'
import styles from './Account.module.css'

type Props = {
  /** 가입 성공 후 할 일 (가입하면 바로 로그인 상태가 됨) */
  onSuccess?: () => void
}

/** 회원가입 (팀 시안 variants/account/signup.html 과 같은 구성)
 * 로그인 정보(아이디·비밀번호) · 회원 정보(닉네임·휴대전화 인증·이메일·주소) · 가입 약관 동의.
 * 필수 항목을 모두 채우고 약관에 동의하면 "가입하기"가 파랗게 켜짐 */
export function SignupForm({ onSuccess }: Props) {
  const signup = useSignup()
  const [showPw, setShowPw] = useState({ pw: false, pw2: false })

  const { register, handleSubmit, control, setValue, formState: { errors, isValid, touchedFields, isSubmitted } } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: {
      username: '', password: '', passwordConfirm: '', nickname: '', phone: '', phoneToken: '', email: '', address: '',
      agreeTerms: false, agreePrivacy: false, agreePolicy: false, ageOver14: false,
    },
  })
  const [agreeTerms, agreePrivacy, agreePolicy, ageOver14, phoneValue, phoneToken] = useWatch({
    control,
    name: ['agreeTerms', 'agreePrivacy', 'agreePolicy', 'ageOver14', 'phone', 'phoneToken'],
  })

  /** 칸을 건드렸거나 한 번 제출한 뒤에만 오류를 보여 줌 */
  const err = (name: keyof typeof touchedFields) => (touchedFields[name] || isSubmitted ? errors[name]?.message : undefined)

  const onSubmit = handleSubmit((v) => signup.mutate(v, { onSuccess }))

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h2 className={styles.secTitle}>로그인 정보</h2>
      <Row id="su-id" label="아이디" hint={err('username')}>
        <input id="su-id" maxLength={16} placeholder="6~16자 / 영문 소문자, 숫자 사용 가능" autoComplete="username" autoCapitalize="none" {...register('username')} />
      </Row>
      <Row id="su-pw" label="비밀번호" hint={err('password')}>
        <input id="su-pw" type={showPw.pw ? 'text' : 'password'} maxLength={16} placeholder="8~16자 / 문자, 숫자, 특수 문자 모두 혼용" autoComplete="new-password" {...register('password')} />
        <EyeButton on={showPw.pw} onClick={() => setShowPw({ ...showPw, pw: !showPw.pw })} label="비밀번호" />
      </Row>
      <Row id="su-pw2" label="비밀번호 확인" hint={err('passwordConfirm')}>
        <input id="su-pw2" type={showPw.pw2 ? 'text' : 'password'} maxLength={16} placeholder="비밀번호를 다시 입력해 주세요" autoComplete="new-password" {...register('passwordConfirm')} />
        <EyeButton on={showPw.pw2} onClick={() => setShowPw({ ...showPw, pw2: !showPw.pw2 })} label="비밀번호 확인" />
      </Row>

      <h2 className={styles.secTitle}>회원 정보</h2>
      <Row id="su-nick" label="닉네임" hint={err('nickname')}>
        <input id="su-nick" maxLength={12} placeholder="앱에서 보여줄 이름 (2~12자)" autoComplete="nickname" {...register('nickname')} />
      </Row>
      <PhoneVerify
        id="su-phone"
        purpose="SIGNUP"
        phone={phoneValue}
        onPhoneChange={(v) => setValue('phone', v, { shouldValidate: !!touchedFields.phone || isSubmitted, shouldTouch: true })}
        token={phoneToken}
        onToken={(t) => setValue('phoneToken', t, { shouldValidate: true })}
        error={err('phone') ?? (isSubmitted ? errors.phoneToken?.message : undefined)}
      />
      <Row id="su-email" label="이메일" hint={err('email')}>
        <input id="su-email" type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
      </Row>
      {/* TODO: 주소 검색(다음 우편번호 API 등) 붙이기. 동네 기능·쓰레기 배출 요일이 이 주소를 씀 */}
      <Row id="su-addr" label="주소" hint={err('address')}>
        <input id="su-addr" placeholder="예: 서울시 마포구 합정동 123-4" autoComplete="street-address" {...register('address')} />
      </Row>

      <h2 className={styles.secTitle}>가입 약관 동의</h2>
      <ConsentFields
        value={{ terms: agreeTerms, privacy: agreePrivacy, policy: agreePolicy, age: ageOver14 }}
        onChange={(c) => {
          const opts = { shouldValidate: true }
          setValue('agreeTerms', c.terms, opts)
          setValue('agreePrivacy', c.privacy, opts)
          setValue('agreePolicy', c.policy, opts)
          setValue('ageOver14', c.age, opts)
        }}
        errors={
          isSubmitted
            ? { terms: errors.agreeTerms?.message, privacy: errors.agreePrivacy?.message, policy: errors.agreePolicy?.message, age: errors.ageOver14?.message }
            : {}
        }
      />

      <p className={styles.error} role="alert">
        {signup.isError ? getErrorMessage(signup.error) : ''}
      </p>
      <button type="submit" className={cx(styles.submit, isValid && styles.submitOn)} disabled={signup.isPending}>
        {signup.isPending ? '가입하는 중…' : '가입하기'}
      </button>
    </form>
  )
}

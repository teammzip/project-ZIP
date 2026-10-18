import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ConsentFields } from '@/features/legal'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { usePhoneVerification, useSignup } from '../hooks/useAuthMutations'
import { signupSchema } from '../schema'
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
  const phone = usePhoneVerification()
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [showPw, setShowPw] = useState({ pw: false, pw2: false })

  const { register, handleSubmit, control, setValue, trigger, formState: { errors, isValid, touchedFields, isSubmitted } } = useForm({
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
  const verified = !!phoneToken

  /** 칸을 건드렸거나 한 번 제출한 뒤에만 오류를 보여 줌 */
  const err = (name: keyof typeof touchedFields) => (touchedFields[name] || isSubmitted ? errors[name]?.message : undefined)

  const sendCode = () => {
    if (!/^\d{4}-\d{4}$/.test(phoneValue)) {
      trigger('phone')
      return
    }
    phone.send.mutate(`010-${phoneValue}`, { onSuccess: () => setCodeSent(true) })
  }
  const verifyCode = () =>
    phone.verify.mutate(
      { phone: `010-${phoneValue}`, code },
      {
        onSuccess: ({ verificationToken }) => {
          setValue('phoneToken', verificationToken, { shouldValidate: true })
          setCodeSent(false)
        },
      },
    )

  const phoneHint = verified
    ? { ok: true, text: '휴대전화 인증이 완료됐어요.' }
    : phone.verify.isError
      ? { ok: false, text: getErrorMessage(phone.verify.error) }
      : codeSent
        ? { ok: true, text: '인증번호를 보냈어요. (시안이라 아무 6자리나 입력하면 돼요)' }
        : { ok: false, text: err('phone') ?? (isSubmitted ? errors.phoneToken?.message : undefined) }

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
      <Row id="su-phone" label="휴대전화" hint={codeSent ? undefined : phoneHint.text} ok={phoneHint.ok}>
        <span className={styles.prefix}>010 -</span>
        <input
          id="su-phone"
          inputMode="numeric"
          maxLength={9}
          placeholder="0000-0000"
          autoComplete="tel-national"
          readOnly={verified}
          {...register('phone', {
            // 숫자만 받고 0000-0000 모양으로 맞춤
            onChange: (e) => {
              const d = String(e.target.value).replace(/\D/g, '').slice(0, 8)
              setValue('phone', d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d)
            },
          })}
        />
        <button type="button" className={cx(styles.lineBtn, verified && styles.done)} onClick={sendCode} disabled={verified || phone.send.isPending}>
          {verified ? '인증완료' : codeSent ? '다시 보내기' : '인증(필수)'}
        </button>
      </Row>
      {codeSent && !verified && (
        <Row id="su-code" label="인증번호" sub hint={phoneHint.text} ok={phoneHint.ok}>
          <input id="su-code" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리 (시안용: 아무 6자리)" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          <button type="button" className={styles.lineBtn} onClick={verifyCode} disabled={phone.verify.isPending}>
            확인
          </button>
        </Row>
      )}
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

type RowProps = { id: string; label: string; hint?: string; ok?: boolean; sub?: boolean; children: ReactNode }

/** 한 줄: 왼쪽 라벨 + 오른쪽 밑줄 입력, 아래에 안내·오류 한 줄 */
export function Row({ id, label, hint, ok, sub, children }: RowProps) {
  return (
    <>
      <div className={cx(styles.row, sub && styles.rowSub)}>
        <label htmlFor={id}>{label}</label>
        <div className={styles.cell}>{children}</div>
      </div>
      {hint && (
        <p className={cx(styles.hint, ok && styles.hintOk)} role={ok ? 'status' : 'alert'}>
          {hint}
        </p>
      )}
    </>
  )
}

function EyeButton({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" className={cx(styles.eye, on && styles.eyeOn)} onClick={onClick} aria-label={on ? `${label} 숨기기` : `${label} 보기`} aria-pressed={on} />
}

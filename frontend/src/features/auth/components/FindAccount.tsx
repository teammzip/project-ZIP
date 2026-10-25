import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { demoAccount } from '../api'
import { useFindId, usePasswordReset } from '../hooks/useAuthMutations'
import { newPasswordSchema } from '../schema'
import { EyeButton, PhoneVerify, Row } from './AccountFields'
import styles from './Account.module.css'

type Tab = 'id' | 'pw'

/** 아이디 찾기 · 비밀번호 찾기. 주소 끝 #id / #pw 로 탭이 정해짐
 * - 아이디 찾기: 닉네임 + 휴대전화 인증 → 아이디를 그대로 보여 줌
 * - 비밀번호 찾기: 아이디 + 휴대전화 인증 → 같은 화면에서 바로 새 비밀번호로 재설정 (메일 없음) */
export function FindAccount() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const tab: Tab = hash === '#pw' ? 'pw' : 'id'
  const go = (t: Tab) => navigate({ hash: t }, { replace: true })

  return (
    <>
      <nav className={styles.tabs} role="tablist" aria-label="계정 찾기">
        {(['id', 'pw'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => go(t)}>
            {t === 'id' ? '아이디 찾기' : '비밀번호 찾기'}
          </button>
        ))}
      </nav>
      {/* key: 탭을 바꾸면 입력·인증 상태를 처음부터 */}
      {tab === 'id' ? <FindId key="id" onSwitch={() => go('pw')} /> : <ResetPassword key="pw" onSwitch={() => go('id')} />}
      <p className={styles.foot}>
        아직 계정이 없나요? <Link to="/signup">회원가입</Link>
      </p>
    </>
  )
}

/** 가짜 API 모드에서만: 시험해 볼 정보 안내 */
function DemoGuide({ kind }: { kind: Tab }) {
  if (!demoAccount) return null
  return (
    <p className={styles.demoGuide}>
      체험용: {kind === 'id' ? `닉네임 "${demoAccount.nickname}"` : `아이디 "${demoAccount.username}"`}, 휴대전화 {demoAccount.phone}
      {kind === 'id' ? ' 로 찾아볼 수 있어요.' : ' 로 재설정해 볼 수 있어요.'}
    </p>
  )
}

function FindId({ onSwitch }: { onSwitch: () => void }) {
  const find = useFindId()
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nickname.trim()) return setError('가입할 때 쓴 닉네임을 입력해 주세요.')
    if (!token) return setError('휴대전화 인증을 해 주세요.')
    find.mutate(
      { nickname: nickname.trim(), phone: `010-${phone}`, phoneVerificationToken: token },
      { onError: () => setToken('') }, // 계정이 안 맞으면 번호를 고쳐 다시 인증할 수 있게
    )
  }

  return (
    <section role="tabpanel" aria-label="아이디 찾기">
      <h1 className={styles.h1}>아이디 찾기</h1>
      <p className={styles.lead}>가입할 때 쓴 닉네임과 휴대전화로 본인 확인을 하면 아이디를 알려드려요.</p>
      {find.isSuccess ? (
        <>
          <div className={styles.result} role="status">
            가입한 아이디는 <b>{find.data.username}</b> 이에요.
          </div>
          <Link to="/start#login" className={cx(styles.submit, styles.submitOn, styles.linkBtn)}>
            로그인하러 가기
          </Link>
        </>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Row id="f-nick" label="닉네임">
            <input id="f-nick" placeholder="가입할 때 쓴 닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Row>
          <PhoneVerify id="f-phone" purpose="FIND_ID" phone={phone} onPhoneChange={setPhone} token={token} onToken={setToken} />
          <DemoGuide kind="id" />
          <p className={styles.error} role="alert">
            {error || (find.isError ? getErrorMessage(find.error) : '')}
          </p>
          <button type="submit" className={cx(styles.submit, styles.submitOn)} disabled={find.isPending}>
            {find.isPending ? '찾는 중…' : '아이디 찾기'}
          </button>
        </form>
      )}
      <p className={styles.foot}>
        <button type="button" onClick={onSwitch}>
          비밀번호도 잊으셨나요?
        </button>{' '}
        · <Link to="/start#login">로그인하러 가기</Link>
      </p>
    </section>
  )
}

function ResetPassword({ onSwitch }: { onSwitch: () => void }) {
  const { verify, reset } = usePasswordReset()
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const resetToken = verify.data?.resetToken

  // 1단계: 아이디 + 휴대전화 인증
  const submitVerify = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) return setError('아이디를 입력해 주세요.')
    if (!token) return setError('휴대전화 인증을 해 주세요.')
    verify.mutate({ username: username.trim(), phone: `010-${phone}`, phoneVerificationToken: token }, { onError: () => setToken('') })
  }

  return (
    <section role="tabpanel" aria-label="비밀번호 찾기">
      <h1 className={styles.h1}>비밀번호 찾기</h1>
      {reset.isSuccess ? (
        <>
          <div className={styles.result} role="status">
            비밀번호를 새로 정했어요. 새 비밀번호로 로그인해 주세요.
          </div>
          <Link to="/start#login" className={cx(styles.submit, styles.submitOn, styles.linkBtn)}>
            로그인하러 가기
          </Link>
        </>
      ) : resetToken ? (
        <NewPasswordForm resetToken={resetToken} reset={reset} />
      ) : (
        <>
          <p className={styles.lead}>아이디와 휴대전화로 본인 확인을 하면 바로 새 비밀번호를 정할 수 있어요.</p>
          <form className={styles.form} onSubmit={submitVerify} noValidate>
            <Row id="p-id" label="아이디">
              <input id="p-id" placeholder="가입한 아이디" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Row>
            <PhoneVerify id="p-phone" purpose="RESET_PASSWORD" phone={phone} onPhoneChange={setPhone} token={token} onToken={setToken} />
            <DemoGuide kind="pw" />
            <p className={styles.error} role="alert">
              {error || (verify.isError ? getErrorMessage(verify.error) : '')}
            </p>
            <button type="submit" className={cx(styles.submit, styles.submitOn)} disabled={verify.isPending}>
              {verify.isPending ? '확인하는 중…' : '본인 확인'}
            </button>
          </form>
        </>
      )}
      <p className={styles.foot}>
        <button type="button" onClick={onSwitch}>
          아이디를 잊으셨나요?
        </button>{' '}
        · <Link to="/start#login">로그인하러 가기</Link>
      </p>
    </section>
  )
}

/** 비밀번호 찾기 2단계: 새 비밀번호 두 번 입력 */
function NewPasswordForm({ resetToken, reset }: { resetToken: string; reset: ReturnType<typeof usePasswordReset>['reset'] }) {
  const [show, setShow] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', passwordConfirm: '' } })

  return (
    <>
      <p className={styles.lead}>본인 확인이 끝났어요. 새 비밀번호를 정해 주세요.</p>
      <form className={styles.form} onSubmit={handleSubmit((v) => reset.mutate({ resetToken, newPassword: v.password }))} noValidate>
        <Row id="r-pw" label="새 비밀번호" hint={errors.password?.message}>
          <input id="r-pw" type={show ? 'text' : 'password'} maxLength={16} placeholder="8~16자 / 문자, 숫자, 특수 문자 모두 혼용" autoComplete="new-password" autoFocus {...register('password')} />
          <EyeButton on={show} onClick={() => setShow((v) => !v)} label="새 비밀번호" />
        </Row>
        <Row id="r-pw2" label="새 비밀번호 확인" hint={errors.passwordConfirm?.message}>
          <input id="r-pw2" type={show ? 'text' : 'password'} maxLength={16} placeholder="새 비밀번호를 다시 입력해 주세요" autoComplete="new-password" {...register('passwordConfirm')} />
        </Row>
        <p className={styles.error} role="alert">
          {reset.isError ? getErrorMessage(reset.error) : ''}
        </p>
        <button type="submit" className={cx(styles.submit, styles.submitOn)} disabled={reset.isPending}>
          {reset.isPending ? '바꾸는 중…' : '비밀번호 재설정'}
        </button>
      </form>
    </>
  )
}

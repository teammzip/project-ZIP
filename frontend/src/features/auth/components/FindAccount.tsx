import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { useFindId, usePasswordReset } from '../hooks/useAuthMutations'
import { findIdSchema, passwordResetSchema } from '../schema'
import { Row } from './SignupForm'
import styles from './Account.module.css'

type Tab = 'id' | 'pw'

/** 아이디 찾기 · 비밀번호 찾기 (팀 시안 variants/account/find.html). 주소 끝 #id / #pw 로 탭이 정해짐 */
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
      {tab === 'id' ? <FindId onSwitch={() => go('pw')} /> : <ResetPassword onSwitch={() => go('id')} />}
      <p className={styles.foot}>
        아직 계정이 없나요? <Link to="/signup">회원가입</Link>
      </p>
    </>
  )
}

function FindId({ onSwitch }: { onSwitch: () => void }) {
  const find = useFindId()
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(findIdSchema), defaultValues: { nickname: '', address: '' } })
  const first = errors.nickname?.message ?? errors.address?.message

  return (
    <section role="tabpanel" aria-label="아이디 찾기">
      <h1 className={styles.h1}>아이디 찾기</h1>
      <p className={styles.lead}>가입할 때 쓴 닉네임과 주소를 입력하면 가입한 아이디를 알려드려요.</p>
      <form className={styles.form} onSubmit={handleSubmit((v) => find.mutate(v))} noValidate>
        <Row id="f-nick" label="닉네임">
          <input id="f-nick" placeholder="가입할 때 쓴 닉네임" {...register('nickname')} />
        </Row>
        <Row id="f-addr" label="주소">
          <input id="f-addr" placeholder="가입할 때 입력한 주소" {...register('address')} />
        </Row>
        <p className={styles.error} role="alert">
          {first ?? (find.isError ? getErrorMessage(find.error) : '')}
        </p>
        {find.isSuccess && (
          <div className={styles.result} role="status">
            가입한 아이디는 <b>{find.data.maskedUsername}</b> 이에요.
            <small>개인정보 보호를 위해 일부만 보여 드려요.</small>
          </div>
        )}
        <button type="submit" className={cx(styles.submit, styles.submitOn)} disabled={find.isPending}>
          {find.isPending ? '찾는 중…' : '아이디 찾기'}
        </button>
      </form>
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
  const reset = usePasswordReset()
  const { register, handleSubmit, getValues, formState: { errors } } = useForm({ resolver: zodResolver(passwordResetSchema), defaultValues: { username: '', email: '' } })
  const first = errors.username?.message ?? errors.email?.message

  return (
    <section role="tabpanel" aria-label="비밀번호 찾기">
      <h1 className={styles.h1}>비밀번호 찾기</h1>
      <p className={styles.lead}>아이디와 가입한 이메일을 입력하면 비밀번호를 다시 정하는 안내를 보내드려요.</p>
      <form className={styles.form} onSubmit={handleSubmit((v) => reset.mutate(v))} noValidate>
        <Row id="p-id" label="아이디">
          <input id="p-id" placeholder="가입한 아이디" autoCapitalize="none" {...register('username')} />
        </Row>
        <Row id="p-email" label="이메일">
          <input id="p-email" type="email" placeholder="가입할 때 입력한 이메일" {...register('email')} />
        </Row>
        <p className={styles.error} role="alert">
          {first ?? (reset.isError ? getErrorMessage(reset.error) : '')}
        </p>
        {reset.isSuccess && (
          <div className={styles.result} role="status">
            <b>{getValues('email')}</b> 으로 비밀번호 재설정 안내를 보냈어요.
            <small>가입한 정보와 맞으면 몇 분 안에 메일이 도착해요. (가짜 API 모드에서는 실제로 보내지 않아요)</small>
          </div>
        )}
        <button type="submit" className={cx(styles.submit, styles.submitOn)} disabled={reset.isPending}>
          {reset.isPending ? '보내는 중…' : '재설정 안내 받기'}
        </button>
      </form>
      <p className={styles.foot}>
        <button type="button" onClick={onSwitch}>
          아이디를 잊으셨나요?
        </button>{' '}
        · <Link to="/start#login">로그인하러 가기</Link>
      </p>
    </section>
  )
}

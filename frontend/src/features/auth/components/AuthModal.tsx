import logo from '@/assets/images/logo-zip.png'
import { Modal } from '@/components/ui'
import { demoAccount } from '../api'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { SocialLoginButtons } from './SocialLoginButtons'
import styles from './AuthModal.module.css'

export type AuthMode = 'login' | 'signup'

type Props = {
  /** null 이면 닫힘 */
  mode: AuthMode | null
  onModeChange: (mode: AuthMode | null) => void
  onSuccess: () => void
}

/** 로그인 ↔ 회원가입을 오가는 모달. 어느 화면에서든 mode 만 바꿔서 열면 됩니다. */
export function AuthModal({ mode, onModeChange, onSuccess }: Props) {
  const isSignup = mode === 'signup'

  return (
    <Modal open={mode !== null} onClose={() => onModeChange(null)} title={isSignup ? '회원가입' : '로그인'}>
      <img src={logo} alt="" className={styles.logo} />
      {isSignup ? <SignupForm onSuccess={onSuccess} /> : <LoginForm onSuccess={onSuccess} />}
      <SocialLoginButtons onSuccess={onSuccess} />
      <p className={styles.switch}>
        {isSignup ? '이미 계정이 있나요? ' : '아직 계정이 없나요? '}
        <button type="button" onClick={() => onModeChange(isSignup ? 'login' : 'signup')}>
          {isSignup ? '로그인' : '회원가입'}
        </button>
      </p>
      {demoAccount && !isSignup && (
        <p className={styles.demoNote}>
          데모 계정 {demoAccount.email} / {demoAccount.password}
        </p>
      )}
    </Modal>
  )
}

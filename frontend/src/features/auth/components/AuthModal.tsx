import { Link } from 'react-router-dom'
import logo from '@/assets/images/logo-zip.png'
import { Modal } from '@/components/ui'
import { demoAccount } from '../api'
import { LoginForm } from './LoginForm'
import { SocialLoginButtons } from './SocialLoginButtons'
import styles from './AuthModal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/** 시작 화면의 로그인 모달. 회원가입·아이디/비밀번호 찾기는 별도 페이지(/signup, /find)로 이동 (팀 시안과 같음) */
export function AuthModal({ open, onClose, onSuccess }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="로그인">
      <img src={logo} alt="" className={styles.logo} />
      <LoginForm onSuccess={onSuccess} />
      <SocialLoginButtons onSuccess={onSuccess} />
      <p className={styles.switch}>
        아직 계정이 없나요? <Link to="/signup">회원가입</Link>
      </p>
      {demoAccount && (
        <p className={styles.demoNote}>
          데모 계정 {demoAccount.username} (또는 {demoAccount.email}) / {demoAccount.password}
        </p>
      )}
    </Modal>
  )
}

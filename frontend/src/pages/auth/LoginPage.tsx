import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { demoAccount, LoginForm, SocialLoginButtons } from '@/features/auth'
import styles from './AuthPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = useRedirectAfterAuth()
  const done = () => navigate(redirectTo, { replace: true })

  return (
    <>
      <h1 className={styles.title}>다시 만나서 반가워요</h1>
      <LoginForm onSuccess={done} />
      <SocialLoginButtons onSuccess={done} />
      <p className={styles.switch}>
        아직 계정이 없나요?{' '}
        <Link to="/signup" state={location.state}>
          회원가입
        </Link>
      </p>
      {demoAccount && (
        <p className={styles.mockNote}>
          가짜 API 모드 · 데모 계정 {demoAccount.username} (또는 {demoAccount.email}) / {demoAccount.password}
        </p>
      )}
    </>
  )
}

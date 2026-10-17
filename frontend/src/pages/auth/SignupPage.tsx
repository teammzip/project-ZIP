import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { SignupForm, SocialLoginButtons } from '@/features/auth'
import styles from './AuthPage.module.css'

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = useRedirectAfterAuth()
  const done = () => navigate(redirectTo, { replace: true })

  return (
    <>
      <h1 className={styles.title}>어서와, ZIP은 처음이지?</h1>
      <SignupForm onSuccess={done} />
      <SocialLoginButtons onSuccess={done} />
      <p className={styles.switch}>
        이미 계정이 있나요?{' '}
        <Link to="/login" state={location.state}>
          로그인
        </Link>
      </p>
    </>
  )
}

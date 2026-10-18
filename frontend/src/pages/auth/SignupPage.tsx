import { Link, useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { SignupForm } from '@/features/auth'
import styles from './AccountPage.module.css'

/* 회원가입 전용 페이지 (시작 화면·로그인 창의 "회원가입"이 이리로 옴) */
export function SignupPage() {
  const navigate = useNavigate()
  const redirectTo = useRedirectAfterAuth()

  return (
    <>
      <h1 className={styles.title}>회원가입</h1>
      <SignupForm onSuccess={() => navigate(redirectTo, { replace: true })} />
      <p className={styles.foot}>
        계정을 잊으셨나요? <Link to="/find#id">아이디 찾기</Link> · <Link to="/find#pw">비밀번호 찾기</Link>
      </p>
    </>
  )
}

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { demoAccount, demoAdmin, LoginForm, SocialLoginButtons } from '@/features/auth'
import styles from './AccountPage.module.css'

/* 로그인 전용 페이지 (/login). 시작 화면의 "로그인" 버튼 · 가입/찾기 페이지의 "로그인" 이 모두 이리로 옴.
 * 틀은 회원가입과 같은 AccountLayout (PC 왼쪽 소개 + 오른쪽 카드). 로그인하면 원래 가려던 곳(state.from, 없으면 홈)으로 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = useRedirectAfterAuth()
  const done = () => navigate(redirectTo, { replace: true })

  return (
    <>
      <h1 className={styles.title}>다시 만나서 반가워요</h1>
      <p className={styles.lead}>아이디 또는 이메일로 로그인해 주세요.</p>
      <LoginForm onSuccess={done} />
      <SocialLoginButtons onSuccess={done} />
      <p className={styles.foot}>
        아직 계정이 없나요?{' '}
        <Link to="/signup" state={location.state}>
          회원가입
        </Link>
      </p>
      {demoAccount && (
        <p className={styles.mockNote}>
          가짜 API 모드 · 데모 계정 {demoAccount.username} (또는 {demoAccount.email}) / {demoAccount.password}
          {demoAdmin && ` · 관리자 ${demoAdmin.username} / ${demoAdmin.password}`}
        </p>
      )}
    </>
  )
}

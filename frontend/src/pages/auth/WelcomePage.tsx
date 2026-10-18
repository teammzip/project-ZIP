import { ConsentOnboarding } from '@/features/auth'
import styles from './AuthPage.module.css'

/* 소셜 로그인 첫 가입: 약관 동의 + 주소 (동의하기 전에는 앱의 다른 화면으로 못 감) */
export function WelcomePage() {
  return (
    <>
      <h1 className={styles.title}>시작하기 전에 확인해 주세요</h1>
      <ConsentOnboarding />
    </>
  )
}

import { ConsentOnboarding } from '@/features/auth'
import styles from './AuthPage.module.css'

/* 소셜 로그인 첫 가입: 약관 동의 (동의하기 전에는 앱의 다른 화면으로 못 감). 주소는 이어지는 주거 설문에서 */
export function WelcomePage() {
  return (
    <>
      <h1 className={styles.title}>시작하기 전에 확인해 주세요</h1>
      <ConsentOnboarding />
    </>
  )
}

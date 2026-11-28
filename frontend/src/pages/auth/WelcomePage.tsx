import { ConsentOnboarding } from '@/features/auth'
import styles from './AccountPage.module.css'

/* 소셜 로그인 첫 가입: 약관 동의 (동의하기 전에는 앱의 다른 화면으로 못 감). 주소는 이어지는 주거 설문에서.
 * 회원가입 · 찾기와 같은 틀(AccountLayout)과 제목 모양을 씀 */
export function WelcomePage() {
  return (
    <>
      <h1 className={styles.title}>시작하기 전에 확인해 주세요</h1>
      <p className={styles.lead}>소셜 계정으로 처음 오셨네요. 약관에 동의하면 바로 시작할 수 있어요.</p>
      <ConsentOnboarding />
    </>
  )
}

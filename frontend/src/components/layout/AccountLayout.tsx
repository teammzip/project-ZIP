import { Link, Outlet } from 'react-router-dom'
import logo from '@/assets/images/logo-zip.png'
import { LegalLinks } from '@/features/legal'
import styles from './AccountLayout.module.css'

/** 회원가입 · 아이디/비밀번호 찾기 페이지의 틀 (팀 시안 variants/account)
 * PC: 하늘색 바탕 + 위쪽 로고·로그인 줄 + 흰 카드 / 모바일(900px 이하): 흰 카드만 화면 가득 */
export function AccountLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to="/start" aria-label="ZIP 시작 화면으로">
          <img src={logo} alt="ZIP" />
        </Link>
        <Link to="/start#login" className={styles.toLogin}>
          이미 계정이 있나요? 로그인
        </Link>
      </header>
      <main className={styles.card}>
        <Outlet />
        <p className={styles.mOnly}>
          이미 계정이 있나요? <Link to="/start#login">로그인</Link>
        </p>
        <LegalLinks className={styles.legal} />
      </main>
    </div>
  )
}

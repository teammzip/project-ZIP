import { Link, Outlet } from 'react-router-dom'
import logo from '@/assets/images/logo-zip.png'
import styles from './AuthLayout.module.css'

/** 로그인·회원가입 화면의 틀: 가운데 카드 하나 */
export function AuthLayout() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/start" className={styles.logo} aria-label="ZIP 시작 화면으로">
          <img src={logo} alt="ZIP" />
        </Link>
        <Outlet />
      </div>
    </div>
  )
}

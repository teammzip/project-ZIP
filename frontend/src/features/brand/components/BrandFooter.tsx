import logo from '@/assets/images/logo-zip.png'
import styles from './BrandFooter.module.css'

export function BrandFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <img src={logo} alt="ZIP" className={styles.logo} />
        <p>자취생 생활 도우미 ZIP</p>
        <p>Team ZIP · 프론트엔드 · 백엔드 · 풀스택</p>
        {/* TODO: 이용약관 · 개인정보 처리방침 페이지가 생기면 링크 연결 */}
        <p className={styles.links}>
          <span>이용약관</span>
          <span>개인정보 처리방침</span>
        </p>
        <p className={styles.copy}>© 2026 Team ZIP</p>
      </div>
    </footer>
  )
}

import logo from '@/assets/images/logo-zip.png'
import { LegalLinks } from '@/features/legal'
import styles from './BrandFooter.module.css'

export function BrandFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <img src={logo} alt="ZIP" className={styles.logo} />
        <p>자취생 생활 도우미 ZIP</p>
        <p>Team ZIP · 프론트엔드 · 백엔드 · 풀스택</p>
        <LegalLinks className={styles.links} />
        <p className={styles.copy}>© 2026 Team ZIP</p>
      </div>
    </footer>
  )
}

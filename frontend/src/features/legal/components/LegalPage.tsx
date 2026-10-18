import { NavLink, useNavigate } from 'react-router-dom'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import type { LegalDoc } from '../content'
import { LegalDocView } from './LegalDocView'
import styles from './Legal.module.css'

/** /terms, /privacy 화면: 로그인 전후 모두 볼 수 있음 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const navigate = useNavigate()
  return (
    <main className={styles.page}>
      <article className={styles.pageCard}>
        <div className={styles.pageHead}>
          <img src={logo} alt="ZIP" />
          <Button variant="line" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            ‹ 돌아가기
          </Button>
        </div>
        <nav className={styles.switch} aria-label="약관 및 정책">
          <NavLink to="/terms">이용약관</NavLink>
          <NavLink to="/privacy">개인정보 처리방침</NavLink>
        </nav>
        <h1 className={styles.pageTitle}>{doc.title}</h1>
        {/* TODO: 법률 검토를 마치고 [ ] 칸을 채우면 이 안내를 지우기 */}
        <p className={styles.draft}>⚠️ 출시 전 예시 문구입니다. 법률 검토 후 [ ] 로 표시한 운영 주체·연락처·위탁 업체를 채워야 합니다.</p>
        <LegalDocView doc={doc} />
      </article>
    </main>
  )
}

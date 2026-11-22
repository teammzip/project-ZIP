import { NavLink, useNavigate } from 'react-router-dom'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import { useLegalDoc, type LegalKind } from '../api'
import { LegalDocView } from './LegalDocView'
import styles from './Legal.module.css'

/** /terms, /privacy 화면: 로그인 전후 모두 볼 수 있음 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const navigate = useNavigate()
  // 서버의 지금 시행 중인 약관 (불러오는 중 · 실패면 화면에 있는 같은 문구)
  const doc = useLegalDoc(kind)
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
        {/* TODO: 법률 검토를 마치면 이 안내를 지우기 */}
        <p className={styles.draft}>⚠️ 출시 전 문구입니다. 법률 검토를 마친 뒤 확정해요.</p>
        <LegalDocView doc={doc} />
      </article>
    </main>
  )
}

import type { LegalDoc } from '../content'
import styles from './Legal.module.css'

/** 약관·처리방침 본문. 페이지(/terms, /privacy)와 가입 화면의 "전체 보기" 창이 같이 씀 */
export function LegalDocView({ doc, collapsible, compact }: { doc: LegalDoc; collapsible?: boolean; compact?: boolean }) {
  return (
    <div className={compact ? `${styles.doc} ${styles.compact}` : styles.doc}>
      <p className={styles.updated}>{doc.updated}</p>
      {doc.sections.map((s, i) =>
        collapsible ? (
          <details key={s.title} className={styles.section} open={i === 0}>
            <summary>{s.title}</summary>
            {s.body.map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </details>
        ) : (
          <section key={s.title} className={styles.section}>
            <h2>{s.title}</h2>
            {s.body.map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </section>
        ),
      )}
    </div>
  )
}

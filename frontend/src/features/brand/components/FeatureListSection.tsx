import { motion } from 'motion/react'
import { FEATURE_HEAD, FEATURES } from '../content'
import { SectionHead } from './SectionHead'
import styles from './FeatureListSection.module.css'

/** ZIP 이 하는 일: 큰 흰 판 위에 제목(왼쪽) · 설명(오른쪽), 아래로 01 ~ 06 번호 목록 (PC 2줄 · 모바일 1줄) */
export function FeatureListSection() {
  return (
    <section className={styles.section} id="features">
      <div className={styles.sheet}>
        <SectionHead {...FEATURE_HEAD} align="split" />
        <ol className={styles.list}>
          {FEATURES.map((f, i) => (
            <motion.li
              key={f.title}
              className={styles.item}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: (i % 2) * 0.08 }}
            >
              <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.icon} aria-hidden="true">
                {f.icon}
              </span>
              <div className={styles.text}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

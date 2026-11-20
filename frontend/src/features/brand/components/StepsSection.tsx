import { motion } from 'motion/react'
import robot from '@/assets/images/robot-cut.png'
import { STEPS, STEPS_HEAD } from '../content'
import { Bubble } from './Bubble'
import { SectionHead } from './SectionHead'
import styles from './StepsSection.module.css'

/** 시작 3단계: 왼쪽 로봇 + 말풍선, 오른쪽 제목과 01 · 02 · 03 줄 목록 (모바일은 위아래) */
export function StepsSection() {
  return (
    <section className={styles.section} id="steps">
      <div className={styles.inner}>
        <div className={styles.visual} aria-hidden="true">
          <img src={robot} alt="" className={styles.robot} />
          <Bubble text="처음 한 번만 알려 주세요" className={styles.bubble} />
        </div>
        <div className={styles.copy}>
          <SectionHead {...STEPS_HEAD} />
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                className={styles.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
              >
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

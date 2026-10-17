import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import robot from '@/assets/images/robot-cut.png'
import { Lines } from './SectionHead'
import { HERO } from '../content'
import styles from './HeroSection.module.css'

const ease = [0.22, 1, 0.36, 1] as const

/** 첫 화면: 큰 문구가 한 줄씩 올라오고, 내리면 로봇은 천천히 내려가며 문구는 흐려짐 */
export function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const robotY = useTransform(scrollYProgress, [0, 1], [0, 160])
  const robotScale = useTransform(scrollYProgress, [0, 1], [1, 0.85])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -60])

  return (
    <section ref={ref} id="top" className={styles.hero}>
      <motion.div className={styles.copy} style={{ opacity: copyOpacity, y: copyY }}>
        <motion.p className={styles.kicker} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          {HERO.kicker}
        </motion.p>
        <h1 className={styles.title}>
          {HERO.lines.map((line, i) => (
            <span key={line} className={styles.lineMask}>
              <motion.span
                className={styles.line}
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.12 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p className={styles.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }}>
          <Lines text={HERO.sub} />
        </motion.p>
      </motion.div>

      <motion.img
        src={robot}
        alt="ZIP 도우미 로봇"
        className={styles.robot}
        style={{ y: robotY, scale: robotScale }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease, delay: 0.3 }}
      />

      <motion.div className={styles.scrollHint} aria-hidden="true" style={{ opacity: copyOpacity }}>
        <span />
        스크롤
      </motion.div>
    </section>
  )
}

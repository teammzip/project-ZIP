import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import house from '@/assets/images/house-mobile.png'
import robot from '@/assets/images/robot-cut.png'
import { HERO, HERO_WIDGETS } from '../content'
import { Bubble } from './Bubble'
import { Lines } from './SectionHead'
import styles from './HeroSection.module.css'

const ease = [0.22, 1, 0.36, 1] as const

/** 첫 화면 (PC): 왼쪽 큰 제목 · 설명 · 아래로 안내, 오른쪽 3D 집 앞의 ZIP 로봇과 말풍선 · 요약 카드.
 * 내리면 글은 흐려지고 그림은 천천히 올라감 */
export function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const visualY = useTransform(scrollYProgress, [0, 1], [0, -120])

  return (
    <section ref={ref} id="top" className={styles.hero}>
      <div className={styles.inner}>
        <motion.div className={styles.copy} style={{ opacity: copyOpacity, y: copyY }}>
          <motion.p className={styles.kicker} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            {HERO.kicker}
          </motion.p>
          <h1 className={styles.title}>
            {HERO.lines.map((line, i) => (
              <span key={line} className={styles.lineMask}>
                <motion.span
                  className={i === HERO.lines.length - 1 ? styles.accent : undefined}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.12 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className={styles.description} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.5 }}>
            <Lines text={HERO.description} />
          </motion.p>
          {/* 아래 질문 섹션으로 */}
          <motion.a href="#question" className={styles.cue} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            {HERO.scrollCue}
            <span aria-hidden="true">↓</span>
          </motion.a>
        </motion.div>

        {/* 집 그림은 바탕과 섞이도록(multiply) 묶음 밖에서 따로 움직임 — 감싼 상자에 transform 을 걸면 흰 사각형이 보임 */}
        <div className={styles.visual} aria-hidden="true">
          <motion.img
            src={house}
            alt=""
            className={styles.house}
            style={{ y: visualY }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease, delay: 0.2 }}
          />
          <motion.div className={styles.layer} style={{ y: visualY }}>
            <motion.img
              src={robot}
              alt=""
              className={styles.robot}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.45 }}
            />
            <Bubble text={HERO.greeting} className={styles.greeting} delay={0.9} />
            {HERO_WIDGETS.map((w, i) => (
              <motion.div
                key={w.label}
                className={`${styles.widget} ${styles[`w${i}`]}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease, delay: 0.7 + i * 0.12 }}
              >
                <span className={styles.widgetIco} style={{ background: w.tone }}>
                  {w.icon}
                </span>
                <span>
                  <small>{w.label}</small>
                  <b>{w.value}</b>
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
      <span className={styles.scrollHint} aria-hidden="true">
        아래로 스크롤 ↓
      </span>
    </section>
  )
}

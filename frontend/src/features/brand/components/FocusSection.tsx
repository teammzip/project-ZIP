import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import { FOCUS_ITEMS } from '../content'
import { Phone } from './Phone'
import { Lines } from './SectionHead'
import styles from './FocusSection.module.css'

/** 화면에 고정된 채 스크롤하면 왼쪽 문장이 한 줄씩 진해지고, 오른쪽 겹친 카드의 앞장이 그 줄의 앱 화면으로 바뀜 */
export function FocusSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(FOCUS_ITEMS.length - 1, Math.floor(v * FOCUS_ITEMS.length))))
  const item = FOCUS_ITEMS[active]

  return (
    <section ref={ref} className={styles.section} style={{ height: `${FOCUS_ITEMS.length * 80 + 40}vh` }}>
      <div className={styles.sticky}>
        <ol className={styles.lines}>
          {FOCUS_ITEMS.map((f, i) => (
            <li key={f.line} className={cx(i === active && styles.on, i === FOCUS_ITEMS.length - 1 && styles.last)}>
              {f.line}
            </li>
          ))}
        </ol>

        <div className={styles.stack} aria-hidden="true">
          <div className={cx(styles.back, styles.back1)} style={{ background: FOCUS_ITEMS[(active + 1) % FOCUS_ITEMS.length].tint }} />
          <div className={cx(styles.back, styles.back2)} style={{ background: FOCUS_ITEMS[(active + 2) % FOCUS_ITEMS.length].tint }} />
          <AnimatePresence mode="popLayout">
            <motion.div
              key={item.screen + active}
              className={styles.front}
              style={{ background: item.tint }}
              initial={{ opacity: 0, rotate: 8, y: 40, scale: 0.94 }}
              animate={{ opacity: 1, rotate: -2, y: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -10, y: -30, scale: 0.94 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <Phone screen={item.screen} className={styles.phone} />
              <p className={styles.caption}>
                <Lines text={item.caption} />
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

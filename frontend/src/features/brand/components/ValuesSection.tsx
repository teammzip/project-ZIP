import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import { Lines, SectionHead } from './SectionHead'
import { VALUES, VALUES_HEAD, type BrandValue } from '../content'
import styles from './ValuesSection.module.css'

/* PC: 왼쪽 글이 스크롤되는 동안 오른쪽 그림 패널은 고정되어 있고, 지금 읽는 항목에 맞춰 바뀜.
 * 모바일: 항목마다 그림 패널이 글 아래에 같이 나옴. */
export function ValuesSection() {
  const [active, setActive] = useState(0)

  return (
    <section className={styles.section}>
      <SectionHead kicker={VALUES_HEAD.kicker} title={VALUES_HEAD.title} />

      <div className={styles.layout}>
        <div className={styles.steps}>
          {VALUES.map((v, i) => (
            <ValueStep key={v.id} value={v} index={i} active={active === i} onEnter={setActive} />
          ))}
        </div>

        <div className={styles.stickyWrap} aria-hidden="true">
          <div className={styles.sticky}>
            <AnimatePresence mode="wait">
              <motion.div
                key={VALUES[active].id}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.97 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <ValuePanel value={VALUES[active]} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

type StepProps = { value: BrandValue; index: number; active: boolean; onEnter: (index: number) => void }

function ValueStep({ value, index, active, onEnter }: StepProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' }) // 화면 한가운데를 지날 때

  useEffect(() => {
    if (inView) onEnter(index)
  }, [inView, index, onEnter])

  return (
    <article ref={ref} className={cx(styles.step, active && styles.stepActive)}>
      <p className={styles.stepLabel}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        {value.label}
      </p>
      <h3 className={styles.stepTitle}>
        <Lines text={value.title} />
      </h3>
      <p className={styles.stepBody}>{value.body}</p>
      <div className={styles.mobilePanel} aria-hidden="true">
        <ValuePanel value={value} />
      </div>
    </article>
  )
}

/** 항목별 그림: 큰 이모지 + 앱 화면을 흉내 낸 카드 */
function ValuePanel({ value }: { value: BrandValue }) {
  return (
    <div className={styles.panel} style={{ background: value.tint }}>
      <span className={styles.panelEmoji}>{value.emoji}</span>
      <ul className={styles.panelCard}>
        {value.preview.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  )
}

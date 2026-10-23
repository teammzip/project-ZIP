import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Reveal } from '@/components/ui'
import { cx } from '@/lib/cx'
import { SHOWCASE_ROWS, type ShowcaseRow } from '../content'
import { Phone } from './Phone'
import { Lines } from './SectionHead'
import styles from './ShowcaseSection.module.css'

/** 회색 판 위 휴대폰 두 대(앱 화면) + 큰 제목과 설명. 줄마다 좌우를 바꿔 가며 (사용자가 보내 준 참고 이미지 구성) */
export function ShowcaseSection() {
  return (
    <section className={styles.section}>
      {SHOWCASE_ROWS.map((row, i) => (
        <Row key={row.title} row={row} flip={i % 2 === 1} />
      ))}
    </section>
  )
}

function Row({ row, flip }: { row: ShowcaseRow; flip: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // 두 휴대폰이 서로 다른 속도로 움직여 입체감
  const y1 = useTransform(scrollYProgress, [0, 1], [80, -40])
  const y2 = useTransform(scrollYProgress, [0, 1], [-20, 60])

  return (
    <div ref={ref} className={cx(styles.row, flip && styles.flip)}>
      <Reveal className={styles.panel} y={48}>
        <motion.div className={cx(styles.phoneWrap, styles.p1)} style={{ y: y1 }}>
          <Phone screen={row.screens[0]} />
        </motion.div>
        <motion.div className={cx(styles.phoneWrap, styles.p2)} style={{ y: y2 }}>
          <Phone screen={row.screens[1]} />
        </motion.div>
      </Reveal>
      <div className={styles.copy}>
        <Reveal>
          <h2 className={styles.title}>{row.title}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className={styles.body}>
            <Lines text={row.body} />
          </p>
        </Reveal>
      </div>
    </div>
  )
}

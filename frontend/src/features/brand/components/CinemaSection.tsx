import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import scene from '@/assets/images/house-intro.png'
import robot from '@/assets/images/robot-cut.png'
import { CINEMA } from '../content'
import { Lines } from './SectionHead'
import styles from './CinemaSection.module.css'

/** 어두운 화면: 둥근 큰 그림(집 일러스트) 위에서 문장이 차례로 바뀌고, 마지막에 그림이 화면 가득 펼쳐지며 큰 문장 */
export function CinemaSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const width = useTransform(p, [0.58, 0.82], ['74%', '100%'])
  const height = useTransform(p, [0.58, 0.82], ['64%', '100%'])
  const radius = useTransform(p, [0.58, 0.82], [28, 0])
  const sceneScale = useTransform(p, [0, 1], [1.15, 1])
  const dim = useTransform(p, [0, 0.6, 0.85], [0.82, 0.82, 0.72])
  const robotY = useTransform(p, [0, 1], [40, -120])
  const finalOpacity = useTransform(p, [0.72, 0.9], [0, 1])
  const finalScale = useTransform(p, [0.72, 0.95], [0.9, 1])

  return (
    <section ref={ref} className={styles.section}>
      <div className={styles.sticky}>
        <motion.div className={styles.card} style={{ width, height, borderRadius: radius }}>
          <motion.img src={scene} alt="" className={styles.scene} style={{ scale: sceneScale }} />
          <motion.div className={styles.dim} style={{ opacity: dim }} />
          <motion.img src={robot} alt="" className={styles.robot} style={{ y: robotY }} />
          {CINEMA.lines.map((line, i) => (
            <Line key={i} text={line} progress={p} range={i === 0 ? [0.04, 0.12, 0.26, 0.33] : [0.34, 0.42, 0.52, 0.6]} />
          ))}
          <motion.h2 className={styles.final} style={{ opacity: finalOpacity, scale: finalScale }}>
            <Lines text={CINEMA.final} />
          </motion.h2>
        </motion.div>
      </div>
    </section>
  )
}

function Line({ text, progress, range }: { text: string; progress: MotionValue<number>; range: [number, number, number, number] }) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0])
  const y = useTransform(progress, range, [30, 0, 0, -30])
  return (
    <motion.p className={styles.line} style={{ opacity, y }}>
      <Lines text={text} />
    </motion.p>
  )
}

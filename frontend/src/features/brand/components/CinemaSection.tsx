import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import scene from '@/assets/images/cinema-room.jpg'
import { CINEMA } from '../content'
import { Lines } from './SectionHead'
import styles from './CinemaSection.module.css'

/** 어두운 화면: 둥근 큰 사진(밤에 불 켜진 자취방) 위에서 문장이 빈틈없이 차례로 바뀌고, 마지막에 그림이 화면 가득 펼쳐지며 큰 문장.
 * (로봇은 페이지 위를 날아다니는 FlyingRobot 하나로) */
export function CinemaSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const mobile = useMediaQuery('(max-width: 900px)')
  // 둥근 카드 크기: 모바일은 화면에 맞게 더 크게
  const width = useTransform(p, [0.56, 0.8], [mobile ? '88%' : '74%', '100%'])
  const height = useTransform(p, [0.56, 0.8], [mobile ? '72%' : '64%', '100%'])
  const radius = useTransform(p, [0.56, 0.8], [28, 0])
  const sceneScale = useTransform(p, [0, 1], [1.15, 1])
  const dim = useTransform(p, [0, 0.6, 0.85], [0.62, 0.62, 0.5])
  const finalOpacity = useTransform(p, [0.66, 0.84], [0, 1])
  const finalScale = useTransform(p, [0.66, 0.9], [0.9, 1])

  return (
    <section ref={ref} className={styles.section}>
      <div className={styles.sticky}>
        <motion.div className={styles.card} style={{ width, height, borderRadius: radius }}>
          <motion.img src={scene} alt="" className={styles.scene} style={{ scale: sceneScale }} />
          <motion.div className={styles.dim} style={{ opacity: dim }} />
          {CINEMA.lines.map((line, i) => (
            <Line key={i} text={line} progress={p} range={i === 0 ? [0, 0.04, 0.26, 0.32] : [0.3, 0.36, 0.54, 0.62]} first={i === 0} />
          ))}
          <motion.h2 className={styles.final} style={{ opacity: finalOpacity, scale: finalScale }}>
            <Lines text={CINEMA.final} />
          </motion.h2>
        </motion.div>
      </div>
    </section>
  )
}

/** first = 첫 문장: 장면이 화면에 들어올 때부터 이미 보임 (빈 사진만 보이는 순간이 없게) */
function Line({ text, progress, range, first }: { text: string; progress: MotionValue<number>; range: [number, number, number, number]; first?: boolean }) {
  const opacity = useTransform(progress, range, [first ? 1 : 0, 1, 1, 0])
  const y = useTransform(progress, range, [first ? 0 : 30, 0, 0, -30])
  return (
    <motion.p className={styles.line} style={{ opacity, y }}>
      <Lines text={text} />
    </motion.p>
  )
}

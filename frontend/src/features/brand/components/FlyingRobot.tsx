import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'motion/react'
import { useState } from 'react'
import robot from '@/assets/images/robot-cut.png'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { ROBOT_TALKS } from '../content'
import styles from './FlyingRobot.module.css'

/* 페이지 스크롤(0~1) 위치마다 로봇이 있을 자리. 0 = 화면 왼쪽/위 끝, 1 = 오른쪽/아래 끝 (로봇 크기만큼 뺀 범위)
 * 화면 좌우 끝을 지그재그로 오가서 가운데 큰 문장을 덜 가림. 모바일은 화면 아래쪽으로만 */
const STOPS = [0, 0.12, 0.3, 0.48, 0.66, 0.84, 1]
const XS = [0.92, 0.02, 0.96, 0.02, 0.94, 0.04, 0.9]
const YS_PC = [0.42, 0.2, 0.62, 0.26, 0.6, 0.3, 0.5]
const YS_MOBILE = [0.62, 0.74, 0.66, 0.78, 0.68, 0.76, 0.64]

const talkAt = (v: number) => {
  let i = 0
  ROBOT_TALKS.forEach((t, k) => {
    if (v >= t.at) i = k
  })
  return i
}

/** 브랜드 페이지 위를 날아다니는 집사 로봇: 맨 위에서 출발해 스크롤을 따라 지그재그로 날고,
 * 스크롤 속도만큼 몸을 기울이고 구간마다 말풍선이 바뀜 (오른쪽에 있으면 말풍선은 왼쪽으로). '동작 줄이기'면 오른쪽 아래에 가만히 */
export function FlyingRobot() {
  const reduce = useReducedMotion()
  const mobile = useMediaQuery('(max-width: 900px)')
  const size = mobile ? 72 : 120
  const { scrollYProgress, scrollY } = useScroll()
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 18, mass: 0.6 }) // 살짝 늦게 따라와 나는 느낌
  const xf = useTransform(p, STOPS, XS)
  const yf = useTransform(p, STOPS, mobile ? YS_MOBILE : YS_PC)
  // 화면 크기를 그때그때 읽어서 로봇이 화면 밖으로 나가지 않게
  const x = useTransform(xf, (f) => f * (window.innerWidth - size))
  const y = useTransform(yf, (f) => f * (window.innerHeight - size))
  const tilt = useSpring(useTransform(useVelocity(scrollY), [-3000, 0, 3000], [-16, 0, 16]), { stiffness: 140, damping: 18 })
  const [talk, setTalk] = useState(0)
  const [right, setRight] = useState(true)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setTalk(talkAt(v)))
  useMotionValueEvent(xf, 'change', (f) => setRight(f > 0.5))

  return (
    <motion.div className={reduce ? `${styles.robot} ${styles.still}` : styles.robot} style={{ width: size, ...(reduce ? {} : { x, y }) }} aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.p
          key={talk}
          className={`${styles.bubble} ${right || reduce ? styles.toLeft : styles.toRight}`}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.25 }}
        >
          {ROBOT_TALKS[talk].text}
        </motion.p>
      </AnimatePresence>
      <motion.div className={styles.body} style={reduce ? undefined : { rotate: tilt }}>
        <img src={robot} alt="" />
      </motion.div>
    </motion.div>
  )
}

import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import logo from '@/assets/images/logo-zip.png'
import { CLOUD, CLOUD_COLORS, CLOUD_ICONS } from '../content'
import styles from './CloudSection.module.css'

const COUNT = 150
/** 해바라기씨 배치: 가운데서 바깥으로 고르게 퍼진 원 모양 (매번 같은 자리) */
const SEEDS = Array.from({ length: COUNT }, (_, i) => {
  const r = Math.sqrt((i + 0.5) / COUNT) * 46 // 반지름 % (0 ~ 46)
  const a = i * 2.39996 // 황금각
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), icon: CLOUD_ICONS[i % CLOUD_ICONS.length], bg: CLOUD_COLORS[(i * 7) % CLOUD_COLORS.length], tilt: ((i * 37) % 21) - 10 }
})

/** 작은 카드 구름이 화면에 고정된 채, 스크롤하면 돌면서 작아지고 그 자리에 ZIP 로고가 커지며 나타남 */
export function CloudSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const cloudScale = useTransform(p, [0, 0.6], [1, 0.12])
  const cloudRotate = useTransform(p, [0, 0.6], [0, 120])
  const cloudOpacity = useTransform(p, [0.35, 0.6], [1, 0])
  const captionOpacity = useTransform(p, [0, 0.08, 0.3, 0.42], [0, 1, 1, 0])
  const logoScale = useTransform(p, [0.45, 0.75], [0.4, 1])
  const logoOpacity = useTransform(p, [0.45, 0.7], [0, 1])
  const afterOpacity = useTransform(p, [0.72, 0.88], [0, 1])
  const afterY = useTransform(p, [0.72, 0.88], [24, 0])

  return (
    <section ref={ref} className={styles.section}>
      <div className={styles.sticky}>
        <motion.div className={styles.cloud} style={{ scale: cloudScale, rotate: cloudRotate, opacity: cloudOpacity }} aria-hidden="true">
          {SEEDS.map((s, i) => (
            <span key={i} className={styles.seed} style={{ left: `${s.x}%`, top: `${s.y}%`, background: s.bg, rotate: `${s.tilt}deg` }}>
              {s.icon}
            </span>
          ))}
        </motion.div>
        <motion.p className={styles.caption} style={{ opacity: captionOpacity }}>
          {CLOUD.caption}
        </motion.p>
        <motion.div className={styles.logoWrap} style={{ scale: logoScale, opacity: logoOpacity }}>
          <img src={logo} alt="ZIP" className={styles.logo} />
          <motion.p className={styles.after} style={{ opacity: afterOpacity, y: afterY }}>
            {CLOUD.after}
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}

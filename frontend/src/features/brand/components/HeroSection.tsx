import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import house from '@/assets/images/last-house.png'
import robot from '@/assets/images/robot-cut.png'
import { HERO, HERO_TILES, type FloatTile } from '../content'
import styles from './HeroSection.module.css'

const ease = [0.22, 1, 0.36, 1] as const

/** 첫 화면: 가운데 큰 제목 + 주변에 둥둥 떠 있는 카드들. 내리면 카드마다 다른 속도로 위로 흘러가고 제목은 흐려짐 */
export function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0])
  const copyScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.92])

  return (
    <section ref={ref} id="top" className={styles.hero}>
      <div className={styles.tiles} aria-hidden="true">
        {HERO_TILES.map((t, i) => (
          <Tile key={i} tile={t} index={i} progress={scrollYProgress} />
        ))}
      </div>

      <motion.div className={styles.copy} style={{ opacity: copyOpacity, scale: copyScale }}>
        <motion.p className={styles.kicker} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          {HERO.kicker}
        </motion.p>
        <h1 className={styles.title}>
          {HERO.lines.map((line, i) => (
            <span key={line} className={styles.lineMask}>
              <motion.span className={styles.line} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.12 }}>
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.span className={styles.chevron} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} />
      </motion.div>
    </section>
  )
}

function Tile({ tile, index, progress }: { tile: FloatTile; index: number; progress: MotionValue<number> }) {
  // 스크롤할수록 위로 (카드마다 속도가 달라 깊이감이 생김)
  const y = useTransform(progress, [0, 1], [0, -tile.speed * 3])
  const style = { left: `${tile.x}%`, top: `${tile.y}%`, width: tile.w, y }

  return (
    <motion.div
      className={styles.tile}
      style={style}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease, delay: 0.25 + index * 0.06 }}
    >
      {/* 제자리에서 천천히 둥둥 */}
      <div className={styles.float} style={{ animationDelay: `${-index * 0.7}s`, animationDuration: `${5 + (index % 4)}s` }}>
        {tile.kind === 'illust' &&
          (tile.image ? (
            <img src={tile.image} alt="" className={styles.photo} style={{ height: tile.h }} />
          ) : (
            <div className={styles.illust} style={{ background: tile.bg, height: tile.h }}>
              <span>{tile.emoji}</span>
            </div>
          ))}
        {tile.kind === 'widget' && (
          <div className={styles.widget}>
            <span className={styles.widgetIco} style={{ background: tile.tone }}>
              {tile.icon}
            </span>
            <span>
              <small>{tile.label}</small>
              <b>{tile.value}</b>
            </span>
          </div>
        )}
        {tile.kind === 'robot' && <img src={robot} alt="" className={styles.cutout} />}
        {tile.kind === 'house' && <img src={house} alt="" className={styles.cutout} />}
      </div>
    </motion.div>
  )
}

import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Lines } from './SectionHead'
import { SHOWCASE } from '../content'
import styles from './ShowcaseSection.module.css'

/** 스크롤하면 작은 카드가 화면을 꽉 채우도록 커지면서 앱 홈 화면 미리보기가 나타남
 * TODO: 실제 앱 화면 캡처(또는 영상)가 생기면 MockDashboard 대신 넣기 */
export function ShowcaseSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const scale = useTransform(scrollYProgress, [0, 0.7], [0.72, 1])
  const radius = useTransform(scrollYProgress, [0, 0.7], [48, 0])
  const textY = useTransform(scrollYProgress, [0.3, 0.8], [40, 0])
  const textOpacity = useTransform(scrollYProgress, [0.3, 0.8], [0, 1])

  return (
    <section ref={ref} className={styles.section}>
      <div className={styles.sticky}>
        <motion.div className={styles.stage} style={{ scale, borderRadius: radius }}>
          <motion.div className={styles.copy} style={{ y: textY, opacity: textOpacity }}>
            <p className={styles.kicker}>{SHOWCASE.kicker}</p>
            <h2 className={styles.title}>
              <Lines text={SHOWCASE.title} />
            </h2>
          </motion.div>
          <MockDashboard />
        </motion.div>
      </div>
    </section>
  )
}

function MockDashboard() {
  return (
    <div className={styles.mock} aria-hidden="true">
      <p className={styles.mockHello}>
        안녕하세요, <b>지기</b>님
      </p>
      <div className={styles.mockGrid}>
        <div className={styles.mockCard}>
          <span>📅 오늘 할 일</span>
          <b>3개 남음</b>
        </div>
        <div className={styles.mockCard}>
          <span>💸 월세</span>
          <b>D-3</b>
        </div>
        <div className={styles.mockCard}>
          <span>🗑️ 오늘 배출</span>
          <b>플라스틱</b>
        </div>
        <div className={styles.mockCard}>
          <span>🤖 AI 도우미</span>
          <b>사진으로 물어보기</b>
        </div>
      </div>
    </div>
  )
}

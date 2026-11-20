import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import house from '@/assets/images/house-mobile.png'
import robot from '@/assets/images/robot-cut.png'
import { QUESTION } from '../content'
import { Bubble } from './Bubble'
import { SectionHead } from './SectionHead'
import styles from './QuestionSection.module.css'

/** 작은 불편에서 시작: 왼쪽은 3D 집 앞 로봇과 질문(흰) · 답(파란) 말풍선, 오른쪽은 제목 · 설명. 모바일은 그림 → 글 */
export function QuestionSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const robotY = useTransform(scrollYProgress, [0, 1], [60, -60])

  return (
    <section ref={ref} className={styles.section} id="question">
      <div className={styles.inner}>
        <div className={styles.visual} aria-hidden="true">
          <img src={house} alt="" className={styles.house} />
          <motion.img src={robot} alt="" className={styles.robot} style={{ y: robotY }} />
          <Bubble text={QUESTION.asks[0]} className={styles.ask0} />
          <Bubble text={QUESTION.asks[1]} className={styles.ask1} delay={0.25} />
          <Bubble text={QUESTION.reply} tone="blue" className={styles.reply} delay={0.6} />
        </div>
        <SectionHead kicker={QUESTION.kicker} title={QUESTION.title} body={QUESTION.body} />
      </div>
    </section>
  )
}

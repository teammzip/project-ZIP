import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { INTRO } from '../content'
import styles from './IntroSection.module.css'

/** 스크롤을 내리는 만큼 글자가 한 단어씩 진해지는 소개 문단 */
export function IntroSection() {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.4'] })
  const words = INTRO.text.split(' ')

  return (
    <section className={styles.intro}>
      <p className={styles.kicker}>{INTRO.kicker}</p>
      <p ref={ref} className={styles.text}>
        {words.map((word, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {word}
          </Word>
        ))}
      </p>
    </section>
  )
}

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: string }) {
  const opacity = useTransform(progress, range, [0.15, 1])
  return (
    <>
      <motion.span style={{ opacity }}>{children}</motion.span>{' '}
    </>
  )
}

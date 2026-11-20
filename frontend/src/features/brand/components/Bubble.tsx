import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { cx } from '@/lib/cx'
import styles from './Bubble.module.css'

type Props = {
  text: string
  /** white: 질문(흰 말풍선) · blue: ZIP 의 답(파란 말풍선 + 체크) */
  tone?: 'white' | 'blue'
  /** 화면에 들어오고 나서 나타나기까지 기다리는 시간(초) */
  delay?: number
  className?: string
  style?: CSSProperties
}

/** 로봇 옆에 떠 있는 작은 말풍선 (그림의 일부라 읽기 프로그램은 본문 글로 읽음) */
export function Bubble({ text, tone = 'white', delay = 0, className, style }: Props) {
  return (
    <motion.span
      className={cx(styles.bubble, tone === 'blue' && styles.blue, className)}
      style={style}
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      <span className={styles.icon} aria-hidden="true">
        {tone === 'blue' ? '✓' : '···'}
      </span>
      {text}
    </motion.span>
  )
}

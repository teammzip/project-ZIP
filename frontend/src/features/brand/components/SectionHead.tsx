import { Fragment } from 'react'
import { Reveal } from './Reveal'
import { cx } from '@/lib/cx'
import styles from './SectionHead.module.css'

/** 문구 속 \n 을 줄바꿈으로. accent 면 마지막 줄을 파란색으로 강조 */
export function Lines({ text, accent }: { text: string; accent?: boolean }) {
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {accent && i === lines.length - 1 && lines.length > 1 ? <span className={styles.accent}>{line}</span> : line}
    </Fragment>
  ))
}

type Props = {
  kicker: string
  title: string
  body?: string
  /** left: 위아래로 · center: 가운데 · split: 제목은 왼쪽, 설명은 오른쪽 (흰 판 위 제목) */
  align?: 'left' | 'center' | 'split'
  /** 어두운 배경 위 */
  inverse?: boolean
  /** 제목 마지막 줄 강조 (기본 켬) */
  accent?: boolean
  className?: string
}

/** 섹션 위쪽 공통 제목: 작은 파란 글씨(kicker) + 굵은 남색 제목(마지막 줄 파란색) + 회색 설명 */
export function SectionHead({ kicker, title, body, align = 'left', inverse, accent = true, className }: Props) {
  const caps = /^[A-Z0-9 &·]+$/.test(kicker) // 영어 대문자면 글자 사이를 넓게
  return (
    <div className={cx(styles.head, styles[align], inverse && styles.inverse, className)}>
      <div className={styles.main}>
        <Reveal>
          <p className={cx(styles.kicker, caps && styles.caps)}>{kicker}</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className={styles.title}>
            <Lines text={title} accent={accent} />
          </h2>
        </Reveal>
      </div>
      {body && (
        <Reveal delay={0.16}>
          <p className={styles.body}>
            <Lines text={body} />
          </p>
        </Reveal>
      )}
    </div>
  )
}

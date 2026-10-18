import { Fragment } from 'react'
import { Reveal } from '@/components/ui'
import { cx } from '@/lib/cx'
import styles from './SectionHead.module.css'

/** 문구 속 \n 을 줄바꿈으로 */
export function Lines({ text }: { text: string }) {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ))
}

type Props = {
  kicker: string
  title: string
  body?: string
  align?: 'left' | 'center'
  /** 어두운 배경 위 */
  inverse?: boolean
}

/** 섹션 위쪽 공통 제목: 작은 글씨(kicker) + 큰 제목 + 설명 */
export function SectionHead({ kicker, title, body, align = 'left', inverse }: Props) {
  return (
    <div className={cx(styles.head, align === 'center' && styles.center, inverse && styles.inverse)}>
      <Reveal>
        <p className={styles.kicker}>{kicker}</p>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 className={styles.title}>
          <Lines text={title} />
        </h2>
      </Reveal>
      {body && (
        <Reveal delay={0.2}>
          <p className={styles.body}>{body}</p>
        </Reveal>
      )}
    </div>
  )
}

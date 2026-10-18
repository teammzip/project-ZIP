import type { ComponentProps, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Card.module.css'

type Props = Omit<ComponentProps<'article'>, 'title'> & {
  /** 카드 위쪽 제목 */
  title?: ReactNode
  /** 제목 오른쪽에 둘 버튼·선택상자 등 */
  actions?: ReactNode
}

/** 흰 바탕 둥근 카드. 앱 안 거의 모든 화면이 씁니다. */
export function Card({ title, actions, className, children, ...rest }: Props) {
  return (
    <article className={cx(styles.card, className)} {...rest}>
      {(title != null || actions != null) && (
        <div className={styles.head}>
          {title != null && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </article>
  )
}

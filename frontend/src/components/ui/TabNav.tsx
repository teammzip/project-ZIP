import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from '@/lib/cx'
import styles from './TabNav.module.css'

export type TabItem = {
  to: string
  label: ReactNode
  /** true 면 주소가 정확히 같을 때만 켜짐 (하위 주소에서는 꺼짐) */
  end?: boolean
}

type Props = {
  items: TabItem[]
  label: string
  /** underline: 마이페이지 1단계 / pill: 2단계(이번 주 할 일 | 쓰레기 배출, 수입 | 지출) / chip: 3단계(고정 | 기타 지출) */
  variant?: 'underline' | 'pill' | 'chip'
}

/** 주소(URL)로 바뀌는 탭. 마이페이지 1단계 탭, 가계부 수입|지출 탭 등에 같이 씁니다. */
export function TabNav({ items, label, variant = 'underline' }: Props) {
  return (
    <nav className={cx(styles.tabs, styles[variant])} aria-label={label}>
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx(styles.tab, isActive && styles.on)}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

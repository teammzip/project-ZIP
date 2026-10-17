import { NavLink } from 'react-router-dom'
import { cx } from '@/lib/cx'
import styles from './TabNav.module.css'

export type TabItem = { to: string; label: string }

/** 주소(URL)로 바뀌는 탭. 마이페이지 1단계 탭, 가계부 수입|지출 탭 등에 같이 씁니다. */
export function TabNav({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => cx(styles.tab, isActive && styles.on)}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

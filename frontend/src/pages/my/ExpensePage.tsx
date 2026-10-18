import { Outlet } from 'react-router-dom'
import { TabNav, type TabItem } from '@/components/ui'
import common from '@/styles/common.module.css'

/* 지출 탭: 고정 지출(월세·공과금) | 기타 지출(식비·생활용품 등) */
const TABS: TabItem[] = [
  { to: '/my/budget/expense', label: '고정 지출', end: true },
  { to: '/my/budget/expense/spend', label: '기타 지출' },
]

export function ExpensePage() {
  return (
    <div className={common.stack}>
      <TabNav items={TABS} label="지출 종류" variant="chip" />
      <Outlet />
    </div>
  )
}

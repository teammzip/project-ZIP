import { Outlet } from 'react-router-dom'
import { TabNav, type TabItem } from '@/components/ui'
import common from '@/styles/common.module.css'

/* 가계부 탭: 수입 | 지출 (지출 안에 고정 지출 | 기타 지출) */
const TABS: TabItem[] = [
  { to: '/my/budget/income', label: '수입' },
  { to: '/my/budget/expense', label: '지출' },
]

export function BudgetPage() {
  return (
    <div className={common.stack}>
      <TabNav items={TABS} label="가계부" variant="pill" />
      <Outlet />
    </div>
  )
}

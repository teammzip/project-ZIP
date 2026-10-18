import { Outlet } from 'react-router-dom'
import { TabNav, type TabItem } from '@/components/ui'
import common from '@/styles/common.module.css'

/* 할 일 탭: 이번 주 할 일 | 쓰레기 배출 */
const TABS: TabItem[] = [
  { to: '/my/todo', label: '이번 주 할 일', end: true },
  { to: '/my/todo/trash', label: '쓰레기 배출' },
]

export function TodoPage() {
  return (
    <div className={common.stack}>
      <TabNav items={TABS} label="할 일" variant="pill" />
      <Outlet />
    </div>
  )
}

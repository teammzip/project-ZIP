import { Outlet } from 'react-router-dom'
import { TabNav, type TabItem } from '@/components/ui'
import styles from './MyLayout.module.css'

/* 마이페이지: 할 일 | 일정 | 가계부 | 알림 | 내 정보 를 위쪽 탭으로 오감. 탭마다 주소가 따로 있음 (/my/todo 등) */
const MY_TABS: TabItem[] = [
  { to: '/my/todo', label: '할 일' },
  { to: '/my/calendar', label: '일정' },
  { to: '/my/budget', label: '가계부' },
  { to: '/my/noti', label: '알림' },
  { to: '/my/settings', label: '내 정보' },
]

export function MyLayout() {
  return (
    <div className={styles.wrap}>
      <TabNav items={MY_TABS} label="마이페이지 메뉴" />
      <Outlet />
    </div>
  )
}

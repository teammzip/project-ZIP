import { Outlet } from 'react-router-dom'
import { TabNav, type TabItem } from '@/components/ui'
import { useNotis } from '@/features/life'
import common from '@/styles/common.module.css'
import styles from './MyLayout.module.css'

/* 마이페이지: 일정 | 가계부 | 메모 | 알림 | 내 정보 를 위쪽 탭으로 오감 (할 일은 일정에 합쳐짐). 탭마다 주소가 따로 있음 */
export function MyLayout() {
  const { showDot } = useNotis()
  const tabs: TabItem[] = [
    { to: '/my/calendar', label: '일정' },
    { to: '/my/budget', label: '가계부' },
    { to: '/my/memo', label: '메모' },
    {
      to: '/my/noti',
      label: (
        <>
          알림{showDot && <span className={styles.dot} aria-label="안 읽은 알림 있음" />}
        </>
      ),
    },
    { to: '/my/settings', label: '내 정보' },
  ]

  return (
    <div className={styles.wrap}>
      <h1 className={common.pageTitle}>
        마이페이지 <small>일정 · 가계부 · 메모 · 알림 · 내 정보</small>
      </h1>
      <TabNav items={tabs} label="마이페이지 메뉴" />
      <Outlet />
    </div>
  )
}

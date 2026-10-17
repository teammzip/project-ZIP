import { NavLink, Outlet } from 'react-router-dom'
import logoIcon from '@/assets/images/app-icon.png'
import { Button } from '@/components/ui'
import { useAuthStore, useLogout } from '@/features/auth'
import { cx } from '@/lib/cx'
import { BOTTOM_ITEMS, SIDEBAR_ITEMS } from './navItems'
import styles from './AppLayout.module.css'

/* 로그인 후 모든 화면의 틀: PC 는 왼쪽 사이드바, 모바일(900px 이하)은 하단 메뉴.
 * 각 화면은 <Outlet /> 자리에 그려집니다. */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.body}>
        <Header />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <NavLink to="/" className={styles.brand}>
        <img src={logoIcon} alt="" width={36} height={36} />
        <span>ZIP</span>
      </NavLink>
      <nav aria-label="주 메뉴">
        <ul className={styles.navList}>
          {SIDEBAR_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => cx(styles.navItem, isActive && styles.active)}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <header className={styles.header}>
      <p className={styles.greeting}>
        안녕하세요, <b>{user?.nickname ?? '자취생'}</b>님
      </p>
      <Button variant="line" onClick={() => logout.mutate()} loading={logout.isPending}>
        로그아웃
      </Button>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className={styles.bottomNav} aria-label="하단 메뉴">
      {BOTTOM_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx(styles.bottomItem, isActive && styles.active)}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

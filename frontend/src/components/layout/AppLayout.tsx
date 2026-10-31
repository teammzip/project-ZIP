import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import logoIcon from '@/assets/images/app-icon.png'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import { useAuthStore, useLogout } from '@/features/auth'
import { useNotis } from '@/features/life'
import { WarnNotice } from '@/features/moderation'
import { Avatar } from '@/features/profile'
import { cx } from '@/lib/cx'
import { DOW } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import { NavIcon } from './NavIcon'
import { ProfileMenu } from './ProfileMenu'
import { BOTTOM_ITEMS, SIDEBAR_ITEMS, type NavItem } from './navItems'
import styles from './AppLayout.module.css'

/* 로그인 후 모든 화면의 틀
 * - PC: 왼쪽 좁은 아이콘 메뉴(맨 아래 프로필 사진 → 프로필 메뉴) + 본문. 오른쪽 요약 패널은 시안에서 빠짐
 * - PC · 모바일 공통: 오른쪽 아래에 AI 도우미 버튼이 떠 있음 (AI · 동네 화면 제외)
 * - 모바일(900px 이하): 하단 메뉴(커뮤니티·AI·홈·동네·마이페이지) + 그 위 AI 버튼 + 오른쪽 위 알림·프로필·☰ 전체 메뉴
 * 각 화면은 <Outlet /> 자리에 그려집니다. */
export function AppLayout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const toggleProfile = () => setProfileOpen((v) => !v)
  const showFab = pathname !== '/ai' && pathname !== '/map' // AI 버튼은 AI · 동네 화면에선 안 나옴

  // 화면을 옮기면 ☰ 메뉴는 닫힘 (렌더 중에 이전 주소와 비교 — effect 안에서 setState 하지 않으려고)
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMenuOpen(false)
    setProfileOpen(false)
  }

  return (
    <div className={styles.shell}>
      <Sidebar onProfile={toggleProfile} profileOpen={profileOpen} />
      <div className={styles.body}>
        <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} onProfile={toggleProfile} profileOpen={profileOpen} />
        <main className={cx(styles.main, showFab && styles.mainFab)}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {showFab && (
        <Link to="/ai" className={styles.aiFab} aria-label="AI 도우미 열기" title="AI 도우미">
          <svg viewBox="0 0 24 24" width={32} height={32} aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" />
            <text x="12" y="15" textAnchor="middle">
              AI
            </text>
          </svg>
        </Link>
      )}
      <MenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
      <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} />
      {/* 운영자에게 받은 경고를 아직 확인 안 했으면 한 번 보여 줌 (?demo=warn 이면 예시) */}
      <WarnNoticeForMe />
    </div>
  )
}

function WarnNoticeForMe() {
  const nick = useAuthStore((s) => s.user?.nickname)
  return <WarnNotice key={nick} nick={nick} />
}

/** 마이페이지 메뉴에 안 읽은 알림 빨간 점 */
function NavDot({ item }: { item: NavItem }) {
  const { showDot } = useNotis()
  if (item.to !== '/my' || !showDot) return null
  return <span className={styles.dot} aria-label="안 읽은 알림 있음" />
}

type ProfileProps = { onProfile: () => void; profileOpen: boolean }

/** 프로필 사진 단추 (누르면 프로필 메뉴) */
function ProfileButton({ onProfile, profileOpen, size, className }: ProfileProps & { size: number; className: string }) {
  const name = useAuthStore((s) => s.user?.nickname) ?? '자취생'
  return (
    <button type="button" className={className} onClick={onProfile} aria-label="프로필 메뉴" title="프로필" aria-haspopup="true" aria-expanded={profileOpen} data-profile-opener>
      <Avatar name={name} size={size} />
    </button>
  )
}

function Sidebar(props: ProfileProps) {
  return (
    <aside className={styles.sidebar}>
      <NavLink to="/" className={styles.brand} aria-label="ZIP 홈">
        <img src={logoIcon} alt="" width={40} height={40} />
      </NavLink>
      <nav aria-label="주 메뉴">
        <ul className={styles.navList}>
          {SIDEBAR_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} title={item.label} className={({ isActive }) => cx(styles.navItem, isActive && styles.active)}>
                <NavIcon name={item.icon} />
                <span className={styles.navLabel}>{item.label}</span>
                <NavDot item={item} />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* 맨 아래 프로필 사진: 누르면 프로필 보기 · 설정 · 로그아웃 */}
      <ProfileButton {...props} size={40} className={styles.sideProfile} />
    </aside>
  )
}

function Header({ menuOpen, onToggleMenu, ...profile }: { menuOpen: boolean; onToggleMenu: () => void } & ProfileProps) {
  const user = useAuthStore((s) => s.user)
  const { showDot } = useNotis()
  const now = useToday()
  const name = user?.nickname ?? '자취생'

  return (
    <header className={styles.header}>
      <div>
        <p className={styles.date}>
          {now.getMonth() + 1}월 {now.getDate()}일 {DOW[now.getDay()]}요일
        </p>
        <p className={styles.greeting}>
          안녕하세요, <b>{name}</b>님
        </p>
      </div>
      {/* 모바일: 알림 · 프로필(메뉴) · ☰ 전체 메뉴 */}
      <div className={styles.mobIcons}>
        <NavLink to="/my/noti" className={({ isActive }) => cx(styles.mobIcon, isActive && styles.mobOn)} aria-label="알림" title="알림">
          <NavIcon name="bell" size={20} />
          {showDot && <span className={styles.mobDot} aria-label="안 읽은 알림 있음" />}
        </NavLink>
        <ProfileButton {...profile} size={30} className={cx(styles.mobIcon, profile.profileOpen && styles.mobOn)} />
        <button
          type="button"
          className={cx(styles.mobIcon, menuOpen && styles.menuBtnOpen)}
          onClick={onToggleMenu}
          aria-label={menuOpen ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <NavIcon name={menuOpen ? 'close' : 'menu'} size={20} />
        </button>
      </div>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className={styles.bottomNav} aria-label="하단 메뉴">
      {BOTTOM_ITEMS.map((item) =>
        item.to === '/' ? (
          // 가운데 홈: 메뉴 위로 솟은 큰 파란 동그라미 버튼 (글자는 스크린리더만)
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => cx(styles.bottomPhoto, isActive && styles.photoOn)} aria-label={item.label}>
            <span className={styles.photoCircle}>
              <NavIcon name={item.icon} size={28} />
            </span>
          </NavLink>
        ) : (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx(styles.bottomItem, isActive && styles.active)}>
            <span className={styles.bottomIco}>
              <NavIcon name={item.icon} />
              <NavDot item={item} />
            </span>
            {item.label}
          </NavLink>
        ),
      )}
    </nav>
  )
}

/** 모바일 ☰ 전체 메뉴: 오른쪽에서 열리는 패널 (PC 사이드바와 같은 항목 + 알림) */
function MenuPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const name = user?.nickname ?? '자취생'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // 창이 넓어져 ☰ 버튼이 사라지면 닫음
    const wide = window.matchMedia('(min-width: 901px)')
    const onWide = (e: MediaQueryListEvent) => e.matches && onClose()
    window.addEventListener('keydown', onKey)
    wide.addEventListener('change', onWide)
    return () => {
      window.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
    }
  }, [open, onClose])

  if (!open) return null
  const tiles: NavItem[] = [...SIDEBAR_ITEMS, { to: '/my/noti', label: '알림', icon: 'bell' }]

  return (
    <>
      <div className={styles.menuBackdrop} onClick={onClose} />
      <aside className={styles.menuPanel} aria-label="전체 메뉴">
        <div className={styles.menuHead}>
          <img src={logo} alt="ZIP" />
          <b>전체 메뉴</b>
        </div>
        <div className={styles.menuGrid}>
          {tiles.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx(styles.menuTile, isActive && styles.menuOn)}>
              <span className={styles.icoWrap}>
                <NavIcon name={t.icon} size={24} />
              </span>
              {t.label}
            </NavLink>
          ))}
        </div>
        {/* 내 계정: 누구로 로그인했는지 + 로그아웃 */}
        <div className={styles.menuAccount}>
          <Avatar name={name} size={40} />
          <div className={styles.menuWho}>
            <b>{name}</b>
            <small>{user?.email}</small>
          </div>
          <Button variant="line" onClick={() => logout.mutate()} loading={logout.isPending}>
            로그아웃
          </Button>
        </div>
      </aside>
    </>
  )
}

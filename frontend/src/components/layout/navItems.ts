/* 메뉴 목록을 한곳에서 관리. PC 사이드바와 모바일 하단 메뉴가 같은 데이터를 씁니다.
 * (기존 시안: PC 메뉴 = 홈·사진·AI·동네·커뮤니티·마이페이지 / 모바일 하단 = 홈·마이페이지·사진·AI·동네) */
export type NavItem = { to: string; label: string; icon: string; end?: boolean }

export const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/photo', label: '사진', icon: '📷' },
  { to: '/ai', label: 'AI', icon: '🤖' },
  { to: '/map', label: '동네', icon: '🗺️' },
  { to: '/community', label: '커뮤니티', icon: '💬' },
  { to: '/my', label: '마이페이지', icon: '👤' },
]

const byPath = (to: string) => SIDEBAR_ITEMS.find((i) => i.to === to)!

export const BOTTOM_ITEMS: NavItem[] = ['/', '/my', '/photo', '/ai', '/map'].map(byPath)

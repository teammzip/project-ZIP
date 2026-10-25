/* 메뉴 목록을 한곳에서 관리. PC 사이드바, 모바일 하단 메뉴, 모바일 ☰ 전체 메뉴가 같은 데이터를 씁니다.
 * (PC 메뉴 = 홈·AI·동네·커뮤니티·마이페이지 / 모바일 하단 = 커뮤니티·AI·홈(가운데)·동네·마이페이지,
 *  사진은 AI 화면의 ＋ 버튼으로 합쳐짐) */
import type { IconName } from './NavIcon'

export type NavItem = { to: string; label: string; icon: IconName; end?: boolean }

export const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/ai', label: 'AI', icon: 'ai' },
  { to: '/map', label: '동네', icon: 'map' },
  { to: '/community', label: '커뮤니티', icon: 'community' },
  { to: '/my', label: '마이페이지', icon: 'my' },
]

const byPath = (to: string) => SIDEBAR_ITEMS.find((i) => i.to === to)!

/** 모바일 하단: 커뮤니티 · AI · 홈(가운데) · 동네 · 마이페이지(맨 끝) */
export const BOTTOM_ITEMS: NavItem[] = ['/community', '/ai', '/', '/map', '/my'].map(byPath)

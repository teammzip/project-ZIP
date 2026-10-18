/* 메뉴 목록을 한곳에서 관리. PC 사이드바, 모바일 하단 메뉴, 모바일 ☰ 전체 메뉴가 같은 데이터를 씁니다.
 * (PC 메뉴 = 홈·사진·AI·동네·커뮤니티·마이페이지 / 모바일 하단 = 홈·AI·사진(가운데)·동네·마이페이지,
 *  커뮤니티는 모바일에서 ☰ 전체 메뉴와 동네 화면의 "이야기" 탭으로 들어감) */
import type { IconName } from './NavIcon'

export type NavItem = { to: string; label: string; icon: IconName; end?: boolean }

export const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/photo', label: '사진', icon: 'photo' },
  { to: '/ai', label: 'AI', icon: 'ai' },
  { to: '/map', label: '동네', icon: 'map' },
  { to: '/community', label: '커뮤니티', icon: 'community' },
  { to: '/my', label: '마이페이지', icon: 'my' },
]

const byPath = (to: string) => SIDEBAR_ITEMS.find((i) => i.to === to)!

/** 모바일 하단: 홈 · AI · 사진(가운데) · 동네 · 마이페이지(맨 끝) */
export const BOTTOM_ITEMS: NavItem[] = ['/', '/ai', '/photo', '/map', '/my'].map(byPath)

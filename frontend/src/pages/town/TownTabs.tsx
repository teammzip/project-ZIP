import { TabNav, type TabItem } from '@/components/ui'

/* 동네 = 지도 | 이야기(커뮤니티). 모바일 하단 메뉴에는 커뮤니티가 없어서 동네 화면에서 이 탭으로 오감 */
const TOWN_TABS: TabItem[] = [
  { to: '/map', label: '지도' },
  { to: '/community', label: '이야기' },
]

export function TownTabs() {
  return <TabNav items={TOWN_TABS} label="동네 메뉴" variant="pill" />
}

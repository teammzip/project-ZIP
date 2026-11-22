/* 커뮤니티 "주변 동네" 탭 안내 문구 (서버 모드). 서버가 주는 내 동네 · 이웃 동네 이름(GET /api/posts/neighbors)으로 만들어요.
 * 내 동네는 주거 설문 · 내 정보 주소로 정해진 동네라서, 글 목록(scope=near)이 거르는 동네와 안내가 항상 같아요. */
import { normRegion } from '@/features/life/locateRegion'
import type { NeighborRegion, Neighbors } from './server'

/** 안내에 쓰는 동네 이름: 같은 시 · 도면 '용산구', 다른 시 · 도면 '경기 고양시', 시 · 도 자체(세종)면 '세종' */
export function neighborLabel(region: NeighborRegion, mySido: string | null) {
  if (!region.sido || region.sido === region.name) return normRegion(region.name)
  return region.sido === mySido ? region.name : normRegion(`${region.sido} ${region.name}`)
}

/** 예: "📍 서울 마포구 + 주변 7곳: 서대문구 · 영등포구 · … · 경기 고양시" */
export function serverNearNote(query: { data?: Neighbors; isError: boolean }) {
  if (query.isError) return '주변 동네를 불러오지 못했어요. 잠시 후 다시 열어 주세요.'
  if (!query.data) return '주변 동네를 찾고 있어요…'
  const { region, neighbors } = query.data
  if (!region) return '주거 설문에서 주소를 고르면 주변 동네를 보여 드려요.'
  const mine = neighborLabel(region, null)
  if (!neighbors.length) return `📍 ${mine} · 아직 이 지역의 주변 동네 정보가 없어요.`
  return `📍 ${mine} + 주변 ${neighbors.length}곳: ${neighbors.map((n) => neighborLabel(n, region.sido)).join(' · ')}`
}

/* 날씨 기준 지역: 주거 설문에서 고른 주소에서 시 · 도 + 시 · 군 · 구만 뽑아요 (설문 좌표가 없을 때 좌표를 찾으려고).
 * 도로명 · 번지 · 호수까지 넣으면 무료 주소 찾기(OpenStreetMap)가 못 찾는 경우가 많고,
 * 날씨 예보는 몇 km 단위라 시 · 군 · 구 중심 좌표면 충분해요. */
import { REGIONS } from '@/features/auth/data/regions'
import { normRegion } from '@/features/life/locateRegion'

/** 주소로 좌표를 찾을 때 차례로 시도할 검색어. OpenStreetMap 은 지번 번지(예: '123-4')가 붙으면 못 찾아서
 * ① 주소 그대로 → ② 번지 · 호수처럼 숫자로 시작하는 말을 뺀 주소 → ③ 시 · 도 + 시 · 군 · 구 순서로 (겹치면 한 번만).
 * '망원1동'처럼 동 이름 안의 숫자는 그대로 둠 */
export function addressCandidates(address: string): string[] {
  const full = address.trim().replace(/\s+/g, ' ')
  if (!full) return []
  const withoutNumbers = full.split(' ').filter((word) => !/^산?\d/.test(word)).join(' ')
  return [...new Set([full, withoutNumbers, addressWeatherRegion(full)].filter(Boolean))]
}

/** '서울특별시 마포구 월드컵북로 396 101호' → '서울 마포구'. 시 · 군 · 구를 못 찾으면 '' (그때는 기존 동네 기준 날씨) */
export function addressWeatherRegion(address: string): string {
  const words = normRegion(address).split(' ').filter(Boolean)
  if (!words.length) return ''
  const sido = words.find((word) => word in REGIONS)
  // 세종은 시 · 군 · 구가 없음 (regions.ts 도 시 · 도 이름 하나)
  if (sido === '세종') return '세종'
  if (sido) {
    const sigungu = REGIONS[sido].find((name) => words.includes(name))
    return sigungu ? `${sido} ${sigungu}` : ''
  }
  // 시 · 도 없이 "마포구 합정동"처럼 쓴 주소: 그 시 · 군 · 구 이름이 전국에 하나뿐일 때만 씀 (중구 · 동구처럼 여러 곳이면 모름)
  const found = Object.entries(REGIONS).flatMap(([s, names]) => names.filter((name) => words.includes(name)).map((name) => `${s} ${name}`))
  return found.length === 1 ? found[0] : ''
}

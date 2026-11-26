import { readMapPoint } from '@/features/map/location'
import type { HousingSurvey } from '@/features/onboarding/store'
import { serverRegionName } from './regionVerification'
import type { LifeSettings, RegionVerify } from './types'

/** 서버 모드 회원은 DB 의 동네(region)와 인증 시각(regionVerifiedAt, 30일 지나면 null)도 함께 옴. 모의 모드 회원에는 없음 */
type UserLocation = {
  id: string
  address: string
  region?: { name: string; fullName?: string } | null
  regionVerifiedAt?: string | null
}
export type Neighborhood = { region: string; point: { lat: number; lon: number } | null; source: 'survey' | 'verified' | 'manual' | 'account' | 'none' }

/**
 * 인증·수동 변경은 설문 주소보다 우선. 회원이 바뀌면 다른 회원의 설정과 좌표를 사용하지 않음.
 * 이 브라우저에 고른 동네가 없으면(다른 기기에서 인증했거나 브라우저 데이터를 지움) 서버(DB)의 회원 동네를 씀.
 */
export function selectNeighborhood(user: UserLocation | null, settings: LifeSettings, survey: HousingSurvey | null, verify: RegionVerify | null): Neighborhood {
  if (!user) return { region: '', point: null, source: 'none' }
  const verifiedOnServer = user.regionVerifiedAt ? serverRegionName(user.region) : ''
  const selected = settings.regionLocation
  // 이 브라우저에서 고른 동네. 단 설문에서 온 선택은 서버의 동네 인증보다 뒤 (인증이 설문보다 우선)
  if (selected?.userId === user.id && selected.region === settings.region && selected.region.trim() && !(selected.source === 'survey' && verifiedOnServer)) {
    return { region: selected.region.trim(), point: readMapPoint(selected.point), source: selected.source }
  }
  // 좌표를 저장하지 않던 기존 인증 기록도 인증한 동네 이름을 우선 사용.
  if (verify?.userId === user.id && verify.region === settings.region && verify.at <= Date.now() && verify.region.trim()) {
    return { region: verify.region.trim(), point: null, source: 'verified' }
  }
  // 다른 기기에서 인증한 동네 (좌표는 서버에 없어서 이름으로 위치를 찾음)
  if (verifiedOnServer) return { region: verifiedOnServer, point: null, source: 'verified' }
  if (survey?.userId === user.id && survey.address.trim()) {
    return { region: survey.address.trim(), point: readMapPoint(survey.addressPoint), source: 'survey' }
  }
  if (user.address.trim()) return { region: user.address.trim(), point: null, source: 'account' }
  // 주소는 비었지만 서버에 동네가 남아 있는 회원(인증 30일이 지남 등)
  const account = serverRegionName(user.region)
  return { region: account, point: null, source: account ? 'account' : 'none' }
}

import { readMapPoint } from '@/features/map/location'
import type { HousingSurvey } from '@/features/onboarding/store'
import type { LifeSettings, RegionVerify } from './types'

type UserLocation = { id: string; address: string }
export type Neighborhood = { region: string; point: { lat: number; lon: number } | null; source: 'survey' | 'verified' | 'manual' | 'account' | 'none' }

/** 인증·수동 변경은 설문 주소보다 우선. 회원이 바뀌면 다른 회원의 설정과 좌표를 사용하지 않음. */
export function selectNeighborhood(user: UserLocation | null, settings: LifeSettings, survey: HousingSurvey | null, verify: RegionVerify | null): Neighborhood {
  if (!user) return { region: '', point: null, source: 'none' }
  const selected = settings.regionLocation
  if (selected?.userId === user.id && selected.region === settings.region && selected.region.trim()) {
    return { region: selected.region.trim(), point: readMapPoint(selected.point), source: selected.source }
  }
  // 좌표를 저장하지 않던 기존 인증 기록도 인증한 동네 이름을 우선 사용.
  if (verify?.userId === user.id && verify.region === settings.region && verify.at <= Date.now() && verify.region.trim()) {
    return { region: verify.region.trim(), point: null, source: 'verified' }
  }
  if (survey?.userId === user.id && survey.address.trim()) {
    return { region: survey.address.trim(), point: readMapPoint(survey.addressPoint), source: 'survey' }
  }
  return { region: user.address.trim(), point: null, source: user.address.trim() ? 'account' : 'none' }
}

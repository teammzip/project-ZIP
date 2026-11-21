import { isAxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/store/authStore'
import { selectNeighborhood } from '@/features/life/neighborhood'
import { useLifeStore } from '@/features/life/store'
import { mapApi } from '@/features/map/api'
import { getCurrentMapPosition, readMapPoint } from '@/features/map/location'
import { useHousingSurveyStore } from '@/features/onboarding/store'

export const NEARBY_PROMPT = '장소를 찾을 위치를 선택해 주세요.'
export type NearbyMode = 'current' | 'neighborhood'

const hours = /24\s*시간|24\s*시(?![간장])|심야|야간|늦게까지|밤에\s*갈\s*수\s*있는|지금\s*(?:문\s*)?연(?=\s|$)(?:\s*곳)?|영업\s*중(?:인)?/

export function nearbyQuery(keyword: string) {
  const q = keyword.replace(new RegExp(hours, 'g'), '')
    .trim()
    .replace(/^(?:(?:내\s*)?(?:근처|주변)|가까운)\s*/, '')
    .replace(/\s*(?:찾아\s*줘|검색해\s*줘|알려\s*줘)(?:요)?[?.!]*$/, '')
    .trim()
  return { q, checkHours: hours.test(keyword) }
}

async function registeredLocation(signal: AbortSignal) {
  const { settings, regionVerify } = useLifeStore.getState()
  const { region, point } = selectNeighborhood(useAuthStore.getState().user, settings, useHousingSurveyStore.getState().survey, regionVerify)
  if (!region) throw new Error('마이페이지의 내 정보에서 동네를 설정해 주세요.')
  if (point) return point

  const { resolveWeatherPlace } = await import('@/features/weather/api')
  const place = await resolveWeatherPlace(region, signal).catch(() => {
    signal.throwIfAborted()
    throw new Error('등록한 동네의 위치를 확인하지 못했어요. 내 정보에서 동네를 확인해 주세요.')
  })
  const resolved = readMapPoint({ lat: place.latitude, lon: place.longitude })
  if (!resolved) throw new Error('등록한 동네의 위치를 확인하지 못했어요.')
  return resolved
}

export async function searchNearby(q: string, mode: NearbyMode, signal: AbortSignal) {
  const token = useAuthStore.getState().token
  const point = mode === 'current' ? await getCurrentMapPosition() : await registeredLocation(signal)
  signal.throwIfAborted()
  if (useAuthStore.getState().token !== token) throw new Error('로그인 상태가 바뀌었어요. 다시 검색해 주세요.')
  const places = await mapApi.nearby(q, point, signal).catch((error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new Error('연결된 서버에서 근처 탐색을 사용할 수 없어요. 로컬에서 실행 중이라면 백엔드를 최신 코드로 다시 시작해 주세요.')
    }
    throw error
  })
  if (useAuthStore.getState().token !== token) throw new Error('로그인 상태가 바뀌었어요. 다시 검색해 주세요.')
  return { point, places }
}

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useNeighborhoodLocation } from '@/features/life/useNeighborhoodLocation'
import { readMapPoint } from '@/features/map/location'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { resolveWeatherPlace } from './api'
import { addressWeatherRegion } from './addressRegion'

/** 날씨 위치: 주거 설문에서 고른 주소가 있으면 그 주소, 없거나 못 찾으면 지금처럼 우리 동네(인증 · 가입 주소).
 * 설문 주소는 주소 검색에서 고를 때 좌표도 같이 저장돼서 보통 다시 찾지 않음. 좌표가 없는 예전 설문만 시 · 군 · 구로 좌표를 찾음.
 * 지도는 이 훅을 쓰지 않고 우리 동네 기준 그대로예요. */
export function useWeatherLocation() {
  const neighborhood = useNeighborhoodLocation()
  const userId = useAuthStore((s) => s.user?.id)
  const survey = useHousingSurveyStore((s) => s.survey)
  const own = survey && survey.userId === userId && survey.address.trim() ? survey : null
  const address = own?.address.trim() ?? ''
  const point = own ? readMapPoint(own.addressPoint) : null
  const lookup = addressWeatherRegion(address) || address
  const found = useQuery({
    queryKey: ['weather-place', userId, 'survey', lookup],
    queryFn: ({ signal }) => resolveWeatherPlace(lookup, signal),
    enabled: !!address && !point, staleTime: Infinity, retry: false,
  })
  const finding = found.isPending || found.isFetching
  // 설문 주소의 좌표를 찾지 못하면 동네 기준으로 돌아감 — 날씨가 아예 안 나오는 것보다 나음
  if (address && (point || !found.isError)) {
    return {
      region: address, source: 'survey' as const,
      place: point ? { name: address, latitude: point.lat, longitude: point.lon } : found.data,
      loading: !point && !found.data && finding, error: '',
      retry: () => { if (!point) void found.refetch() },
    }
  }
  return {
    region: neighborhood.region, place: neighborhood.place, source: neighborhood.source,
    loading: neighborhood.loading, error: neighborhood.error, retry: neighborhood.retry,
    surveyFailed: !!address, // 설문 주소가 있는데 좌표를 못 찾음 → 화면에서 안내
  }
}

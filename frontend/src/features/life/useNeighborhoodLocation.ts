import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { selectNeighborhood } from './neighborhood'
import { regionVerification } from './regionVerification'
import { useLifeStore } from './store'

/** 날씨·홈 지도·동네 지도가 공유하는 기준 위치. 일반 조회에서는 GPS를 요청하지 않는다. */
export function useNeighborhoodLocation() {
  const user = useAuthStore((s) => s.user)
  const survey = useHousingSurveyStore((s) => s.survey)
  const settings = useLifeStore((s) => s.settings)
  const verify = useLifeStore((s) => s.regionVerify)
  const selection = selectNeighborhood(user, settings, survey, verify)
  const { region, source } = selection
  const location = useQuery({
    queryKey: ['weather-place', user?.id, region],
    // 날씨 파일(zod 포함)은 좌표를 찾을 때만 받아 옴 → 홈 첫 로딩을 가볍게
    // 회원 주소에 지번 번지('합정동 123-4')가 있으면 못 찾아서, 번지를 뺀 주소 → 시 · 군 · 구 순서로 다시 찾음
    queryFn: async ({ signal }) => {
      const [{ resolveWeatherPlace }, { addressCandidates }] = await Promise.all([import('@/features/weather/api'), import('@/features/weather/addressRegion')])
      let lastError: unknown = new Error('동네를 찾기 어려워요.')
      for (const query of addressCandidates(region)) {
        try {
          return await resolveWeatherPlace(query, signal)
        } catch (error) {
          if (signal.aborted) throw error
          lastError = error
        }
      }
      throw lastError
    },
    enabled: !!region && !selection.point, staleTime: Infinity, retry: false,
  })
  const place = selection.point ? { name: region, latitude: selection.point.lat, longitude: selection.point.lon } : location.data
  const point = region && place ? { lat: place.latitude, lon: place.longitude } : null
  const verified = regionVerification(settings.region, verify, user?.id).verified
  return {
    region, source, place, point,
    verifiedPoint: source === 'verified' && selection.point && verified ? point : null,
    verifiedAt: source === 'verified' && verify?.userId === user?.id ? verify?.at : undefined,
    loading: !!region && !place && (location.isPending || location.isFetching),
    error: !region ? '설문 또는 내 정보에서 우리 동네를 설정해 주세요.' : !selection.point && location.error instanceof Error ? location.error.message : '',
    retry: () => { if (region && !selection.point) void location.refetch() },
  }
}

import { useQuery } from '@tanstack/react-query'
import { useLifeStore } from '@/features/life/store'
import { resolveWeatherPlace } from '@/features/weather/api'

/** 날씨와 같은 주소·좌표 캐시를 사용한다. GPS는 동네 인증 시에만 요청한다. */
export function useNeighborhoodPosition() {
  const region = useLifeStore((s) => s.settings.region.trim())
  const location = useQuery({
    queryKey: ['weather-place', region],
    queryFn: ({ signal }) => resolveWeatherPlace(region, signal),
    enabled: !!region, staleTime: Infinity, retry: false,
  })
  return {
    point: region && location.data ? { lat: location.data.latitude, lon: location.data.longitude } : null,
    loading: location.isFetching,
    error: !region ? '내 정보에서 우리 동네를 설정해 주세요.' : location.error instanceof Error ? location.error.message : '',
    retry: () => { if (region) void location.refetch() },
  }
}

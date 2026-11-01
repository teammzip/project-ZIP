import { useNeighborhoodLocation } from '@/features/life/useNeighborhoodLocation'

/** 날씨와 같은 주소·좌표 캐시를 사용한다. GPS는 동네 인증 시에만 요청한다. */
export function useNeighborhoodPosition() {
  return useNeighborhoodLocation()
}

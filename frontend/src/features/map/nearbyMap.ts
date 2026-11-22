import { create } from 'zustand'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { NearbyPlace } from './api'
import type { PlaceItem } from './data/places'
import { readMapPoint, type MapPoint } from './location'

export type NearbyMapResult = {
  query: string
  origin: { point: MapPoint; label: '현재 위치' | '등록한 동네' }
  places: Array<PlaceItem & { distanceMeters: number }>
  checkHours: boolean
}

type NearbyMapEntry = NearbyMapResult & { id: string }

// 검색 기준점과 결과는 이 탭의 메모리에만 보관한다. 라우터에는 조회 번호만 넘긴다.
export const useNearbyMap = create<{ result: NearbyMapEntry | null }>(() => ({ result: null }))

let nextId = 0
export function showNearbyOnMap(result: NearbyMapResult) {
  const id = `${Date.now()}-${++nextId}`
  useNearbyMap.setState({ result: { ...result, id } })
  return id
}

useAuthStore.subscribe((next, previous) => {
  if (next.sessionKey !== previous.sessionKey) useNearbyMap.setState({ result: null })
})

export function nearbyMapPlaces(places: NearbyPlace[]): NearbyMapResult['places'] {
  return places.flatMap((place) => {
    const point = readMapPoint(place)
    return point && /^\d+$/.test(place.id) ? [{
      ...point, id: `kakao:${place.id}`, n: place.name, d: place.address ?? '',
      cat: place.category || '기타', distanceMeters: place.distanceMeters,
    }] : []
  })
}

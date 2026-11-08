import { apiClient } from '@/lib/apiClient'
import type { PlaceItem } from './data/places'

/* 지도 서버 API (backend/openapi.yaml "지도" 태그). VITE_USE_MOCK=false 일 때만 씀 */

export type ServerPlace = {
  id: string
  category: string
  name: string
  description: string
  lat: number
  lon: number
  walkMin: number
  address: string | null
  phone: string | null
  openHours: string | null
  rating: number | null
  reviewCount: number
}

export type MapSettings = { categories: string[]; keywords: string[] }

/** 서버 장소 → 화면이 쓰는 모양 (즐겨찾기 번호는 서버의 장소 id) */
export const toPlaceItem = (p: ServerPlace): PlaceItem => ({ id: p.id, cat: p.category, n: p.name, d: p.description, lat: p.lat, lon: p.lon, walk: p.walkMin })

export const mapApi = {
  categories: async () => (await apiClient.get<Array<{ id: string; name: string; icon: string }>>('/places/categories')).data,
  /** category · q 가 있고 서버에 카카오 키가 있으면 카카오에서 지도 중심(lat · lon) 근처를 찾아 줌. 둘 다 없으면 DB 에 있는 동네 장소.
   * wide: 검색창 검색 — 근처 + 거리 제한 없는 정확도 검색을 합쳐 이름이 맞는 곳부터 (예: 롯데월드, 경복궁) */
  places: async (regionId: string, opts: { category?: string; q?: string; lat?: number; lon?: number; wide?: boolean } = {}) =>
    (await apiClient.get<ServerPlace[]>('/places', { params: { regionId, ...opts } })).data.map(toPlaceItem),
  aiSearch: async (q: string, regionId: string) =>
    (await apiClient.post<Array<{ place: ServerPlace; reasons: string[] }>>('/places/ai-search', { q, regionId })).data.map((r) => ({ p: toPlaceItem(r.place), why: r.reasons })),
  favorites: async () => (await apiClient.get<string[]>('/me/place-favorites')).data,
  addFavorite: (placeId: string) => apiClient.put(`/me/place-favorites/${encodeURIComponent(placeId)}`),
  removeFavorite: (placeId: string) => apiClient.delete(`/me/place-favorites/${encodeURIComponent(placeId)}`),
  settings: async () => (await apiClient.get<MapSettings>('/me/map-settings')).data,
  saveSettings: async (settings: MapSettings) => (await apiClient.put<MapSettings>('/me/map-settings', settings)).data,
}

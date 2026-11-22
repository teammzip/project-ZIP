import { create } from 'zustand'
import { apiClient } from '@/lib/apiClient'
import type { PlaceItem } from './data/places'
import type { PlaceList } from './store'
import type { MapPoint } from './location'

/** 카카오 검색 장소의 id ("kakao:카카오장소id"). 장소 정보는 서버 DB 에 없어서 저장 · 리뷰 때 이름을 같이 보내요 */
export const isKakaoPlace = (id: string) => id.startsWith('kakao:')

/** 서버가 카카오 대신 DB 장소를 준 이유 (응답 헤더 X-Place-Notice) → 화면 안내 문구 */
const PLACE_NOTICES: Record<string, string> = {
  'user-limit': '검색을 너무 자주 했어요. 1분 뒤에 다시 찾아 주세요. 지금은 저장된 장소만 보여 드려요.',
  'daily-limit': '오늘 장소 검색 한도에 도달했어요. 내일 다시 찾을 수 있어요. 지금은 저장된 장소만 보여 드려요.',
  error: '장소 검색이 잠시 안 돼요. 지금은 저장된 장소만 보여 드려요.',
}
export const usePlaceNotice = create<{ notice: string }>(() => ({ notice: '' }))

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
export type NearbyPlace = MapPoint & { id: string; name: string; address: string | null; distanceMeters: number; category: string }

/** 서버 장소 → 화면이 쓰는 모양 (즐겨찾기 번호는 서버의 장소 id) */
export const toPlaceItem = (p: ServerPlace): PlaceItem => ({ id: p.id, cat: p.category, n: p.name, d: p.description, lat: p.lat, lon: p.lon, walk: p.walkMin })

export const mapApi = {
  categories: async () => (await apiClient.get<Array<{ id: string; name: string; icon: string }>>('/places/categories')).data,
  /** category · q 가 있고 서버에 카카오 키가 있으면 카카오에서 지도 중심(lat · lon) 근처를 찾아 줌. 둘 다 없으면 DB 에 있는 동네 장소.
   * wide: 검색창 검색 — 근처 + 거리 제한 없는 정확도 검색을 합쳐 이름이 맞는 곳부터 (예: 롯데월드, 경복궁) */
  places: async (regionId: string, opts: { category?: string; q?: string; lat?: number; lon?: number; wide?: boolean } = {}, signal?: AbortSignal) => {
    const res = await apiClient.get<ServerPlace[]>('/places', { params: { regionId, ...opts }, signal })
    // 카카오를 부르는 요청(종류 · 검색어)만 안내를 바꿈. 한도에 걸리면 서버가 DB 장소로 대신하고 이유를 헤더로 알려 줘요
    if (opts.category || opts.q) {
      const code = res.headers['x-place-notice'] as string | undefined
      usePlaceNotice.setState({ notice: code ? (PLACE_NOTICES[code] ?? PLACE_NOTICES.error) : '' })
    }
    return res.data.map(toPlaceItem)
  },
  aiSearch: async (q: string, regionId: string, signal?: AbortSignal) =>
    (await apiClient.post<Array<{ place: ServerPlace; reasons: string[] }>>('/places/ai-search', { q, regionId }, { signal })).data.map((r) => ({ p: toPlaceItem(r.place), why: r.reasons })),
  nearby: async (q: string, point: MapPoint, signal: AbortSignal) =>
    (await apiClient.post<NearbyPlace[]>('/places/nearby', { q, lat: point.lat, lon: point.lon }, { signal })).data,
  favorites: async () => (await apiClient.get<string[]>('/me/place-favorites')).data,
  /** 카카오 장소는 { name, category } 를 같이 보냄 (서버는 id · 이름만 저장) */
  addFavorite: (placeId: string, meta?: { n: string; cat: string }) =>
    apiClient.put(`/me/place-favorites/${encodeURIComponent(placeId)}`, meta ? { name: meta.n, category: meta.cat } : undefined),
  kakaoFavorites: async () =>
    Object.fromEntries((await apiClient.get<Array<{ id: string; name: string; category: string }>>('/me/place-favorites/kakao')).data.map((f) => [f.id, { n: f.name, cat: f.category }])),
  removeFavorite: (placeId: string) => apiClient.delete(`/me/place-favorites/${encodeURIComponent(placeId)}`),
  /** 저장 리스트 (처음이면 서버가 "내 장소"를 만들어 줌) */
  placeLists: async () => (await apiClient.get<PlaceList[]>('/me/place-lists')).data,
  createPlaceList: async (name: string, color: string) => (await apiClient.post<PlaceList>('/me/place-lists', { name, color })).data,
  /** 리스트 삭제: 이 리스트에만 있던 장소는 저장도 풀림 */
  deletePlaceList: (listId: string) => apiClient.delete(`/me/place-lists/${encodeURIComponent(listId)}`),
  /** ★ 저장 창의 [저장]: 이 장소를 넣을 리스트들 (비우면 저장 풂). 카카오 장소는 이름 · 종류도 */
  setPlaceLists: (placeId: string, listIds: string[], meta?: { n: string; cat: string }) =>
    apiClient.put(`/me/place-favorites/${encodeURIComponent(placeId)}/lists`, { listIds, ...(meta ? { name: meta.n, category: meta.cat } : {}) }),
  settings: async () => (await apiClient.get<MapSettings>('/me/map-settings')).data,
  saveSettings: async (settings: MapSettings) => (await apiClient.put<MapSettings>('/me/map-settings', settings)).data,
}

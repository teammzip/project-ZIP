import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isMockApi, useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { mapApi } from './api'
import { ALL_PLACES, PLACE_KINDS, type PlaceItem } from './data/places'
import { useMapStore } from './store'

export type MapData = {
  places: PlaceItem[]
  kinds: string[]
  /** true 면 서버(DB) 장소, false 면 예시 데이터 */
  server: boolean
  /** 서버 AI 찾기 · 장소 목록에 보낼 동네 번호 (내 정보의 region) */
  regionId: string | null
  loading: boolean
  error: string
}

const DEMO: MapData = { places: ALL_PLACES, kinds: PLACE_KINDS, server: false, regionId: null, loading: false, error: '' }

/** 지도 화면이 쓰는 장소 · 종류. 가짜 API 모드면 예시 데이터, VITE_USE_MOCK=false 면 서버에서 받아 옴.
 * 서버 모드: DB 에 있는 동네 장소 + 켜 둔 종류 칩 · 직접 검색어마다 지도 중심(center) 근처 장소(서버가 카카오에서 찾음) */
export function useMapData(center?: { lat: number; lon: number } | null): MapData {
  const regionId = useAuthStore((s) => s.user?.region?.id ?? null)
  const on = useMapStore((s) => s.on)
  const custom = useMapStore((s) => s.custom)
  const enabled = !isMockApi && !!regionId
  const point = center ? { lat: Number(center.lat.toFixed(5)), lon: Number(center.lon.toFixed(5)) } : {}
  const kinds = useQuery({ queryKey: ['map', 'categories'], queryFn: mapApi.categories, enabled: !isMockApi, staleTime: Infinity })
  const stored = useQuery({ queryKey: ['map', 'places', regionId], queryFn: () => mapApi.places(regionId!), enabled, staleTime: 60_000 })
  const searches = [...on.map((category) => ({ category })), ...custom.map((q) => ({ q }))]
  const nearby = useQueries({
    queries: searches.map((search) => ({
      queryKey: ['map', 'places', regionId, search, point],
      queryFn: () => mapApi.places(regionId!, { ...search, ...point }),
      enabled: enabled && !!center,
      staleTime: 5 * 60_000,
    })),
  })
  if (isMockApi) return DEMO
  // 같은 장소는 한 번만 (나중에 받은 최신 정보로)
  const byId = new Map<string, PlaceItem>()
  for (const list of [stored.data, ...nearby.map((q) => q.data)]) for (const p of list ?? []) byId.set(p.id, p)
  const failed = kinds.error ?? stored.error ?? nearby.find((q) => q.error)?.error
  return {
    places: [...byId.values()],
    // '기타'는 검색 결과용 종류라 칩 · 종류 편집에는 안 보임
    kinds: kinds.data?.map((k) => k.name).filter((name) => name !== '기타') ?? [],
    server: true,
    regionId,
    loading: kinds.isPending || (enabled && (stored.isPending || nearby.some((q) => q.isPending && q.fetchStatus !== 'idle'))),
    error: !regionId ? '내 정보에 동네(region)가 없어서 서버 장소를 불러올 수 없어요.' : failed ? getErrorMessage(failed) : '',
  }
}

/** 서버 모드일 때 지도 설정(칩 · 검색어) · 즐겨찾기를 서버와 맞춤: 들어올 때 서버 값을 받고, 바뀌면 서버에 저장.
 * 저장이 실패하면 서버 값을 다시 받아 화면을 되돌려요. 지도 화면(MapView) 한 곳에서만 부르세요. */
export function useMapServerSync() {
  const userId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (isMockApi || !userId) return
    let ready = false
    let alive = true
    const pull = () =>
      Promise.all([mapApi.settings(), mapApi.favorites()])
        .then(([settings, favs]) => {
          if (!alive) return
          ready = false
          useMapStore.setState({ on: settings.categories, custom: settings.keywords, favs })
          ready = true
        })
        .catch(() => {
          ready = true // 서버를 못 읽으면 이 기기 값으로 계속
        })
    void pull()
    const unsubscribe = useMapStore.subscribe((now, before) => {
      if (!ready) return
      if (now.on !== before.on || now.custom !== before.custom) mapApi.saveSettings({ categories: now.on, keywords: now.custom }).catch(pull)
      if (now.favs !== before.favs) {
        for (const id of now.favs) if (!before.favs.includes(id)) mapApi.addFavorite(id).catch(pull)
        for (const id of before.favs) if (!now.favs.includes(id)) mapApi.removeFavorite(id).catch(pull)
      }
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [userId])
}

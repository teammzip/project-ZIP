import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_CATS, PLACES } from './data/places'
import { isKakaoPlace } from './kakaoPlaceId'

export type FavName = { n: string; cat: string }

/** 저장 리스트 (★ 저장 창에서 고르는 내 장소 묶음: 내 장소 · 맛집 …). placeIds = 이 리스트에 넣은 장소 id */
export type PlaceList = { id: string; name: string; color: string; placeIds: string[] }

export const DEFAULT_LIST = { name: '내 장소', color: '#03c75a' }
/** 새 리스트 색 고르기 */
export const LIST_COLORS = ['#03c75a', '#ff8fa3', '#ff5a7e', '#ff9500', '#2f80ed', '#7c6cf5']

/* 지도 설정 (localStorage 'zip-map'): 칩에 보이는 종류, 직접 추가한 검색어, 즐겨찾기한 장소 번호("종류:이름") */
type MapState = {
  on: string[]
  custom: string[]
  favs: string[]
  toggleCat: (cat: string) => void
  /** 꺼져 있던 종류면 켬 (AI 화면의 "지도에서 보기" 등) */
  ensureCat: (cat: string) => void
  addCustom: (kw: string) => boolean
  removeCustom: (kw: string) => void
  resetCats: () => void
  /** 저장한 카카오 장소의 이름 · 종류 (id → { n, cat }). 저장 목록에 보이려고 둠. 주소 · 좌표는 없음 */
  favNames: Record<string, FavName>
  /** 카카오 장소는 meta(이름 · 종류)를 같이 넘겨요 — 서버에 id · 이름만 저장 */
  toggleFav: (id: string, meta?: FavName) => void
  /** 저장 리스트 (서버 모드는 서버 값, 가짜 API 모드는 이 브라우저) */
  lists: PlaceList[]
  /** 가짜 API 모드: 리스트가 없으면 "내 장소"를 만들고, 리스트에 안 든 저장 장소를 첫 리스트에 넣음 */
  ensureDefaultList: () => void
  /** 가짜 API 모드: 새 리스트 */
  addListLocal: (name: string, color: string) => PlaceList | null
  /** 가짜 API 모드: 리스트 삭제 (이 리스트에만 있던 장소는 저장도 풂) */
  deleteListLocal: (listId: string) => void
  /** 가짜 API 모드: 이 장소를 고른 리스트들에 넣음 (비우면 저장 풂) */
  setPlaceListsLocal: (place: { id: string } & FavName, listIds: string[]) => void
  /** 데이터 초기화: 종류 · 즐겨찾기 모두 처음으로 */
  resetAll: () => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      on: DEFAULT_CATS,
      custom: [],
      favs: [],
      favNames: {},
      lists: [],
      ensureDefaultList: () =>
        set((s) => {
          const lists = s.lists.length ? s.lists : [{ id: 'local-default', ...DEFAULT_LIST, placeIds: [] }]
          const listed = new Set(lists.flatMap((l) => l.placeIds))
          const orphans = s.favs.filter((id) => !listed.has(id))
          if (!orphans.length && lists === s.lists) return s
          return { lists: lists.map((l, i) => (i === 0 ? { ...l, placeIds: [...l.placeIds, ...orphans] } : l)) }
        }),
      addListLocal: (name, color) => {
        const n = name.trim()
        if (!n || get().lists.some((l) => l.name === n)) return null
        const list = { id: `local-${Date.now()}`, name: n, color, placeIds: [] }
        set((s) => ({ lists: [...s.lists, list] }))
        return list
      },
      deleteListLocal: (listId) =>
        set((s) => {
          const lists = s.lists.filter((l) => l.id !== listId)
          const listed = new Set(lists.flatMap((l) => l.placeIds))
          const favs = s.favs.filter((id) => listed.has(id))
          const favNames = Object.fromEntries(Object.entries(s.favNames).filter(([id]) => listed.has(id)))
          return { lists, favs, favNames }
        }),
      setPlaceListsLocal: (place, listIds) =>
        set((s) => {
          const lists = s.lists.map((l) => {
            const has = l.placeIds.includes(place.id)
            const want = listIds.includes(l.id)
            if (has === want) return l
            return { ...l, placeIds: want ? [...l.placeIds, place.id] : l.placeIds.filter((x) => x !== place.id) }
          })
          if (!listIds.length) {
            const { [place.id]: _removed, ...favNames } = s.favNames
            return { lists, favs: s.favs.filter((x) => x !== place.id), favNames }
          }
          return {
            lists,
            favs: s.favs.includes(place.id) ? s.favs : [...s.favs, place.id],
            favNames: isKakaoPlace(place.id) ? { ...s.favNames, [place.id]: { n: place.n, cat: place.cat } } : s.favNames,
          }
        }),
      toggleCat: (cat) => set((s) => ({ on: s.on.includes(cat) ? s.on.filter((c) => c !== cat) : [...s.on, cat] })),
      ensureCat: (cat) => {
        if (PLACES[cat] && !get().on.includes(cat)) set((s) => ({ on: [...s.on, cat] }))
      },
      addCustom: (kw) => {
        const k = kw.trim()
        if (!k || get().custom.includes(k) || PLACES[k]) return false
        set((s) => ({ custom: [...s.custom, k] }))
        return true
      },
      removeCustom: (kw) => set((s) => ({ custom: s.custom.filter((x) => x !== kw) })),
      resetCats: () => set({ on: DEFAULT_CATS, custom: [] }),
      resetAll: () => set({ on: DEFAULT_CATS, custom: [], favs: [], favNames: {}, lists: [] }),
      toggleFav: (id, meta) =>
        set((s) => {
          if (s.favs.includes(id)) {
            const { [id]: _removed, ...favNames } = s.favNames
            return { favs: s.favs.filter((x) => x !== id), favNames }
          }
          return { favs: [...s.favs, id], favNames: meta ? { ...s.favNames, [id]: meta } : s.favNames }
        }),
    }),
    { name: 'zip-map', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

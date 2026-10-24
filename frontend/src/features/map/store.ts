import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_CATS, PLACES } from './data/places'

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
  toggleFav: (id: string) => void
  /** 데이터 초기화: 종류 · 즐겨찾기 모두 처음으로 */
  resetAll: () => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      on: DEFAULT_CATS,
      custom: [],
      favs: [],
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
      resetAll: () => set({ on: DEFAULT_CATS, custom: [], favs: [] }),
      toggleFav: (id) => set((s) => ({ favs: s.favs.includes(id) ? s.favs.filter((x) => x !== id) : [...s.favs, id] })),
    }),
    { name: 'zip-map', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

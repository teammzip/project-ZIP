import { create } from 'zustand'
import { isMockApi } from '@/features/auth'
import { useMapStore, type FavName } from './store'

/* ★ 저장 창 (어느 장소를 저장하려는지) · 저장 직후 안내 문구. 지도 화면 여러 곳(목록 · 상세 · 저장 탭)에서 씀 */

export type SaveTarget = { id: string } & FavName

export const useSaveSheet = create<{ target: SaveTarget | null }>(() => ({ target: null }))
export const openSaveSheet = (target: SaveTarget) => {
  // 가짜 API 모드: 리스트가 없으면 "내 장소"를 먼저 만들어 둠 (서버 모드는 서버가 만들어 줌)
  if (isMockApi) useMapStore.getState().ensureDefaultList()
  useSaveSheet.setState({ target })
}
export const closeSaveSheet = () => useSaveSheet.setState({ target: null })

/** 저장 · 취소 직후 패널 위에 잠깐 보이는 안내 */
export const useFavNote = create<{ note: string }>(() => ({ note: '' }))
let favNoteTimer: ReturnType<typeof setTimeout> | undefined
export const showFavNote = (note: string) => {
  useFavNote.setState({ note })
  clearTimeout(favNoteTimer)
  favNoteTimer = setTimeout(() => useFavNote.setState({ note: '' }), 3500)
}

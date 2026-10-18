import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/* ---------- 첨부한 사진 (사진 화면 → AI 화면으로 넘김, 저장하지 않음) ---------- */

type PhotoState = {
  photoUrl: string | null
  setPhoto: (file: File) => void
  clearPhoto: () => void
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photoUrl: null,
  setPhoto: (file) => {
    const prev = get().photoUrl
    if (prev) URL.revokeObjectURL(prev)
    set({ photoUrl: URL.createObjectURL(file) })
  },
  clearPhoto: () => {
    const prev = get().photoUrl
    if (prev) URL.revokeObjectURL(prev)
    set({ photoUrl: null })
  },
}))

/* ---------- 홈 "AI와 대화" 대화 기록 (localStorage 'zip-ai-chat', 최근 40개) ---------- */

/** 지출 요약 카드: 보낸 그때의 숫자를 담아 둠 */
export type SpendCard = {
  month: number
  total: number
  prevTotal: number
  fixed: number
  rows: Array<[string, number]>
  top: [string, number] | null
}

export type ChatMsg = { role: 'bot' | 'user'; text: string; card?: SpendCard }

export const GREETING = '안녕하세요! 자취하면서 궁금한 걸 편하게 물어보세요. 😊\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금, 이번 달 지출 요약까지 도와드려요.'
const MAX = 40

type ChatState = {
  msgs: ChatMsg[]
  push: (m: ChatMsg) => void
  reset: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      msgs: [{ role: 'bot', text: GREETING }],
      push: (m) => set((s) => ({ msgs: [...s.msgs, m].slice(-MAX) })),
      reset: () => set({ msgs: [{ role: 'bot', text: GREETING }] }),
    }),
    { name: 'zip-ai-chat', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

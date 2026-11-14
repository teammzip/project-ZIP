import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAccountStorage } from '@/lib/accountStorage'
import type { Memo } from './types'

/* 메모장 (회원별 localStorage 'zip-memos:user:<id>'). 처음에는 비어 있고, 쓰는 대로 바로 저장. 데이터 초기화 · 회원 탈퇴 때 reset */
export const HOME_MAX = 3
type MemoState = {
  memos: Memo[]
  /** 홈 위젯에 보여 줄 메모 id (최대 3개, 이 순서로). null 이면 자동(고정 → 최근 수정 순 3개) */
  homeIds: number[] | null
  setHomeIds: (ids: number[] | null) => void
  /** 새 메모를 만들고 id 를 돌려줌. toHome: 홈 빠른 메모 — 직접 고른 상태에서 자리가 남으면 홈에도 보여 줌 */
  add: (body?: string, toHome?: boolean) => number
  update: (id: number, patch: Partial<Memo>) => void
  remove: (id: number) => void
  reset: () => void
}

const account = createAccountStorage<MemoState>('zip-memos')

export const useMemoStore = create<MemoState>()(
  persist(
    (set) => ({
      memos: [],
      homeIds: null,
      setHomeIds: (ids) => set({ homeIds: ids ? ids.slice(0, HOME_MAX) : null }),
      add: (body = '', toHome = false) => {
        const now = Date.now()
        const memo: Memo = { id: now, title: '', body, color: '노랑', pinned: false, checklist: false, items: [], createdAt: now, updatedAt: now }
        set((s) => ({ memos: [...s.memos, memo], homeIds: toHome && s.homeIds && s.homeIds.length < HOME_MAX ? [...s.homeIds, now] : s.homeIds }))
        return now
      },
      update: (id, patch) => set((s) => ({ memos: s.memos.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)) })),
      remove: (id) => set((s) => ({ memos: s.memos.filter((m) => m.id !== id), homeIds: s.homeIds?.filter((x) => x !== id) ?? null })),
      reset: () => set({ memos: [], homeIds: null }),
    }),
    {
      name: 'zip-memos',
      storage: account.storage,
      version: 2,
      // v1 → v2: 예전에 처음부터 들어 있던 예시 메모 2개("장보기", "관리비 문의할 것")를 지움 (직접 쓴 메모는 그대로)
      migrate: (saved, version) => {
        const s = (saved ?? {}) as { memos?: Memo[] }
        if (version < 2 && Array.isArray(s.memos)) {
          s.memos = s.memos.filter((m) =>
            !(m.title === '장보기' && m.checklist && m.items.length === 4 && m.items[0]?.text === '두부')
            && !(m.title === '관리비 문의할 것' && m.body.startsWith('11월 관리비에 엘리베이터 수리비')))
        }
        return s as MemoState
      },
    },
  ),
)

account.bind(() => useMemoStore.setState({ memos: [], homeIds: null }), () => useMemoStore.persist.rehydrate())

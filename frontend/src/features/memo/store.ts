import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Memo } from './types'

/* 메모장 (localStorage 'zip-memos'). 쓰는 대로 바로 저장. 데이터 초기화 · 회원 탈퇴 때 reset */
function seed(): Memo[] {
  const now = Date.now()
  return [
    {
      id: now - 2,
      title: '장보기',
      body: '',
      color: '노랑',
      pinned: true,
      checklist: true,
      items: [
        { text: '두부', done: false },
        { text: '계란 한 판', done: true },
        { text: '키친타월', done: false },
        { text: '방울토마토', done: false },
      ],
      createdAt: now - 86400000,
      updatedAt: now - 3600000,
    },
    {
      id: now - 1,
      title: '관리비 문의할 것',
      body: '11월 관리비에 엘리베이터 수리비 포함인지 확인하기\n관리사무소 평일 9시 ~ 6시',
      color: '분홍',
      pinned: false,
      checklist: false,
      items: [],
      createdAt: now - 172800000,
      updatedAt: now - 7200000,
    },
  ]
}

type MemoState = {
  memos: Memo[]
  /** 새 메모를 만들고 id 를 돌려줌 */
  add: (body?: string) => number
  update: (id: number, patch: Partial<Memo>) => void
  remove: (id: number) => void
  reset: () => void
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set) => ({
      memos: seed(),
      add: (body = '') => {
        const now = Date.now()
        const memo: Memo = { id: now, title: '', body, color: '노랑', pinned: false, checklist: false, items: [], createdAt: now, updatedAt: now }
        set((s) => ({ memos: [...s.memos, memo] }))
        return now
      },
      update: (id, patch) => set((s) => ({ memos: s.memos.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)) })),
      remove: (id) => set((s) => ({ memos: s.memos.filter((m) => m.id !== id) })),
      reset: () => set({ memos: seed() }),
    }),
    { name: 'zip-memos', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

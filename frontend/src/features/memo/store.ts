import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Memo } from './types'

/* 메모장 (localStorage 'zip-memos'). 쓰는 대로 바로 저장. 데이터 초기화 · 회원 탈퇴 때 reset */
export const HOME_MAX = 3
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
  /** 홈 위젯에 보여 줄 메모 id (최대 3개, 이 순서로). null 이면 자동(고정 → 최근 수정 순 3개) */
  homeIds: number[] | null
  setHomeIds: (ids: number[] | null) => void
  /** 새 메모를 만들고 id 를 돌려줌. toHome: 홈 빠른 메모 — 직접 고른 상태에서 자리가 남으면 홈에도 보여 줌 */
  add: (body?: string, toHome?: boolean) => number
  update: (id: number, patch: Partial<Memo>) => void
  remove: (id: number) => void
  reset: () => void
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set) => ({
      memos: seed(),
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
      reset: () => set({ memos: seed(), homeIds: null }),
    }),
    { name: 'zip-memos', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

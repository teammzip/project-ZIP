import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { monthKeyOf } from '@/lib/date'
import { seedBills, seedEvents, seedIncomes, seedSpends, todosToEvents } from './data/seed'
import { UNCATEGORIZED, defaultCategories } from './data/presets'
import type { Bill, CalEvent, CustomPreset, EventCategory, LifeSettings, MoneyRecord } from './types'

/* 생활 관리 데이터(일정·공과금·월세·수입·지출·알림 읽음·설정)를 한곳에서 들고 있음.
 * 아직 서버가 없어서 이 브라우저(localStorage 'zip-life')에만 저장됩니다.
 * 백엔드가 생기면 이 파일의 동작들을 API 호출(features/life/api)로 바꾸면 화면 코드는 그대로 둘 수 있어요. */

type LifeData = {
  bills: Bill[]
  events: CalEvent[]
  incomes: MoneyRecord[]
  spends: MoneyRecord[]
  /** 'YYYY-MM' → 그 달 월세 냈는지 */
  rentPaid: Record<string, boolean>
  /** 알림 id → 읽었는지 */
  notiRead: Record<string, boolean>
  /** 지운 알림 id (읽은 알림을 삭제하면 여기에 담겨 목록에서 빠짐) */
  notiDeleted: Record<string, boolean>
  settings: LifeSettings
  /** 일정 카테고리 (기본 5개 + 미분류, 사용자가 이름 변경 · 추가 · 삭제) */
  categories: EventCategory[]
  /** 사용자가 직접 만든 항목 버튼 */
  customPresets: CustomPreset[]
}

type LifeActions = {
  addBill: (name: string, amount: number) => void
  toggleBill: (id: number, paid: boolean) => void
  removeBill: (id: number) => void
  resetBills: () => void

  setRentPaid: (monthKey: string, paid: boolean) => void

  addEvent: (ev: Omit<CalEvent, 'id'>) => void
  updateEvent: (ev: CalEvent) => void
  /** 할 일처럼 완료 체크 */
  toggleEvent: (id: CalEvent['id'], done: boolean) => void
  removeEvent: (id: CalEvent['id']) => void

  addIncome: (r: Omit<MoneyRecord, 'id'>) => void
  removeIncome: (id: number) => void
  addSpend: (r: Omit<MoneyRecord, 'id'>) => void
  removeSpend: (id: number) => void

  /** 카테고리 관리: 실패하면 이유 문장, 성공하면 null */
  addCategory: (name: string) => string | null
  renameCategory: (from: string, to: string) => string | null
  /** 삭제한 카테고리의 항목 · 일정은 미분류로 */
  deleteCategory: (name: string) => string | null
  addPreset: (title: string, category: string) => void
  updatePreset: (id: string, title: string, category: string) => void
  removePreset: (id: string) => void

  markRead: (ids: string[]) => void
  /** 알림 지우기 (읽은 알림 정리) */
  deleteNotis: (ids: string[]) => void
  saveSettings: (s: LifeSettings) => void
  /** 모든 기록을 처음 상태(예시 데이터)로 되돌림 */
  reset: () => void
}

const initial = (): LifeData => ({
  bills: seedBills(),
  events: seedEvents(),
  incomes: seedIncomes(),
  spends: seedSpends(),
  rentPaid: {},
  notiRead: {},
  notiDeleted: {},
  settings: defaultSettings(),
  categories: defaultCategories(),
  customPresets: [],
})

/** 기본 설정 (입주 8개월 전, 계약 14개월 뒤는 기존 시안의 예시 값) */
function defaultSettings(): LifeSettings {
  const now = new Date()
  return {
    region: '서울 마포구',
    rentDay: 15,
    rent: 55,
    notiOn: true,
    moveIn: monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 8, 1)),
    contractEnd: monthKeyOf(new Date(now.getFullYear(), now.getMonth() + 14, 1)),
  }
}

const newId = () => Date.now() + Math.floor(Math.random() * 1000)

/** 카테고리 이름이 바뀌거나 없어지면 그 카테고리의 항목 · 일정도 같이 옮김 */
function moveCategory(s: LifeData, from: string, to: string, extra: Partial<LifeData>): Partial<LifeData> {
  return {
    ...extra,
    customPresets: s.customPresets.map((p) => (p.category === from ? { ...p, category: to } : p)),
    events: s.events.map((e) => (e.category === from ? { ...e, category: to } : e)),
  }
}

export const useLifeStore = create<LifeData & LifeActions>()(
  persist(
    (set, get) => ({
      ...initial(),

      addBill: (name, amount) => set((s) => ({ bills: [...s.bills, { id: newId(), name, amount, paid: false }] })),
      toggleBill: (id, paid) => set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, paid } : b)) })),
      removeBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),
      resetBills: () => set((s) => ({ bills: s.bills.map((b) => ({ ...b, paid: false })) })),

      setRentPaid: (key, paid) => set((s) => ({ rentPaid: { ...s.rentPaid, [key]: paid } })),

      addEvent: (ev) => set((s) => ({ events: [...s.events, { done: false, ...ev, id: newId() }] })),
      toggleEvent: (id, done) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, done } : e)) })),
      updateEvent: (ev) => set((s) => ({ events: s.events.map((e) => (e.id === ev.id ? ev : e)) })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addIncome: (r) => set((s) => ({ incomes: [...s.incomes, { ...r, id: newId() }] })),
      removeIncome: (id) => set((s) => ({ incomes: s.incomes.filter((r) => r.id !== id) })),
      addSpend: (r) => set((s) => ({ spends: [...s.spends, { ...r, id: newId() }] })),
      removeSpend: (id) => set((s) => ({ spends: s.spends.filter((r) => r.id !== id) })),

      addCategory: (name) => {
        const n = name.trim()
        if (!n) return '추가할 이름을 적어 주세요.'
        if (get().categories.some((c) => c.name === n)) return '같은 이름의 카테고리가 이미 있어요.'
        const cats = get().categories
        set({ categories: [...cats.slice(0, -1), { name: n, ico: '🏷️', items: [] }, cats[cats.length - 1]] }) // 미분류는 늘 맨 끝
        return null
      },
      renameCategory: (from, to) => {
        const n = to.trim()
        if (from === UNCATEGORIZED) return '미분류는 이름을 바꿀 수 없어요.'
        if (!n) return '새 이름을 적어 주세요.'
        if (get().categories.some((c) => c.name === n)) return '같은 이름의 카테고리가 이미 있어요.'
        set((s) => moveCategory(s, from, n, { categories: s.categories.map((c) => (c.name === from ? { ...c, name: n } : c)) }))
        return null
      },
      deleteCategory: (name) => {
        if (name === UNCATEGORIZED) return '미분류는 삭제할 수 없어요.'
        set((s) => moveCategory(s, name, UNCATEGORIZED, { categories: s.categories.filter((c) => c.name !== name) }))
        return null
      },
      addPreset: (title, category) => set((s) => ({ customPresets: [...s.customPresets, { id: crypto.randomUUID(), title, category }] })),
      updatePreset: (id, title, category) => set((s) => ({ customPresets: s.customPresets.map((p) => (p.id === id ? { ...p, title, category } : p)) })),
      removePreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),

      markRead: (ids) => set((s) => ({ notiRead: { ...s.notiRead, ...Object.fromEntries(ids.map((id) => [id, true])) } })),
      deleteNotis: (ids) => set((s) => ({ notiDeleted: { ...s.notiDeleted, ...Object.fromEntries(ids.map((id) => [id, true])) } })),
      saveSettings: (settings) => set({ settings }),
      reset: () => set(initial()),
    }),
    {
      name: 'zip-life',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      // v1 → v2: 따로 저장하던 할 일(todos)을 오늘 날짜 일정으로 옮김
      migrate: (saved, version) => {
        const s = (saved ?? {}) as Partial<LifeData> & { todos?: Array<{ id: number; text: string; done: boolean }> }
        if (version < 2 && Array.isArray(s.todos)) {
          const moved = todosToEvents(s.todos).filter((t) => !(s.events ?? []).some((e) => e.id === t.id))
          s.events = [...(s.events ?? []), ...moved]
          delete s.todos
        }
        // v2 → v3: 시험 삼아 지우거나 읽어 둔 알림을 되돌려 예시 알림을 다시 채움 (한 번만)
        if (version < 3) {
          s.notiRead = {}
          s.notiDeleted = {}
        }
        return s as LifeData
      },
      // 예전에 저장된 설정에 새 항목(입주·계약 달)이 없으면 기본값으로 채움
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<LifeData>
        return { ...current, ...s, settings: { ...current.settings, ...s.settings } }
      },
    },
  ),
)

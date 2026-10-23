import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { monthKeyOf } from '@/lib/date'
import { seedBills, seedEvents, seedIncomes, seedSpends, todosToEvents } from './data/seed'
import type { Bill, CalEvent, LifeSettings, MoneyRecord } from './types'

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
  settings: LifeSettings
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

  markRead: (ids: string[]) => void
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
  settings: defaultSettings(),
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

export const useLifeStore = create<LifeData & LifeActions>()(
  persist(
    (set) => ({
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

      markRead: (ids) => set((s) => ({ notiRead: { ...s.notiRead, ...Object.fromEntries(ids.map((id) => [id, true])) } })),
      saveSettings: (settings) => set({ settings }),
      reset: () => set(initial()),
    }),
    {
      name: 'zip-life',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 → v2: 따로 저장하던 할 일(todos)을 오늘 날짜 일정으로 옮김
      migrate: (saved, version) => {
        const s = (saved ?? {}) as Partial<LifeData> & { todos?: Array<{ id: number; text: string; done: boolean }> }
        if (version < 2 && Array.isArray(s.todos)) {
          const moved = todosToEvents(s.todos).filter((t) => !(s.events ?? []).some((e) => e.id === t.id))
          s.events = [...(s.events ?? []), ...moved]
          delete s.todos
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

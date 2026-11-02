import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from '@/features/auth/store/authStore'
import { FIXED_INCOME_CATS, OTHER_INCOME_CATS, SPEND_CATS, type Category } from './data/catalog'
import { BILL_TAGS } from './types'

export type LedgerScope = 'fixed-income' | 'other-income' | 'spend' | 'bill'
const defaults: Record<LedgerScope, Category[]> = {
  'fixed-income': FIXED_INCOME_CATS, 'other-income': OTHER_INCOME_CATS, spend: SPEND_CATS,
  bill: BILL_TAGS.map((name) => ({ name, color: 'var(--color-primary)' })),
}
const colors = ['#6485df', '#68b6a0', '#d884aa', '#ef9b66', '#a28ad6', '#91a2b5']
type State = {
  byUser: Record<string, Partial<Record<LedgerScope, Category[]>>>
  orders: Record<string, Partial<Record<LedgerScope, string[]>>>
  add: (scope: LedgerScope, input: string) => string | null
  move: (scope: LedgerScope, from: string, to: string) => void
}
export function orderedCategories(categories: Category[], order: string[] = []) {
  const names = [...new Set([...order, ...categories.map((cat) => cat.name)])]
  return names.flatMap((name) => categories.filter((cat) => cat.name === name))
}
export const useLedgerCategoryStore = create<State>()(persist((set, get) => ({
  byUser: {},
  orders: {},
  move: (scope, from, to) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId || from === to) return
    const state = get()
    const categories = orderedCategories([...defaults[scope], ...(state.byUser[userId]?.[scope] ?? [])], state.orders[userId]?.[scope])
    const names = categories.map((cat) => cat.name)
    const source = names.indexOf(from), target = names.indexOf(to)
    if (source < 0 || target < 0) return
    names.splice(source, 1)
    names.splice(target, 0, from)
    set({ orders: { ...state.orders, [userId]: { ...state.orders[userId], [scope]: names } } })
  },
  add: (scope, input) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return '로그인 후 카테고리를 추가해 주세요.'
    const name = input.trim().replace(/\s+/g, ' ')
    if (!name) return '카테고리 이름을 입력해 주세요.'
    if (name.length > 24) return '이름은 24자 이내로 입력해 주세요.'
    const saved = get().byUser[userId] ?? {}
    const custom = saved[scope] ?? []
    if ([...defaults[scope], ...custom].some((cat) => cat.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return '이미 있는 카테고리예요.'
    set((s) => ({ byUser: { ...s.byUser, [userId]: { ...saved, [scope]: [...custom, { name, color: colors[custom.length % colors.length] }] } } }))
    return null
  },
}), { name: 'zip-ledger-categories', version: 1 }))

export function useLedgerCategories(scope: LedgerScope) {
  const userId = useAuthStore((s) => s.user?.id)
  const custom = useLedgerCategoryStore((s) => userId ? s.byUser[userId]?.[scope] : undefined)
  const order = useLedgerCategoryStore((s) => userId ? s.orders[userId]?.[scope] : undefined)
  return orderedCategories([...defaults[scope], ...(custom ?? [])], order)
}

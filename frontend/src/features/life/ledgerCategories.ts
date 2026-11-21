import { useQuery, useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isMockApi, useAuthStore } from '@/features/auth'
import { apiClient } from '@/lib/apiClient'
import { FIXED_INCOME_CATS, OTHER_INCOME_CATS, SPEND_CATS, type Category } from './data/catalog'
import { BILL_TAGS } from './types'
import { useLifeStore } from './store'

export type LedgerScope = 'fixed-income' | 'other-income' | 'spend' | 'bill'
type Selection = { custom: Category[]; order: string[]; hidden?: string[]; salaryLabel?: string | null }
type Change = { action: 'add' | 'rename' | 'delete' | 'move'; name: string; target?: string }
type Scoped<T> = Record<string, Partial<Record<LedgerScope, T>>>
const defaults: Record<LedgerScope, Category[]> = {
  'fixed-income': FIXED_INCOME_CATS, 'other-income': OTHER_INCOME_CATS, spend: SPEND_CATS,
  bill: BILL_TAGS.map((name) => ({ name, color: 'var(--color-primary)' })),
}
const colors = ['#6485df', '#68b6a0', '#d884aa', '#ef9b66', '#a28ad6', '#91a2b5']
const empty: Selection = { custom: [], order: [], hidden: [] }
type State = {
  byUser: Scoped<Category[]>
  orders: Scoped<string[]>
  hidden: Scoped<string[]>
  move: (scope: LedgerScope, from: string, to: string) => void
}
const normalize = (name: string) => name.trim().replace(/\s+/g, ' ')
function stored(state: State, owner: string, scope: LedgerScope): Selection {
  return { custom: state.byUser[owner]?.[scope] ?? [], order: state.orders[owner]?.[scope] ?? [], hidden: state.hidden[owner]?.[scope] ?? [] }
}
export function orderedCategories(categories: Category[], order: string[] = []) {
  const names = [...new Set([...order, ...categories.map((cat) => cat.name)])]
  return names.flatMap((name) => categories.filter((cat) => cat.name === name))
}
function visible(scope: LedgerScope, state: Selection) {
  return orderedCategories([...defaults[scope].filter(({ name }) => !state.hidden?.includes(name)), ...state.custom], state.order)
}
export const useLedgerCategoryStore = create<State>()(persist(() => ({
  byUser: {}, orders: {}, hidden: {},
  move: (scope, name, target) => {
    const owner = useAuthStore.getState().user?.id
    if (owner) changeLocal(owner, scope, { action: 'move', name, target })
  },
}), { name: 'zip-ledger-categories', version: 1 }))

function changeLocal(owner: string, scope: LedgerScope, change: Change) {
  const state = useLedgerCategoryStore.getState()
  const current = stored(state, owner, scope)
  const list = visible(scope, current)
  const name = normalize(change.name)
  const target = normalize(change.target ?? '')
  const index = list.findIndex((item) => item.name === name)
  const custom = [...current.custom]
  const hidden = new Set(current.hidden)
  const order = list.map((item) => item.name)
  if (change.action === 'move') {
    const destination = order.indexOf(target)
    if (index < 0 || destination < 0) return
    order.splice(index, 1)
    order.splice(destination, 0, name)
  } else {
    if (change.action === 'rename' && name === target) return
    if (change.action !== 'add') {
      if (index < 0) throw new Error('카테고리 목록이 바뀌었어요.')
      order.splice(index, 1)
      const customIndex = custom.findIndex((item) => item.name === name)
      if (customIndex >= 0) custom.splice(customIndex, 1)
      else hidden.add(name)
    }
    if (change.action !== 'delete') {
      const added = change.action === 'add' ? name : target
      if (!added || added.length > 24) throw new Error('카테고리 이름은 1~24자로 입력해 주세요.')
      if (order.some((item) => item.toLocaleLowerCase() === added.toLocaleLowerCase())) throw new Error('이미 있는 카테고리예요.')
      if (!hidden.delete(added)) custom.push({name: added, color: list[index]?.color ?? colors[custom.length % colors.length]})
      order.splice(index < 0 ? order.length : index, 0, added)
    }
  }
  useLedgerCategoryStore.setState({
    byUser: {...state.byUser, [owner]: {...state.byUser[owner], [scope]: custom}},
    orders: {...state.orders, [owner]: {...state.orders[owner], [scope]: order}},
    hidden: {...state.hidden, [owner]: {...state.hidden[owner], [scope]: [...hidden]}},
  })
  if (change.action === 'rename') {
    useLifeStore.setState((life) => {
      if (scope === 'bill') return { bills: life.bills.map((bill) => bill.tag === name ? { ...bill, tag: target } : bill) }
      if (scope === 'spend') return { spends: life.spends.map((record) => record.cat === name ? { ...record, cat: target } : record) }
      const incomeType = scope === 'fixed-income' ? 'fixed' : 'other'
      return { incomes: life.incomes.map((record) => {
        const type = record.incomeType ?? (FIXED_INCOME_CATS.some((category) => category.name === record.cat) ? 'fixed' : 'other')
        return record.cat === name && type === incomeType ? { ...record, cat: target, incomeType } : record
      }) }
    })
  }
}

const path = '/me/ledger-categories'
export function useLedgerCategorySettings(scope: LedgerScope) {
  const owner = useAuthStore((state) => state.user?.id)
  const custom = useLedgerCategoryStore((state) => owner ? state.byUser[owner]?.[scope] : undefined)
  const order = useLedgerCategoryStore((state) => owner ? state.orders[owner]?.[scope] : undefined)
  const hidden = useLedgerCategoryStore((state) => owner ? state.hidden[owner]?.[scope] : undefined)
  const client = useQueryClient()
  const key = ['ledger-categories', owner, scope] as const
  const server = useQuery({
    queryKey: key,
    enabled: !isMockApi && !!owner,
    queryFn: async ({ signal }) => {
      if (owner !== useAuthStore.getState().user?.id) throw new Error('다시 로그인해 주세요.')
      if (custom?.length || order?.length) {
        return (await apiClient.post<Selection>(path, { action: 'import', previous: { custom, order } }, { params: { scope }, signal })).data
      }
      return (await apiClient.get<Selection>(path, { params: { scope }, signal })).data
    },
  })
  return {
    categories: visible(scope, isMockApi ? { custom: custom ?? [], order: order ?? [], hidden } : server.data ?? empty),
    salaryLabel: server.data?.salaryLabel ?? '월급',
    loading: !isMockApi && server.isPending,
    failed: !isMockApi && server.isError,
    retry: server.refetch,
    change: async (change: Change) => {
      if (!owner || owner !== useAuthStore.getState().user?.id) throw new Error('다시 로그인해 주세요.')
      if (isMockApi) return changeLocal(owner, scope, change)
      await client.cancelQueries({ queryKey: key })
      if (owner !== useAuthStore.getState().user?.id) throw new Error('다시 로그인해 주세요.')
      try {
        const { data } = await apiClient.post<Selection>(path, change, { params: { scope } })
        client.setQueryData(key, data)
        if (change.action === 'rename') await client.invalidateQueries({ queryKey: [scope === 'bill' ? 'monthly-bills' : 'ledger', owner] })
      } catch (error) {
        void client.invalidateQueries({ queryKey: key })
        throw error
      }
    },
  }
}
export function useLedgerCategories(scope: LedgerScope) {
  return useLedgerCategorySettings(scope).categories
}

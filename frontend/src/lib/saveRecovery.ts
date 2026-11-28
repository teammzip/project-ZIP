import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAccountStorage } from './accountStorage'
import type { SyncId } from './listSync'

export type SaveDraft<T> = {
  key: string
  item: T
  target: SyncId | null
  message: string
  missing: boolean
}

export function saveRejection(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } } | null)?.response
  return {
    message: typeof response?.data?.message === 'string' && response.data.message.trim()
      ? response.data.message : '서버에 저장하지 못했어요. 내용을 확인하고 다시 저장해 주세요.',
    missing: response?.status === 404,
  }
}

export function createSaveRecovery<T extends { id: SyncId }>(name: string) {
  type Saved = { drafts: SaveDraft<T>[] }
  type State = Saved & { saving: SaveDraft<T> | null }
  const account = createAccountStorage<Saved>(name)
  const useStore = create<State>()(persist<State, [], [], Saved>(() => ({ drafts: [], saving: null }), {
    name, storage: account.storage, partialize: ({ drafts }) => ({ drafts }),
  }))
  account.bind(() => useStore.setState({ drafts: [], saving: null }), () => useStore.persist.rehydrate())

  const set = (state: Partial<State>) => {
    try { useStore.setState(state) }
    catch { /* 브라우저 저장소를 쓸 수 없어도 현재 화면에서는 초안을 유지해요. */ }
  }
  const put = (draft: SaveDraft<T>) => set({ drafts: [draft, ...useStore.getState().drafts.filter((entry) => entry.key !== draft.key)] })
  return {
    useStore,
    put,
    discard: (key: string) => set({ drafts: useStore.getState().drafts.filter((entry) => entry.key !== key) }),
    clear: () => set({ drafts: [], saving: null }),
    begin: (draft: SaveDraft<T>) => {
      const { drafts, saving } = useStore.getState()
      if (saving || !drafts.includes(draft)) return false
      set({ saving: draft })
      return true
    },
    finish: (draft: SaveDraft<T>) => {
      if (useStore.getState().saving === draft) set({ saving: null })
    },
    record: (item: T, target: SyncId | null, error: unknown) => put({
      key: target === null ? `new:${item.id}` : `saved:${target}`,
      item, target, ...saveRejection(error),
    }),
  }
}

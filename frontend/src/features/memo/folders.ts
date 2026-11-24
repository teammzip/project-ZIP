import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { useMemoStore } from './store'
import type { MemoFolder } from './types'
import { settleMemoWrites } from './sync'

export function useMemoFolders() {
  const userId = useAuthStore((s) => s.user?.id)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  const local = useMemoStore((s) => s.folders)
  const client = useQueryClient()
  const key = ['memo-folders', userId, sessionKey]
  // 다른 기기 · 탭에서 폴더를 바꿨을 수 있으니, 화면으로 돌아오면 늘 다시 불러옴 (공통 설정은 돌아올 때 다시 안 불러옴)
  const query = useQuery({
    queryKey: key, queryFn: async () => (await apiClient.get<MemoFolder[]>('/memo-folders')).data,
    enabled: !isMockApi && !!userId, refetchOnWindowFocus: 'always',
  })
  const folders = isMockApi ? local : query.data ?? []
  const save = async (name: string, id?: string) => {
    name = name.trim()
    if (!name || name.length > 40) throw new Error('폴더 이름은 1~40자로 입력해 주세요.')
    if (isMockApi) {
      if (folders.some((f) => f.id !== id && f.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('같은 이름의 폴더가 있어요.')
      const folder = { id: id ?? crypto.randomUUID(), name }
      useMemoStore.getState().setFolders(id ? folders.map((f) => f.id === id ? folder : f) : [...folders, folder])
      return folder
    }
    const folder = (id ? await apiClient.patch<MemoFolder>(`/memo-folders/${id}`, { name }) : await apiClient.post<MemoFolder>('/memo-folders', { name })).data
    await client.invalidateQueries({ queryKey: key })
    return folder
  }
  const remove = async (id: string) => {
    // 메모의 자동 저장이 진행 중일 수 있으므로, 삭제 후에는 미분류 상태로 함께 갱신합니다.
    if (!isMockApi) {
      await settleMemoWrites()
      await apiClient.delete(`/memo-folders/${id}`)
    }
    const store = useMemoStore.getState()
    store.setFolders(store.folders.filter((f) => f.id !== id))
    for (const memo of store.memos) if (memo.folderId === id) store.update(memo.id, { folderId: null })
    if (!isMockApi) {
      await client.invalidateQueries({ queryKey: key })
      window.dispatchEvent(new Event('zip-memos-refresh'))
    }
  }
  return { folders, save, remove, error: isMockApi ? null : query.error, loading: !isMockApi && query.isPending, retry: () => query.refetch() }
}

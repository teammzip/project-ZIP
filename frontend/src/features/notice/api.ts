import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { sortNotices, useNoticeStore, type Notice, type NoticeDraft } from './store'

/* 공지사항 데이터 · 동작 (frontend/API.md 14장). 가짜 API 모드는 이 브라우저(useNoticeStore),
 * 서버 모드는 /api/notices (목록 · 내용) · /api/admin/notices (관리자 쓰기 · 고치기 · 지우기). 화면은 어느 모드인지 몰라도 돼요. */

const KEY = ['notices'] as const

/** 공지 목록 (고정 먼저, 새 것부터) */
export function useNotices() {
  const user = useAuthStore((s) => s.user)
  const local = useNoticeStore((s) => s.notices)
  const server = useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: async () => (await apiClient.get<Notice[]>('/notices')).data,
    enabled: !isMockApi && !!user,
  })
  if (isMockApi) return { notices: sortNotices(local), loading: false, error: '' }
  return { notices: server.data ?? [], loading: server.isLoading, error: server.isError ? getErrorMessage(server.error) : '' }
}

/** 앱을 열면 띄울 팝업 공지 (내용 포함, 새 것부터) */
export function usePopupNotices() {
  const user = useAuthStore((s) => s.user)
  const local = useNoticeStore((s) => s.notices)
  const server = useQuery({
    queryKey: [...KEY, 'popups'],
    queryFn: async () => (await apiClient.get<Notice[]>('/notices/popups')).data,
    enabled: !isMockApi && !!user && user.role !== 'ADMIN',
    staleTime: 5 * 60_000,
  })
  if (isMockApi) return local.filter((n) => n.popup).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  return server.data ?? []
}

/** 공지 하나 (내용 포함) */
export function useNotice(id: string | undefined) {
  const user = useAuthStore((s) => s.user)
  const local = useNoticeStore((s) => s.notices.find((n) => n.id === id))
  const server = useQuery({
    queryKey: [...KEY, 'one', id],
    queryFn: async () => (await apiClient.get<Notice>(`/notices/${id}`)).data,
    enabled: !isMockApi && !!user && !!id,
    retry: false,
  })
  if (isMockApi) return { notice: local, loading: false, error: local ? '' : '공지를 찾을 수 없어요.' }
  return { notice: server.data, loading: server.isLoading, error: server.isError ? getErrorMessage(server.error) : '' }
}

/** 관리자: 공지 쓰기 · 고치기 · 지우기. 실패하면 화면에 보일 문구로 Error 를 던져요 */
export function useNoticeActions() {
  const client = useQueryClient()
  const store = useNoticeStore.getState
  const server = async <T,>(work: () => Promise<T>) => {
    try {
      const result = await work()
      await client.invalidateQueries({ queryKey: KEY })
      await client.invalidateQueries({ queryKey: ['notifications'] })
      return result
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
  return {
    /** 새 공지 → 번호. notify: 회원들에게 알림도 보냄 (서버 모드) */
    create: (draft: NoticeDraft, notify: boolean) =>
      isMockApi ? Promise.resolve(store().add(draft)) : server(async () => (await apiClient.post<Notice>('/admin/notices', { ...draft, notify })).data.id),
    update: (id: string, draft: NoticeDraft) =>
      isMockApi ? Promise.resolve(store().update(id, draft)) : server(async () => { await apiClient.patch(`/admin/notices/${id}`, draft) }),
    remove: (id: string) =>
      isMockApi ? Promise.resolve(store().remove(id)) : server(async () => { await apiClient.delete(`/admin/notices/${id}`) }),
  }
}

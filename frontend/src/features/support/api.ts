import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { useSupportStore, visibleInquiries, type Inquiry, type InquiryDraft } from './store'

/* 고객센터 데이터 · 동작 (frontend/API.md 13장). 가짜 API 모드는 이 브라우저(useSupportStore),
 * 서버 모드는 /api/support/inquiries (내 문의) · /api/admin/support/inquiries (관리자). 화면은 어느 모드인지 몰라도 돼요. */

const KEY = ['support'] as const

type InquiryList = { inquiries: Inquiry[]; loading: boolean; error: string }

const fromQuery = (q: { data?: Inquiry[]; isLoading: boolean; isError: boolean; error: unknown }): InquiryList => ({
  inquiries: q.data ?? [],
  loading: q.isLoading,
  error: q.isError ? getErrorMessage(q.error) : '',
})

/** 내 문의 (최근 것부터) */
export function useMyInquiries(): InquiryList {
  const user = useAuthStore((s) => s.user)
  const local = useSupportStore((s) => s.inquiries)
  const server = useQuery({
    queryKey: [...KEY, 'mine', user?.id],
    queryFn: async () => (await apiClient.get<Inquiry[]>('/support/inquiries')).data,
    enabled: !isMockApi && !!user,
  })
  return isMockApi ? { inquiries: visibleInquiries(local, user), loading: false, error: '' } : fromQuery(server)
}

/** 관리자: 전체 문의 (답변 대기부터) */
export function useAdminInquiries(): InquiryList {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const local = useSupportStore((s) => s.inquiries)
  const server = useQuery({
    queryKey: [...KEY, 'admin'],
    queryFn: async () => (await apiClient.get<Inquiry[]>('/admin/support/inquiries')).data,
    enabled: !isMockApi && isAdmin,
  })
  return isMockApi ? { inquiries: local, loading: false, error: '' } : fromQuery(server)
}

/** 문의 쓰기 · 답변. 실패하면 화면에 보일 문구로 Error 를 던져요 */
export function useSupportActions() {
  const client = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const addLocal = useSupportStore((s) => s.add)
  const replyLocal = useSupportStore((s) => s.reply)
  const server = async <T,>(work: () => Promise<T>) => {
    try {
      const result = await work()
      await client.invalidateQueries({ queryKey: KEY })
      return result
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }
  return {
    /** 새 문의 → 문의 번호 */
    add: async (draft: InquiryDraft): Promise<string> =>
      isMockApi
        ? addLocal(draft)
        : server(async () => {
            const created = (await apiClient.post<Inquiry>('/support/inquiries', draft)).data
            // 바로 열리는 문의 화면이 옛 목록을 보고 "찾을 수 없어요"를 띄우지 않게 목록에 먼저 넣음
            client.setQueryData<Inquiry[]>([...KEY, 'mine', userId], (list) => [created, ...(list ?? []).filter((q) => q.id !== created.id)])
            return created.id
          }),
    /** 관리자 답변 (문의당 하나) */
    reply: async (id: string, content: string): Promise<void> =>
      isMockApi ? replyLocal(id, content) : server(async () => void (await apiClient.post(`/admin/support/inquiries/${id}/answer`, { content }))),
  }
}

/** 화면 위 안내 문구 */
export const SUPPORT_NOTICE = isMockApi
  ? '현재 문의는 이 브라우저에만 저장되며 운영자에게 전송되지 않아요. 같은 브라우저의 관리자 화면에서 확인·답변할 수 있어요.'
  : '문의는 운영자에게 전달돼요. 답변이 등록되면 내 문의 내역에서 확인할 수 있어요.'

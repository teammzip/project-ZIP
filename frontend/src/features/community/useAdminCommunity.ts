import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockApi } from '@/features/auth'
import { apiClient } from '@/lib/apiClient'
import { useReportStore, type Report, type ReportReason } from './reports'
import { toPost, type ServerPost } from './server'
import { useCommunityStore } from './store'
import type { Post } from './types'

/* 관리자 화면(게시글 관리 · 신고 관리)의 커뮤니티 데이터 · 동작.
 * 가짜 API 모드는 이 브라우저(useCommunityStore · useReportStore), 서버 모드는 /api/admin/** (role = ADMIN). */

type ServerReport = {
  id: string
  targetType: 'POST' | 'COMMENT'
  targetId: string
  postId: string | null
  target: { title?: string; text?: string; author: string; deleted: boolean; deleteReason?: string | null }
  reason: ReportReason
  detail: string
  reporter: { id: string; nickname: string }
  status: 'RECEIVED' | 'HIDDEN' | 'DISMISSED'
  createdAt: string
}

const toReport = (r: ServerReport, posts: Post[]): Report => {
  const postId = Number(r.postId ?? 0)
  const post = posts.find((p) => p.id === postId)
  const commentIndex = r.targetType === 'COMMENT' && post ? post.comments.findIndex((c) => c.id === r.targetId) : undefined
  return {
    id: r.id,
    targetType: r.targetType,
    postId,
    commentIndex: commentIndex === -1 ? undefined : commentIndex,
    commentId: r.targetType === 'COMMENT' ? r.targetId : undefined,
    gone: r.target.deleted,
    deleteReason: r.target.deleteReason ?? undefined,
    targetAuthor: r.target.author,
    targetText: r.target.title ?? r.target.text ?? '',
    reason: r.reason,
    detail: r.detail,
    reporter: r.reporter.nickname,
    at: Date.parse(r.createdAt),
    status: r.status,
  }
}

const KEY = ['admin', 'community'] as const

export function useAdminCommunity(me: string) {
  const client = useQueryClient()
  const local = useCommunityStore()
  const localReports = useReportStore((s) => s.reports)
  const resolveLocal = useReportStore((s) => s.resolve)

  const serverPosts = useQuery({
    queryKey: [...KEY, 'posts'],
    queryFn: async () => (await apiClient.get<{ items: ServerPost[]; hasNext: boolean }>('/admin/posts')).data.items.map(toPost),
    enabled: !isMockApi,
  })
  const serverReports = useQuery({
    queryKey: [...KEY, 'reports'],
    queryFn: async () => (await apiClient.get<ServerReport[]>('/admin/reports')).data,
    enabled: !isMockApi,
  })
  // 관리자 목록과 회원 화면 목록을 같이 새로
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: KEY }), client.invalidateQueries({ queryKey: ['community'] })])

  const posts = isMockApi ? local.posts : (serverPosts.data ?? [])
  const reports = isMockApi ? localReports : (serverReports.data ?? []).map((r) => toReport(r, posts))

  return {
    posts,
    reports,
    /** 서버 모드에서 불러오는 중 · 실패 */
    loading: !isMockApi && (serverPosts.isLoading || serverReports.isLoading),
    error: !isMockApi && (serverPosts.isError || serverReports.isError),
    /** 글 삭제 (관련 신고는 '삭제함'). reason = 삭제 사유 (서버에 남음) */
    removePost: async (id: number, reason?: string) => {
      if (isMockApi) {
        local.removePost(id)
        resolveLocal((r) => r.postId === id, 'HIDDEN')
        return
      }
      await apiClient.delete(`/admin/posts/${id}`, { params: reason ? { reason } : undefined })
      await refresh()
    },
    /** 댓글 삭제 (관련 신고는 '삭제함') */
    removeComment: async (id: number, index: number, reason?: string) => {
      const c = posts.find((p) => p.id === id)?.comments[index]
      if (isMockApi) {
        local.removeComment(id, index)
        if (c) resolveLocal((r) => r.targetType === 'COMMENT' && r.postId === id && r.targetAuthor === c.author && r.targetText === c.text, 'HIDDEN')
        return
      }
      if (!c?.id) return
      await apiClient.delete(`/admin/comments/${c.id}`, { params: reason ? { reason } : undefined })
      await refresh()
    },
    /** 운영자로 댓글 쓰기 */
    addStaffComment: async (id: number, text: string) => {
      if (isMockApi) return local.addComment(id, me, text, true)
      await apiClient.post(`/admin/posts/${id}/comments`, { body: text })
      await refresh()
    },
    /** 신고 처리: 고른 신고들의 대상(글 · 댓글)별로 한꺼번에 HIDDEN(숨김) · DISMISSED(문제없음) */
    resolve: async (match: (r: Report) => boolean, status: 'HIDDEN' | 'DISMISSED') => {
      if (isMockApi) return resolveLocal(match, status)
      const targets = new Map<string, { targetType: string; targetId: string }>()
      for (const r of reports.filter(match)) {
        const targetId = r.targetType === 'POST' ? String(r.postId) : r.commentId
        if (targetId) targets.set(`${r.targetType}:${targetId}`, { targetType: r.targetType, targetId })
      }
      await Promise.all([...targets.values()].map((t) => apiClient.patch('/admin/reports', { status }, { params: t })))
      await refresh()
    },
  }
}

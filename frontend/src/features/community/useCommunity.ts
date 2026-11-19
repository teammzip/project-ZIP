import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { isMockApi } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { STORAGE_FULL } from './attachments'
import { useReportStore, type ReportReason } from './reports'
import { communityApi, type PostPage, type Scope } from './server'
import { useCommunityStore } from './store'
import type { Post, PostDraft } from './types'

/* 커뮤니티 데이터 · 동작을 한 곳에서: 가짜 API 모드는 이 브라우저(useCommunityStore), 서버 모드는 서버 API.
 * 화면(CommunityBoard · PostDetail)은 어느 모드인지 몰라도 돼요. */

const KEY = ['community'] as const

/** 서버 모드 글 목록 (동네 범위 · 주제 · 검색은 서버가 걸러 줌, 20개씩 더 보기) */
export function useServerPosts(scope: Scope, cat: string, q: string) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'posts', scope, cat, q],
    queryFn: ({ pageParam }) => communityApi.posts(scope, cat, q, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasNext ? pages.length : undefined),
    enabled: !isMockApi,
    staleTime: 30_000,
  })
}

/** 서버 모드 글 하나 (댓글 · 첨부 포함) */
export function useServerPost(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'post', id],
    queryFn: () => communityApi.post(id!),
    enabled: !isMockApi && !!id,
  })
}

export function usePopularPosts(userId: string | undefined, region: string) {
  return useQuery({
    queryKey: [...KEY, 'popular-posts', userId, region],
    queryFn: communityApi.popularPosts,
    enabled: !isMockApi && !!userId,
  })
}

/** 결과: 성공이면 null, 실패면 화면에 보일 문구 */
type Result = Promise<string | null>

/** 글 · 댓글 · 공감 · 신고 동작. 서버 모드는 저장 뒤 목록 · 글을 다시 받아요 (공감은 받은 숫자로 바로 고침) */
export function useCommunityActions() {
  const client = useQueryClient()
  const local = useCommunityStore()
  const addLocalReport = useReportStore((s) => s.add)
  const refresh = () => client.invalidateQueries({ queryKey: KEY })
  /** onConflict: 409 일 때 돌려줄 값 (그때도 목록은 새로 받음) */
  const run = async (work: () => Promise<unknown>, onConflict?: string): Result => {
    try {
      await work()
      await refresh()
      return null
    } catch (error) {
      if (onConflict && (error as { response?: { status?: number } }).response?.status === 409) {
        await refresh()
        return onConflict
      }
      return getErrorMessage(error)
    }
  }
  /** 공감 결과를 열린 글 · 목록 캐시에 바로 넣음 (목록 전체를 다시 받지 않음) */
  const setLike = (id: number, liked: boolean, likes: number) => {
    const patch = (p: Post) => (p.id === id ? { ...p, liked, likes } : p)
    client.setQueryData<Post>([...KEY, 'post', id], (p) => p && patch(p))
    client.setQueriesData<InfiniteData<PostPage>>({ queryKey: [...KEY, 'posts'] }, (data) =>
      data && { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(patch) })) },
    )
  }

  return {
    /** 새 글: 성공이면 null, 실패면 화면에 보일 문구 (가짜 API 모드에서 저장 공간이 부족하면 STORAGE_FULL 문구) */
    addPost: (draft: PostDraft, region: string, author: string): Result =>
      isMockApi ? Promise.resolve(local.addPost({ ...draft, region, author }) ? null : STORAGE_FULL) : run(() => communityApi.create(draft)),
    updatePost: (post: Post, draft: PostDraft): Result =>
      isMockApi ? Promise.resolve(local.updatePost(post.id, draft) ? null : STORAGE_FULL) : run(() => communityApi.update(post.id, draft)),
    removePost: (post: Post): Result => (isMockApi ? (local.removePost(post.id), Promise.resolve(null)) : run(() => communityApi.remove(post.id))),
    toggleLike: async (post: Post): Result => {
      if (isMockApi) return (local.toggleLike(post.id), null)
      try {
        const result = await communityApi.like(post.id, !post.liked)
        setLike(post.id, result.liked, result.likes)
        return null
      } catch (error) {
        return getErrorMessage(error)
      }
    },
    /** replyTo: 답글이면 단 댓글의 순서 */
    addComment: (post: Post, author: string, text: string, replyTo?: number): Result =>
      isMockApi
        ? (local.addComment(post.id, author, text, false, replyTo), Promise.resolve(null))
        : run(() => communityApi.addComment(post.id, text, replyTo !== undefined ? post.comments[replyTo]?.id : undefined)),
    updateComment: (post: Post, index: number, text: string): Result => {
      const comment = post.comments[index]
      if (isMockApi || !comment?.id) return (local.updateComment(post.id, index, text), Promise.resolve(null))
      return run(() => communityApi.updateComment(comment.id!, text))
    },
    removeComment: (post: Post, index: number): Result => {
      const comment = post.comments[index]
      if (isMockApi || !comment?.id) return (local.removeComment(post.id, index), Promise.resolve(null))
      return run(() => communityApi.removeComment(comment.id!))
    },
    /** 신고: 성공이면 null, 이미 신고했으면 'DUPLICATE', 그 밖은 오류 문구 */
    report: async (post: Post, commentIndex: number | undefined, reason: ReportReason, detail: string, reporter: string): Result => {
      const comment = commentIndex !== undefined ? post.comments[commentIndex] : undefined
      if (isMockApi) {
        const ok = addLocalReport({
          targetType: comment ? 'COMMENT' : 'POST', postId: post.id, commentIndex,
          targetAuthor: comment ? comment.author : post.author, targetText: comment ? comment.text : post.title,
          reason, detail, reporter,
        })
        return ok ? null : 'DUPLICATE'
      }
      return run(() => communityApi.report(comment ? 'COMMENT' : 'POST', comment ? comment.id! : String(post.id), reason, detail), 'DUPLICATE')
    },
  }
}

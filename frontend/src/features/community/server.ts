import { apiClient } from '@/lib/apiClient'
import { PHOTO_TYPES } from './attachments'
import type { Attachment, Comment, Post, PostDraft } from './types'

/* 커뮤니티 서버 API (frontend/API.md 7장 · backend community). VITE_USE_MOCK=false 일 때만 씀.
 * 서버 모양 → 화면 모양(Post · Comment)으로 바꾸고, 첨부는 먼저 POST /api/files 로 올린 뒤 id 로 붙여요. */

/** 화면 주제 이름 ↔ 서버 분류 코드 */
export const CATEGORY_CODE: Record<string, string> = { 자유: 'FREE', 꿀팁: 'TIP', 질문: 'QUESTION', 동네: 'TOWN' }
const CATEGORY_NAME: Record<string, string> = Object.fromEntries(Object.entries(CATEGORY_CODE).map(([name, code]) => [code, name]))

type ServerPerson = { id: string; nickname: string }
type ServerComment = { id: string; author: ServerPerson; body: string; mine: boolean; reported: boolean; staff?: boolean; parentId?: string | null; createdAt: string }
type ServerAttachment = { id: string; name: string; type: string; size: number; url: string }
export type ServerPost = {
  id: string
  region: { id: string; name: string }
  category: string
  title: string
  body: string
  author: ServerPerson
  mine: boolean
  createdAt: string
  updatedAt: string
  views: number
  likes: number
  liked: boolean
  reported: boolean
  homeTip?: boolean
  commentCount: number
  attachments?: ServerAttachment[]
  comments?: ServerComment[]
}

const toComment = (c: ServerComment): Comment => ({ id: c.id, author: c.author.nickname, text: c.body, ownerId: c.author.id, reported: c.reported, staff: !!c.staff, parentId: c.parentId ?? undefined })

export const toPost = (p: ServerPost): Post => ({
  id: Number(p.id),
  region: p.region.name,
  cat: CATEGORY_NAME[p.category] ?? p.category,
  title: p.title,
  body: p.body,
  author: p.author.nickname,
  ownerId: p.author.id,
  ts: Date.parse(p.createdAt),
  views: p.views,
  likes: p.likes,
  liked: p.liked,
  reported: p.reported,
  homeTip: !!p.homeTip,
  commentCount: p.commentCount,
  comments: (p.comments ?? []).map(toComment),
  attachments: (p.attachments ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type, size: a.size, data: a.url })),
})

export type Scope = 'here' | 'near' | 'all'
export type PostPage = { items: Post[]; hasNext: boolean }
/** "주변 동네" 탭 안내용 동네 이름 (sido: 시 · 도 이름, 시 · 도 자체면 null) */
export type NeighborRegion = { id: string; name: string; sido: string | null }
/** GET /api/posts/neighbors: 내 동네(주거 설문 · 내 정보 주소 기준)와 이웃 동네. 동네가 없으면 region = null */
export type Neighbors = { region: NeighborRegion | null; neighbors: NeighborRegion[] }

/** 새로 붙인 첨부(data URL)는 서버에 올리고(동시에, 순서는 그대로), 이미 올린 첨부는 id 그대로 → attachmentIds.
 * 서버 첨부는 JPEG · PNG 사진만 (서버가 다시 저장하며 사진 속 정보를 지움) */
const attachmentIds = (files: Attachment[]) =>
  Promise.all(
    files.map(async (f) => {
      if (f.id) return f.id
      if (!PHOTO_TYPES.includes(f.type)) throw new Error(`사진(JPEG · PNG)만 붙일 수 있어요: ${f.name}`)
      const blob = await (await fetch(f.data)).blob()
      const form = new FormData()
      form.append('file', new File([blob], f.name, { type: f.type }))
      return (await apiClient.post<{ id: string }>('/files', form)).data.id
    }),
  )

const postBody = async (draft: PostDraft) => ({
  category: CATEGORY_CODE[draft.cat] ?? draft.cat,
  title: draft.title,
  body: draft.body,
  attachmentIds: await attachmentIds(draft.attachments),
})

export const communityApi = {
  posts: async (scope: Scope, cat: string, q: string, page: number): Promise<PostPage> => {
    const params: Record<string, string | number> = { scope, page }
    if (cat !== '전체') params.category = CATEGORY_CODE[cat] ?? cat
    if (q.trim()) params.q = q.trim()
    const data = (await apiClient.get<{ items: ServerPost[]; hasNext: boolean }>('/posts', { params })).data
    return { items: data.items.map(toPost), hasNext: data.hasNext }
  },
  myPostCount: async (signal: AbortSignal) => (await apiClient.get<{ count: number }>('/posts/my-count', { signal })).data.count,
  post: async (id: number) => toPost((await apiClient.get<ServerPost>(`/posts/${id}`)).data),
  recordView: (id: number) => apiClient.post(`/posts/${id}/views`),
  popularPosts: async () => (await apiClient.get<ServerPost[]>('/posts/popular')).data.map(toPost),
  neighbors: async () => (await apiClient.get<Neighbors>('/posts/neighbors')).data,
  create: async (draft: PostDraft) => toPost((await apiClient.post<ServerPost>('/posts', await postBody(draft))).data),
  update: async (id: number, draft: PostDraft) => toPost((await apiClient.patch<ServerPost>(`/posts/${id}`, await postBody(draft))).data),
  remove: (id: number) => apiClient.delete(`/posts/${id}`),
  like: async (id: number, on: boolean) => (await (on ? apiClient.put : apiClient.delete)<{ liked: boolean; likes: number }>(`/posts/${id}/like`)).data,
  /** parentId: 답글이면 단 댓글 번호 */
  addComment: (postId: number, body: string, parentId?: string) => apiClient.post(`/posts/${postId}/comments`, parentId ? { body, parentId } : { body }),
  updateComment: (commentId: string, body: string) => apiClient.patch(`/comments/${commentId}`, { body }),
  removeComment: (commentId: string) => apiClient.delete(`/comments/${commentId}`),
  report: (targetType: 'POST' | 'COMMENT', targetId: string, reason: string, detail: string) =>
    apiClient.post('/reports', { targetType, targetId, reason, detail }),
}
